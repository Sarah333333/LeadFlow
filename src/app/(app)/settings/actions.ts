"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { saveBusinessProfile } from "@/app/onboarding/actions";
import type { Database } from "@/lib/database.types";
import { randomBytes } from "node:crypto";
import { requireOwnerRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { limit } from "@/lib/security/rate-limit";
import { email, httpUrl, isValidTimeZone, phone, text } from "@/lib/security/validation";
import { normalizePhone } from "@/lib/messaging/phone";
import { normalizeUrl } from "@/lib/business/schema";
import { log } from "@/lib/log";

type Result = { ok?: boolean; error?: string };

export async function saveProfileAction(raw: unknown): Promise<Result> {
  const res = await saveBusinessProfile(raw);
  revalidatePath("/", "layout");
  return res;
}

type SafeBusinessPatch = Pick<Database["public"]["Tables"]["businesses"]["Update"],
  "tone" | "booking_link" | "timezone" | "ai_enabled_by_default" | "custom_instructions" | "follow_up_delays_hours" |
  "quiet_hours_start" | "quiet_hours_end" | "notify_email" | "notify_phone" | "notify_on_hot" | "notify_on_attention" |
  "retention_days" | "max_ai_messages_per_lead_per_day">;

async function update(patch: SafeBusinessPatch): Promise<Result> {
  const { user, business } = await requireBusiness();
  if (!(await limit("mutationPerUser", user.id))) return { error: "Too many requests — please wait a moment." };
  // Users have no direct UPDATE on businesses; the server writes the validated patch, scoped to the
  // business that RLS resolved for this user's session in requireBusiness().
  const { error } = await createAdminClient().from("businesses").update(patch).eq("id", business.id);
  revalidatePath("/settings", "layout");
  if (error) {
    log.error("settings.update_failed", { businessId: business.id, error: error.message });
    return { error: "Could not save. Please try again." };
  }
  return { ok: true };
}

const aiSchema = z.object({
  tone: z.enum(["friendly", "professional", "casual"]),
  booking_link: httpUrl,
  timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone"),
  ai_enabled_by_default: z.boolean(),
  custom_instructions: text(2000),
}).strict();
export async function saveAiAction(raw: unknown): Promise<Result> {
  const { business } = await requireBusiness();
  const p = aiSchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message };
  const allowCustom = (PLANS[business.plan as PlanId] ?? PLANS.trial).customInstructions;
  return update({
    ...p.data, booking_link: normalizeUrl(p.data.booking_link),
    ...(allowCustom ? {} : { custom_instructions: business.custom_instructions }),
  });
}

const followSchema = z.object({
  follow_up_delays_hours: z.array(z.number().int().min(1).max(720)).max(8),
  quiet_hours_start: z.number().int().min(0).max(23),
  quiet_hours_end: z.number().int().min(0).max(23),
}).strict();
export async function saveFollowUpsAction(raw: unknown): Promise<Result> {
  const p = followSchema.safeParse(raw);
  if (!p.success) return { error: "Each follow-up delay must be between 1 and 720 hours." };
  return update({ ...p.data, follow_up_delays_hours: [...p.data.follow_up_delays_hours].sort((a, b) => a - b) });
}

const notifySchema = z.object({
  notify_email: email,
  notify_phone: phone,
  notify_on_hot: z.boolean(),
  notify_on_attention: z.boolean(),
}).strict();
export async function saveNotificationsAction(raw: unknown): Promise<Result> {
  const p = notifySchema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message };
  const notifyPhone = p.data.notify_phone ? normalizePhone(p.data.notify_phone) : null;
  if (p.data.notify_phone && !notifyPhone) return { error: "Enter a valid mobile number, including country code." };
  return update({ ...p.data, notify_email: p.data.notify_email || null, notify_phone: notifyPhone });
}

/** Invalidates the current lead-intake URL (e.g. if it leaked) and issues a new one. Owner only. */
export async function rotateIntakeKeyAction(): Promise<Result> {
  const { user, business } = await requireBusiness();
  if (!(await limit("mutationPerUser", user.id))) return { error: "Too many requests — please wait a moment." };
  try { await requireOwnerRole(business.id, user.id); } catch { return { error: "Only the account owner can do this." }; }
  // intake_key is not writable by users (column grants) — rotate with the service role, scoped to this business.
  const { error } = await createAdminClient().from("businesses")
    .update({ intake_key: randomBytes(18).toString("hex") }).eq("id", business.id);
  if (error) { log.error("intake.rotate_failed", { businessId: business.id }); return { error: "Could not rotate the key." }; }
  log.info("audit.intake_key_rotated", { userId: user.id, businessId: business.id });
  revalidatePath("/settings/intake");
  return { ok: true };
}

// ── Privacy & AI controls ──
const aiModeSchema = z.object({ mode: z.enum(["auto", "review", "off"]), acknowledged: z.boolean().optional() }).strict();

/** Auto mode requires an explicit acknowledgement of the business's responsibilities. "off" is the kill switch. */
export async function setAiModeAction(raw: unknown): Promise<Result> {
  const { user, business } = await requireBusiness();
  if (!(await limit("mutationPerUser", user.id))) return { error: "Too many requests — please wait a moment." };
  const p = aiModeSchema.safeParse(raw);
  if (!p.success) return { error: "Invalid mode." };
  if (p.data.mode === "auto" && !p.data.acknowledged) return { error: "Please confirm the statements before switching on automatic sending." };
  const { setBusinessAiMode } = await import("@/lib/engine");
  await setBusinessAiMode(business.id, p.data.mode, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

const dataSchema = z.object({
  retention_days: z.number().int().min(30).max(3650).nullable(),
  max_ai_messages_per_lead_per_day: z.number().int().min(1).max(25),
}).strict();

export async function saveDataSettingsAction(raw: unknown): Promise<Result> {
  const { user, business } = await requireBusiness();
  try { await requireOwnerRole(business.id, user.id); } catch { return { error: "Only the account owner can change this." }; }
  const p = dataSchema.safeParse(raw);
  if (!p.success) return { error: "Invalid settings." };
  const res = await update(p.data);
  if (res.ok) {
    const { audit } = await import("@/lib/compliance/records");
    await audit(createAdminClient(), { businessId: business.id, actor: "user", userId: user.id, action: "settings.data_controls", details: p.data });
  }
  return res;
}

/** Permanently deletes the business, all customer data and the owner's login. Cancels billing first. */
export async function deleteAccountAction(confirmName: unknown): Promise<Result | undefined> {
  const { user, business } = await requireBusiness();
  if (!(await limit("mutationPerUser", user.id))) return { error: "Too many requests — please wait a moment." };
  try { await requireOwnerRole(business.id, user.id); } catch { return { error: "Only the account owner can delete the account." }; }
  if (typeof confirmName !== "string" || confirmName.trim() !== business.name.trim()) {
    return { error: "Type your business name exactly to confirm." };
  }
  // Cancel billing BEFORE deleting data, so a deleted account can never keep being charged.
  if (business.stripe_subscription_id && ["active", "trialing", "past_due"].includes(business.subscription_status)) {
    try {
      const { stripe } = await import("@/lib/billing/stripe");
      await stripe().subscriptions.cancel(business.stripe_subscription_id);
    } catch (e) {
      log.error("account.delete_cancel_failed", { businessId: business.id, error: e });
      return { error: "We couldn't cancel your subscription automatically, so nothing was deleted. Please cancel billing first or contact support." };
    }
  }
  const { deleteBusinessAccount } = await import("@/lib/engine");
  await deleteBusinessAccount(business.id, user.id);
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  await supabase.auth.signOut();
  const { redirect } = await import("next/navigation");
  redirect("/?account_deleted=1");
}

/** Kill switch available from every page: turns the assistant off for the whole business immediately. */
export async function stopAllAiAction() {
  const { user, business } = await requireBusiness();
  // Deliberately generous: the kill switch must always work, but can't be hammered.
  if (!(await limit("mutationPerUser", user.id))) return;
  const { setBusinessAiMode } = await import("@/lib/engine");
  await setBusinessAiMode(business.id, "off", user.id);
  revalidatePath("/", "layout");
}
