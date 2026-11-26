// Single source of truth for pricing and entitlements. Change limits here only.
export type PlanId = "trial" | "starter" | "growth" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  leadLimit: number;          // new leads per calendar month
  maxFollowUps: number;       // automated nudges per lead
  aiMessagesPerDay: number;   // hard cost cap: AI-written messages per business per 24h
  smsPerDay: number;          // hard cap on outbound texts per business per 24h (spam / toll-fraud / cost)
  smsAlerts: boolean;         // hot-lead alerts by SMS to the owner (email + in-app on every plan)
  customInstructions: boolean;
  seats: number;
  analytics: "basic" | "full";
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial", aiMessagesPerDay: 100, smsPerDay: 100, name: "Free trial", priceMonthly: 0, leadLimit: 25, maxFollowUps: 3,
    smsAlerts: true, customInstructions: false, seats: 1, analytics: "full", features: [],
  },
  starter: {
    id: "starter", aiMessagesPerDay: 250, smsPerDay: 400, name: "Starter", priceMonthly: 29, leadLimit: 100, maxFollowUps: 1,
    smsAlerts: false, customInstructions: false, seats: 1, analytics: "basic",
    features: ["100 leads / month", "Instant AI reply & qualification", "1 automatic follow-up",
      "Hot-lead email alerts", "Lead dashboard"],
  },
  growth: {
    id: "growth", aiMessagesPerDay: 800, smsPerDay: 1500, name: "Growth", priceMonthly: 59, leadLimit: 500, maxFollowUps: 4,
    smsAlerts: true, customInstructions: false, seats: 1, analytics: "full", highlighted: true,
    features: ["500 leads / month", "Everything in Starter", "Up to 4 automatic follow-ups",
      "SMS + email hot-lead alerts", "Conversion & revenue analytics"],
  },
  pro: {
    id: "pro", aiMessagesPerDay: 2500, smsPerDay: 5000, name: "Pro", priceMonthly: 99, leadLimit: 5000, maxFollowUps: 8,
    smsAlerts: true, customInstructions: true, seats: 5, analytics: "full",
    features: ["5,000 leads / month", "Everything in Growth", "Up to 8 automatic follow-ups",
      "Custom AI instructions", "Up to 5 team members"],
  },
};

export const PAID_PLANS = [PLANS.starter, PLANS.growth, PLANS.pro];

export interface BillingState {
  plan: Plan;
  active: boolean;           // may the AI respond?
  reason?: string;
}

export function billingState(b: {
  plan: string; subscription_status: string; trial_ends_at: string;
}): BillingState {
  const plan = PLANS[(b.plan as PlanId)] ?? PLANS.trial;
  if (plan.id === "trial") {
    const active = new Date(b.trial_ends_at).getTime() > Date.now();
    return { plan, active, reason: active ? undefined : "Your free trial has ended." };
  }
  const active = ["active", "trialing", "past_due"].includes(b.subscription_status);
  return { plan, active, reason: active ? undefined : "Your subscription is not active." };
}
