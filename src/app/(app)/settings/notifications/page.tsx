import { requireBusiness } from "@/lib/auth";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { integrations } from "@/lib/env";
import { NotifyForm } from "./form";

export const metadata = { title: "Alert settings" };

export default async function NotificationSettingsPage() {
  const { business: b } = await requireBusiness();
  const plan = PLANS[b.plan as PlanId] ?? PLANS.trial;
  return <NotifyForm smsAllowed={plan.smsAlerts} smsConfigured={integrations.sms()} emailConfigured={integrations.email()}
    initial={{ notify_email: b.notify_email ?? "", notify_phone: b.notify_phone ?? "", notify_on_hot: b.notify_on_hot, notify_on_attention: b.notify_on_attention }} />;
}
