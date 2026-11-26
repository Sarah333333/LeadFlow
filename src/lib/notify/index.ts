import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Business, Lead } from "@/lib/types";
import { env, integrations } from "@/lib/env";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { sendToChannel } from "@/lib/messaging";
import { limit } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";
import { stripLinks } from "@/lib/ai/injection";

type Admin = SupabaseClient<Database>;
export type NotificationType = "hot_lead" | "needs_attention" | "limit_reached" | "lead_replied";

/** In-app notification always; email + SMS to the owner when configured and allowed by plan. */
export async function notifyOwner(db: Admin, business: Business, lead: Lead | null, type: NotificationType, title: string, body: string) {
  await db.from("notifications").insert({ business_id: business.id, lead_id: lead?.id ?? null, type, title, body });

  const wants = type === "hot_lead" ? business.notify_on_hot : business.notify_on_attention;
  if (!wants) return;
  const link = lead ? `${env.appUrl}/leads/${lead.id}` : `${env.appUrl}/dashboard`;

  if (integrations.email() && business.notify_email && (await limit("ownerEmailPerBusiness", business.id))) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.emailFrom, to: business.notify_email, subject: `${title} — LeadFlow AI`,
          text: `${body}\n\nOpen the lead: ${link}`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) log.error("notify.email_failed", { businessId: business.id, status: res.status });
    } catch (e) { log.error("notify.email_failed", { businessId: business.id, error: e }); }
  }

  const plan = PLANS[business.plan as PlanId] ?? PLANS.trial;
  if (plan.smsAlerts && business.notify_phone && (type === "hot_lead" || type === "needs_attention") &&
      (await limit("ownerSmsPerBusiness", business.id))) {
    const res = await sendToChannel({
      channel: "sms", to: business.notify_phone, from: business.sms_number,
      body: stripLinks(`LeadFlow: ${title}. ${body}`).slice(0, 300) + ` ${link}`, // only OUR link survives
    });
    if (res.status === "failed") log.warn("notify.owner_sms_failed", { businessId: business.id, error: res.error });
  }
}
