import { requireBusiness } from "@/lib/auth";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { aiProviderName } from "@/lib/ai";
import { AiForm } from "./form";

export const metadata = { title: "Assistant settings" };

export default async function AiSettingsPage() {
  const { business: b } = await requireBusiness();
  const plan = PLANS[b.plan as PlanId] ?? PLANS.trial;
  return (
    <AiForm provider={aiProviderName()} customAllowed={plan.customInstructions} initial={{
      tone: b.tone as "friendly", booking_link: b.booking_link ?? "", timezone: b.timezone,
      ai_enabled_by_default: b.ai_enabled_by_default, custom_instructions: b.custom_instructions,
    }} />
  );
}
