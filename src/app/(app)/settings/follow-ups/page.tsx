import { requireBusiness } from "@/lib/auth";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { FollowUpForm } from "./form";

export const metadata = { title: "Follow-up settings" };

export default async function FollowUpSettingsPage() {
  const { business: b } = await requireBusiness();
  const plan = PLANS[b.plan as PlanId] ?? PLANS.trial;
  return <FollowUpForm maxSteps={plan.maxFollowUps} planName={plan.name}
    initial={{ follow_up_delays_hours: b.follow_up_delays_hours, quiet_hours_start: b.quiet_hours_start, quiet_hours_end: b.quiet_hours_end }} />;
}
