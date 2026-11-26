"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { businessProfileSchema, cleanProfile, normalizeUrl, nullIfEmpty } from "@/lib/business/schema";
import { normalizePhone } from "@/lib/messaging/phone";
import { limit } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";
import { recordAgreements } from "@/lib/compliance/agreements";

// Server actions are public HTTP endpoints: the argument type is NOT trusted — everything is re-validated.
export async function saveBusinessProfile(raw: unknown, opts: { completeOnboarding?: boolean } = {}) {
  const user = await requireUser();
  if (!(await limit("mutationPerUser", user.id))) return { error: "Too many requests — please wait a moment." };
  const parsed = businessProfileSchema.safeParse(cleanProfile(raw));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const p = parsed.data;

  const supabase = await createClient(); // user session → RLS + column grants apply
  const { data: businessId, error: rpcError } = await supabase.rpc("create_business", { p_name: p.name });
  if (rpcError || !businessId) {
    log.error("business.create_failed", { userId: user.id, error: rpcError?.message });
    return { error: "Could not save your business. Please try again." };
  }

  // Users can't write businesses directly (no UPDATE grant): the server writes validated data,
  // scoped to the business create_business just returned for THIS user.
  const { error } = await createAdminClient().from("businesses").update({
    name: p.name, industry: p.industry, description: p.description,
    contact_phone: nullIfEmpty(p.contact_phone), contact_email: nullIfEmpty(p.contact_email), website: normalizeUrl(p.website),
    services: p.services, average_job_value: p.average_job_value, currency: p.currency,
    service_areas: p.service_areas, opening_hours: p.opening_hours, faqs: p.faqs, tone: p.tone,
    booking_link: normalizeUrl(p.booking_link), timezone: p.timezone,
    notify_phone: normalizePhone(p.notify_phone), notify_email: nullIfEmpty(p.notify_email),
    ...(opts.completeOnboarding ? { onboarding_completed: true } : {}),
  }).eq("id", businessId);
  if (error) {
    log.error("business.update_failed", { userId: user.id, businessId, error: error.message });
    return { error: "Could not save your business. Please try again." };
  }
  return { ok: true };
}

export async function completeOnboarding(raw: unknown, acknowledged: unknown) {
  if (acknowledged !== true) return { error: "Please confirm the statements about your responsibilities." };
  const user = await requireUser();
  const res = await saveBusinessProfile(raw, { completeOnboarding: true });
  if (res.error) return res;
  const { data: m } = await (await createClient()).from("business_members").select("business_id").eq("user_id", user.id).single();
  await recordAgreements(user.id, m?.business_id ?? null, ["business_responsibilities"]);
  redirect("/dashboard?welcome=1");
}
