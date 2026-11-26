"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBusiness, requireLeadAccess, requireOwnerRole } from "@/lib/auth";
import {
  approveDraft, closeLead, createLead, deleteLead, discardDraft, handleInbound, markDoNotContact, recordOwnerConsent,
  reopenLead, resolveAttention, sendOwnerMessage, setAiPaused,
} from "@/lib/engine";
import { uuid } from "@/lib/security/validation";
import { OWNER_CONSENT_STATEMENT } from "@/lib/compliance/legal";
import { createClient } from "@/lib/supabase/server";
import { integrations } from "@/lib/env";
import { limit } from "@/lib/security/rate-limit";
import { email, phone, text } from "@/lib/security/validation";
import { log } from "@/lib/log";

// Server actions are public endpoints: every argument is validated, every lead is access-checked.
type Result = { ok?: boolean; error?: string };
const TOO_MANY: Result = { error: "Too many requests — please wait a moment." };
const fail = (event: string, e: unknown, fields: object = {}): Result => {
  log.error(event, { ...fields, error: e });
  return { error: e instanceof Error && /opted out|reopened/.test(e.message) ? e.message : "Something went wrong. Please try again." };
};

const newLead = z.object({
  name: text(100).pipe(z.string().min(1, "Name is required")),
  phone: phone.optional(),
  email: email.optional(),
  source: z.enum(["website", "facebook", "instagram", "google", "referral", "phone", "manual", "other"]).default("manual"),
  service_requested: text(120).optional(),
  location: text(120).optional(),
  initial_message: text(2000).optional(),
  channel: z.enum(["sms", "test"]).default("test"),
  sms_consent_attested: z.literal("on").optional(),
});

export async function addLeadAction(_: unknown, form: FormData) {
  const { user, business } = await requireBusiness();
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  const parsed = newLead.safeParse(Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$"))));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.channel === "sms" && !d.phone) return { error: "A valid phone number is needed to text this lead." };
  if (d.channel === "sms" && !integrations.sms()) return { error: "SMS isn't connected yet — use test mode." };
  if (d.channel === "sms" && d.sms_consent_attested !== "on") {
    return { error: "Confirm that this person asked to be contacted by text — LeadFlow only texts people who have." };
  }
  let id: string;
  try {
    id = (await createLead(business.id, {
      ...d, email: d.email || null,
      consent: d.channel === "sms" ? { basis: "owner_attestation", evidence: { attested_by: user.id, statement: OWNER_CONSENT_STATEMENT } } : undefined,
    })).id;
  } catch (e) {
    return fail("lead.add_failed", e, { businessId: business.id });
  }
  redirect(`/leads/${id}`);
}

const body = text(1000).pipe(z.string().min(1, "Message can't be empty."));

export async function ownerSendAction(leadId: unknown, message: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("ownerSendPerUser", user.id))) return TOO_MANY;
  const msg = body.safeParse(message);
  if (!msg.success) return { error: msg.error.issues[0]?.message };
  try {
    const res = await sendOwnerMessage(businessId, id, msg.data);
    revalidatePath(`/leads/${id}`);
    if (res.status === "skipped") {
      const reasons: Record<string, string> = {
        "Duplicate message suppressed": "You just sent that exact message.",
        "Daily text message limit reached": "Daily text message limit reached for your plan — try again tomorrow or upgrade.",
        "Lead opted out": "This lead opted out of messages.",
        "No SMS consent recorded": "No SMS consent is recorded for this person. Record consent first, or contact them another way.",
        "Marked do not contact": "This lead is marked do not contact.",
      };
      return { error: reasons[res.error ?? ""] ?? "Not sent." };
    }
    return res.status === "failed" ? { error: `Saved, but not delivered: ${res.error}` } : { ok: true };
  } catch (e) {
    return fail("lead.owner_send_failed", e, { businessId, leadId: id });
  }
}

/** Test mode only: the owner plays the lead to try the assistant. Rate-limited because it costs AI calls. */
export async function simulateLeadAction(leadId: unknown, message: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("simulatePerUser", user.id))) return { error: "Test chat limit reached — please wait a few minutes." };
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("channel").eq("id", id).single();
  if (lead?.channel !== "test") return { error: "Only available for test-mode leads." };
  const msg = body.safeParse(message);
  if (!msg.success) return { error: msg.error.issues[0]?.message };
  try {
    await handleInbound(id, msg.data, "test");
  } catch (e) {
    return fail("lead.simulate_failed", e, { businessId, leadId: id });
  }
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function setAiPausedAction(leadId: unknown, paused: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  try { await setAiPaused(businessId, id, paused === true); } catch (e) { return fail("lead.pause_failed", e, { businessId, leadId: id }); }
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function closeLeadAction(leadId: unknown, outcome: unknown, value?: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  const o = z.enum(["won", "lost"]).safeParse(outcome);
  const v = z.number().finite().min(0).max(10_000_000).nullable().optional().safeParse(value ?? null);
  if (!o.success || !v.success) return { error: "Invalid value." };
  try { await closeLead(businessId, id, o.data, v.data); } catch (e) { return fail("lead.close_failed", e, { businessId, leadId: id }); }
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function reopenLeadAction(leadId: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  try { await reopenLead(businessId, id); } catch (e) { return fail("lead.reopen_failed", e, { businessId, leadId: id }); }
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function resolveAttentionAction(leadId: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  await resolveAttention(businessId, id);
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

/** Permanently delete a lead and its conversation (e.g. a GDPR erasure request). Owner only. */
export async function deleteLeadAction(leadId: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  try {
    await requireOwnerRole(businessId, user.id);
    await deleteLead(businessId, id);
  } catch (e) {
    return fail("lead.delete_failed", e, { businessId, leadId: id });
  }
  log.info("audit.lead_deleted", { userId: user.id, businessId, leadId: id });
  redirect("/leads");
}

// ── Review workflow ──
const draftEdit = text(1000).pipe(z.string().min(1, "Message can't be empty."));

export async function approveDraftAction(leadId: unknown, messageId: unknown, edited?: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("ownerSendPerUser", user.id))) return TOO_MANY;
  const mid = uuid.safeParse(messageId);
  const body = edited === undefined || edited === null ? null : draftEdit.safeParse(edited);
  if (!mid.success || (body && !body.success)) return { error: "Invalid draft." };
  try {
    const res = await approveDraft(businessId, id, mid.data, user.id, body?.success ? body.data : undefined);
    revalidatePath(`/leads/${id}`);
    if (res.status === "skipped") return { error: res.error === "No SMS consent recorded" ? "No SMS consent is recorded for this person." : `Not sent: ${res.error}` };
    return res.status === "failed" ? { error: `Not delivered: ${res.error}` } : { ok: true };
  } catch (e) { return fail("draft.approve_failed", e, { businessId, leadId: id }); }
}

export async function discardDraftAction(leadId: unknown, messageId: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  const mid = uuid.safeParse(messageId);
  if (!mid.success) return { error: "Invalid draft." };
  await discardDraft(businessId, id, mid.data, user.id);
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

// ── Consent ──
export async function recordConsentAction(leadId: unknown, note: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  const n = text(300).pipe(z.string().min(5, "Say how they asked to be texted (e.g. 'Phoned on 3 May, asked us to text a quote').")).safeParse(note);
  if (!n.success) return { error: n.error.issues[0]?.message };
  try { await recordOwnerConsent(businessId, id, user.id, n.data); }
  catch (e) { return { error: e instanceof Error && /opted out|phone/.test(e.message) ? e.message : "Could not record consent." }; }
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

export async function markDoNotContactAction(leadId: unknown): Promise<Result> {
  const { user, businessId, leadId: id } = await requireLeadAccess(leadId);
  if (!(await limit("mutationPerUser", user.id))) return TOO_MANY;
  await markDoNotContact(businessId, id, user.id);
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}
