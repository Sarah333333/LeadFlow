"use server";
import { redirect } from "next/navigation";
import { requireBusiness, requireUser } from "@/lib/auth";
import { env, integrations } from "@/lib/env";
import { priceIdFor, stripe } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { limit } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";

export async function startCheckout(rawPlan: unknown) {
  const user = await requireUser();
  const { business } = await requireBusiness();
  const parsedPlan = z.enum(["starter", "growth", "pro"]).safeParse(rawPlan);
  if (!parsedPlan.success) return { error: "Unknown plan." };
  const plan: PlanId = parsedPlan.data;
  if (!(await limit("checkoutPerBusiness", business.id))) return { error: "Too many attempts — please wait a moment." };
  if (!integrations.stripe()) return { error: "Payments aren't configured on this server yet (STRIPE_SECRET_KEY)." };
  const price = priceIdFor(plan);
  if (!price) return { error: `No Stripe price configured for the ${plan} plan.` };

  const s = stripe();
  let customer = business.stripe_customer_id;
  if (!customer) {
    // Idempotency key: a double click can't create two Stripe customers for one business.
    const c = await s.customers.create({ email: user.email, name: business.name, metadata: { business_id: business.id } },
      { idempotencyKey: `customer-${business.id}` });
    customer = c.id;
    await createAdminClient().from("businesses").update({ stripe_customer_id: customer }).eq("id", business.id);
  }
  // Existing subscribers change plan in the portal (handles proration correctly).
  if (business.stripe_subscription_id && ["active", "trialing", "past_due"].includes(business.subscription_status)) {
    return openPortal();
  }
  log.info("billing.checkout_started", { businessId: business.id, plan });
  const session = await s.checkout.sessions.create({
    mode: "subscription", customer, client_reference_id: business.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { business_id: business.id } },
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/settings/billing?success=1`,
    cancel_url: `${env.appUrl}/settings/billing`,
  });
  redirect(session.url!);
}

export async function openPortal() {
  const { business } = await requireBusiness();
  if (!(await limit("checkoutPerBusiness", business.id))) return { error: "Too many attempts — please wait a moment." };
  if (!integrations.stripe() || !business.stripe_customer_id) return { error: "No billing account yet." };
  const session = await stripe().billingPortal.sessions.create({
    customer: business.stripe_customer_id, return_url: `${env.appUrl}/settings/billing`,
  });
  redirect(session.url);
}
