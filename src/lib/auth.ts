import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/security/validation";
import { log } from "@/lib/log";

/** Verified user (getUser() validates the JWT with Supabase Auth — never trust getSession() on the server). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/** Current user's business (RLS-scoped). Null if they haven't started onboarding. */
export const getBusiness = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("*").limit(1).maybeSingle();
  return data;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages and actions inside the app: must be logged in and onboarded. */
export async function requireBusiness() {
  const user = await requireUser();
  const business = await getBusiness();
  if (!business || !business.onboarding_completed) redirect("/onboarding");
  return { user, business };
}

export async function requireOwnerRole(businessId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("business_members").select("role").eq("business_id", businessId).eq("user_id", userId).maybeSingle();
  if (data?.role !== "owner") throw new Error("Only the account owner can do this.");
}

export class AccessDenied extends Error {}

/**
 * For actions on a lead: validates the ID and verifies through RLS (the user's own session) that the lead
 * belongs to the user's business. Returns the business ID to pass to the engine, which re-checks it.
 */
export async function requireLeadAccess(leadId: unknown) {
  const { user, business } = await requireBusiness();
  const id = uuid.safeParse(leadId);
  if (!id.success) throw new AccessDenied("Lead not found");
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("id, business_id").eq("id", id.data).maybeSingle();
  if (!data || data.business_id !== business.id) {
    log.security("tenancy.lead_access_denied", { userId: user.id, businessId: business.id, leadId: id.data });
    throw new AccessDenied("Lead not found");
  }
  return { user, business, leadId: data.id, businessId: business.id };
}
