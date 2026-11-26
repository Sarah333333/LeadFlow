import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import type { PlanId } from "./plans";

let client: Stripe | null = null;
export function stripe() {
  if (!env.stripeSecret) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY)");
  client ??= new Stripe(env.stripeSecret);
  return client;
}

export function priceIdFor(plan: PlanId): string | undefined {
  return plan === "trial" ? undefined : env.stripePrices[plan];
}

export function planForPrice(priceId: string | undefined): PlanId | null {
  const entry = Object.entries(env.stripePrices).find(([, id]) => id && id === priceId);
  return (entry?.[0] as PlanId) ?? null;
}
