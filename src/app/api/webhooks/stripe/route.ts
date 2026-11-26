import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { planForPrice, stripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { BodyTooLarge, readBody } from "@/lib/security/http";
import { claimEvent, completeEvent, releaseEvent } from "@/lib/security/idempotency";
import { log } from "@/lib/log";

// Stripe → us. The ONLY place plan / subscription status changes (users can't write these columns: see RLS).
// - Signature verified on the raw body.
// - Each event ID is processed once (Stripe retries and may deliver duplicates).
// - Events can arrive out of order: an older event never overwrites newer subscription state.
export async function POST(req: NextRequest) {
  if (!env.stripeSecret || !env.stripeWebhookSecret) return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  let raw: string;
  try { raw = await readBody(req, 256 * 1024); } catch (e) {
    return NextResponse.json({ error: e instanceof BodyTooLarge ? "Payload too large" : "Bad request" }, { status: e instanceof BodyTooLarge ? 413 : 400 });
  }
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", env.stripeWebhookSecret);
  } catch {
    log.security("webhook.invalid_signature", { provider: "stripe" });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!(await claimEvent("stripe", event.id))) {
    log.info("webhook.duplicate", { provider: "stripe", eventId: event.id, type: event.type });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
    await completeEvent("stripe", event.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    await releaseEvent("stripe", event.id); // let Stripe's retry process it again
    log.error("webhook.failed", { provider: "stripe", eventId: event.id, type: event.type, error: e });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function handle(event: Stripe.Event) {
  const db = createAdminClient();
  const eventAt = new Date(event.created * 1000).toISOString();

  async function syncSubscription(sub: Stripe.Subscription, deleted = false) {
    const item = sub.items.data[0];
    const plan = planForPrice(item?.price.id);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const businessId = sub.metadata?.business_id;
    const patch = {
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
      subscription_status: deleted ? "canceled" : sub.status,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      stripe_event_at: eventAt,
      ...(plan ? { plan } : {}),
    };
    // Match by our business ID (set in metadata at checkout) AND the Stripe customer when known,
    // and only apply if this event is not older than the last one applied.
    let q = db.from("businesses").update(patch).or(`stripe_event_at.is.null,stripe_event_at.lte."${eventAt}"`);
    q = businessId ? q.eq("id", businessId) : q.eq("stripe_customer_id", customerId);
    const { data, error } = await q.select("id, plan, subscription_status");
    if (error) throw new Error(`subscription update failed: ${error.code}`);
    if (!data?.length) {
      log.warn("subscription.stale_or_unmatched", { eventId: event.id, businessId, customerId });
      return;
    }
    if (businessId) {
      // Defense in depth: if the business is already linked to a different Stripe customer, flag it.
      const { data: b } = await db.from("businesses").select("stripe_customer_id").eq("id", businessId).single();
      if (b?.stripe_customer_id && b.stripe_customer_id !== customerId) log.security("subscription.customer_mismatch", { businessId });
    }
    log.info("subscription.changed", { businessId: data[0].id, plan: data[0].plan, status: data[0].subscription_status, eventType: event.type });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode === "subscription" && s.subscription) {
        const id = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
        await syncSubscription(await stripe().subscriptions.retrieve(id)); // fetch authoritative state from Stripe
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object, true);
      break;
  }
}
