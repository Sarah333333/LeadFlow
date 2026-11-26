import { differenceInCalendarDays } from "date-fns";
import { Card, Notice } from "@/components/ui";
import { PlanCards } from "@/components/plan-cards";
import { requireBusiness } from "@/lib/auth";
import { billingState } from "@/lib/billing/plans";
import { integrations } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import { CheckoutButton, PortalButton } from "./buttons";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const { business: b } = await requireBusiness();
  const { success } = await searchParams;
  const billing = billingState(b);
  const supabase = await createClient();
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString());
  const used = count ?? 0;
  const pct = Math.min(100, Math.round((used / billing.plan.leadLimit) * 100));
  const subscribed = Boolean(b.stripe_subscription_id) && billing.plan.id !== "trial";

  return (
    <div className="space-y-6">
      {success && <Notice tone="success">Thanks! Your subscription is active. It can take a few seconds to show here.</Notice>}
      {!integrations.stripe() && <Notice tone="warn">Payments aren&apos;t configured on this server yet. Add your Stripe keys to enable checkout (see docs/DEPLOYMENT.md).</Notice>}

      <Card className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
        <div>
          <div className="text-[13px] text-muted">Current plan</div>
          <div className="mt-1 flex items-center gap-2 text-xl font-semibold">
            {billing.plan.name}
            <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", billing.active ? "bg-brand-soft text-brand" : "bg-danger-soft text-danger")}>
              {billing.active ? (billing.plan.id === "trial" ? "Trial" : b.subscription_status === "past_due" ? "Payment due" : "Active") : "Inactive"}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {billing.plan.id === "trial"
              ? billing.active ? `Ends ${formatDate(b.trial_ends_at)} (${differenceInCalendarDays(new Date(b.trial_ends_at), new Date())} days left)` : "Your trial has ended — choose a plan to keep the assistant running."
              : b.current_period_end ? `Renews ${formatDate(b.current_period_end)}` : ""}
          </p>
          {subscribed && <div className="mt-4"><PortalButton /></div>}
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-muted">Leads this month</span>
            <span><span className="font-semibold tabular-nums text-ink">{used}</span> <span className="text-muted">/ {billing.plan.leadLimit.toLocaleString()}</span></span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[0.06]" role="meter" aria-valuenow={used} aria-valuemax={billing.plan.leadLimit} aria-label="Leads used this month">
            <div className={cn("h-full rounded-full", pct >= 90 ? "bg-hot" : "bg-ink")} style={{ width: `${Math.max(pct, used ? 2 : 0)}%` }} />
          </div>
          <p className="mt-2 text-xs text-faint">Resets on the 1st. When you hit the limit, new leads are saved but the assistant stops replying until you upgrade.</p>
        </div>
      </Card>

      <div>
        <h2 className="mb-4 text-sm font-semibold">{subscribed ? "Change plan" : "Choose a plan"}</h2>
        <PlanCards currentPlan={subscribed ? b.plan : undefined}
          action={(p) => subscribed && p.id === b.plan ? null : <CheckoutButton plan={p.id} highlighted={p.highlighted} label={subscribed ? `Switch to ${p.name}` : `Choose ${p.name}`} />} />
      </div>
    </div>
  );
}
