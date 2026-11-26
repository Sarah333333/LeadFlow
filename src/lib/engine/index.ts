import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Business, Lead, Message } from "@/lib/types";
import { CLOSED_STATUSES, type LeadStatus } from "@/lib/types";
import { AiUnavailableError, runAiTurn, type AiMode, type GuardedOutput } from "@/lib/ai";
import { detectOptOut, temperatureFromScore } from "@/lib/ai/guards";
import { billingState, PLANS, type PlanId } from "@/lib/billing/plans";
import { sendToChannel } from "@/lib/messaging";
import { normalizePhone } from "@/lib/messaging/phone";
import { notifyOwner } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstName, UNKNOWN_LEAD_NAME } from "@/lib/utils";
import { log } from "@/lib/log";
import { claimEvent } from "@/lib/security/idempotency";
import { limit } from "@/lib/security/rate-limit";
import { stripInvisible } from "@/lib/security/validation";
import { outsideQuietHours } from "./schedule";
import { audit, isSuppressed, recordConsent } from "@/lib/compliance/records";
import { redactSensitive } from "@/lib/compliance/sensitive";
export { outsideQuietHours };

/**
 * THE CONVERSATION ENGINE
 * Every entry point (manual add, intake webhook, inbound SMS, cron, owner actions) calls these functions.
 * They use the service-role client, so EVERY query is explicitly scoped to one business.
 *
 * Safety properties:
 *  - One AI turn per lead at a time (DB lock). Messages arriving mid-turn trigger exactly one re-run.
 *  - Every AI turn is idempotent: it only replies if the conversation actually needs a reply.
 *  - Opted-out leads can never be messaged (hard check in sendOutbound).
 *  - Per-lead and per-business caps bound message volume and AI cost.
 */
type DB = SupabaseClient<Database>;

export class NotFoundError extends Error {}

export const LEAD_AI_MESSAGES_PER_DAY = 25;      // runaway-conversation guard (e.g. two bots talking)
const DUPLICATE_WINDOW_MS = 10 * 60_000;         // identical outbound text to the same lead
const LEAD_DEDUPE_WINDOW_MS = 10 * 60_000;       // same person submitting a form twice
const MAX_INBOUND_CHARS = 5000;
const SAFE_NAME = /^[\p{L}][\p{L} '.-]{0,39}$/u;
const OPT_IN = /^\s*(start|unstop|yes)\s*[.!]?\s*$/i;
// Natural-language opt-outs are honoured too, not just carrier keywords (any reasonable request to stop).
const OPT_OUT_PHRASE = /\b(stop (texting|messaging|contacting|sending)|don'?t (text|message|contact) me|do not (text|message|contact) me|unsubscribe me|remove (me|my number)|leave me alone|no more (texts|messages))\b/i;
const SMS_OPT_OUT_FOOTER = " Reply STOP to opt out.";

// ─────────────────────────── loading & tenancy ───────────────────────────
async function loadContext(db: DB, leadId: string, businessId?: string) {
  let q = db.from("leads").select("*").eq("id", leadId);
  if (businessId) q = q.eq("business_id", businessId);
  const { data: lead } = await q.maybeSingle();
  if (!lead) {
    if (businessId) log.security("tenancy.lead_access_denied", { leadId, businessId });
    throw new NotFoundError("Lead not found");
  }
  const { data: business } = await db.from("businesses").select("*").eq("id", lead.business_id).single();
  if (!business) throw new NotFoundError("Business not found");
  const { data: messages } = await db.from("messages").select("*")
    .eq("lead_id", leadId).eq("business_id", lead.business_id).order("created_at");
  return { lead, business, messages: messages ?? [] };
}

async function logEvent(db: DB, lead: Pick<Lead, "id" | "business_id">, type: string, data: object = {}) {
  await db.from("lead_events").insert({ lead_id: lead.id, business_id: lead.business_id, type, data: data as never });
}

const preview = (body: string) => (body.length > 140 ? body.slice(0, 137) + "…" : body);
const isClosed = (s: string) => CLOSED_STATUSES.includes(s as LeadStatus);

async function flag(db: DB, business: Business, lead: Lead, reason: string, notifyTitle?: string) {
  await db.from("leads").update({ needs_attention: true, attention_reason: reason.slice(0, 300) })
    .eq("id", lead.id).eq("business_id", business.id);
  if (notifyTitle && !lead.needs_attention) {
    await notifyOwner(db, business, lead, "needs_attention", notifyTitle, reason);
  }
}

// ─────────────────────────── sending ───────────────────────────
type SendResult = { msg: Message | null; status: "sent" | "failed" | "skipped"; error?: string };

async function sendOutbound(
  db: DB, business: Business, lead: Lead, body: string, sender: "ai" | "owner", isFollowUp = false,
): Promise<SendResult> {
  // Hard stop: never message someone who opted out, whatever called us.
  const { data: fresh } = await db.from("leads").select("status, last_outbound_at, sms_consent, do_not_contact").eq("id", lead.id).single();
  if (fresh?.status === "opted_out") return { msg: null, status: "skipped", error: "Lead opted out" };
  if (fresh?.do_not_contact) return { msg: null, status: "skipped", error: "Marked do not contact" };
  // Consent gate: texts only go to people with recorded SMS consent and not on the suppression list.
  if (lead.channel === "sms" && (fresh?.sms_consent !== "granted" || (await isSuppressed(db, business.id, lead.phone)))) {
    return { msg: null, status: "skipped", error: "No SMS consent recorded" };
  }

  // Duplicate protection: never send the exact same text to the same lead twice in a short window.
  const { data: dup } = await db.from("messages").select("id").eq("lead_id", lead.id).eq("business_id", business.id)
    .eq("direction", "outbound").eq("body", body).in("status", ["queued", "sent", "delivered", "failed"]) // not drafts
    .gte("created_at", new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .limit(1).maybeSingle();
  if (dup) {
    log.warn("message.duplicate_suppressed", { businessId: business.id, leadId: lead.id });
    return { msg: null, status: "skipped", error: "Duplicate message suppressed" };
  }

  // Hard daily cap on outbound texts per business (owner + AI): bounds spam, toll fraud and cost.
  if (lead.channel === "sms") {
    const plan = PLANS[business.plan as PlanId] ?? PLANS.trial;
    const { count } = await db.from("messages").select("id", { count: "exact", head: true })
      .eq("business_id", business.id).eq("direction", "outbound").eq("channel", "sms")
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString());
    if ((count ?? 0) >= plan.smsPerDay) {
      log.security("sms.business_daily_cap", { businessId: business.id, cap: plan.smsPerDay });
      await flag(db, business, lead, `Daily text message limit (${plan.smsPerDay}) reached — texting resumes within 24 hours.`, "Daily text limit reached");
      return { msg: null, status: "skipped", error: "Daily text message limit reached" };
    }
  }

  // SMS compliance: the first text we ever send includes opt-out instructions.
  const text = lead.channel === "sms" && !fresh?.last_outbound_at && !/\bSTOP\b/.test(body) ? body + SMS_OPT_OUT_FOOTER : body;

  // Record first (status queued) so a crash mid-send is visible and never silently retried.
  const { data: msg, error: insertError } = await db.from("messages").insert({
    business_id: business.id, lead_id: lead.id, direction: "outbound", sender, channel: lead.channel, body: text,
    status: "queued", is_follow_up: isFollowUp,
  }).select().single();
  if (insertError || !msg) {
    // The database refuses to record a text without consent (trigger) — and we never send what we couldn't record.
    log.security("message.blocked_by_database", { businessId: business.id, leadId: lead.id, code: insertError?.code });
    return { msg: null, status: "skipped", error: "No SMS consent recorded" };
  }
  const res = await sendToChannel({ channel: lead.channel, to: lead.phone, from: business.sms_number, body: text });
  await db.from("messages").update({ status: res.status, provider_message_id: res.providerId ?? null, error: res.error ?? null })
    .eq("id", msg!.id);

  const now = new Date().toISOString();
  await db.from("leads").update({
    last_message_at: now, last_outbound_at: now, last_message_preview: preview(text),
    first_response_at: lead.first_response_at ?? now, ai_retry_count: 0,
    status: lead.status === "new" ? "contacted" : lead.status,
  }).eq("id", lead.id).eq("business_id", business.id);

  if (res.status === "failed") {
    // No automatic resend: the provider may have accepted it before failing, and a duplicate text is worse.
    log.error("message.send_failed", { businessId: business.id, leadId: lead.id, channel: lead.channel, error: res.error });
    await logEvent(db, lead, "send_failed", { error: res.error });
    await flag(db, business, lead, `A message to ${lead.name} could not be delivered (${res.error}). Please contact them another way.`,
      `Message to ${lead.name} failed`);
  }
  return { msg: { ...msg!, status: res.status } as Message, status: res.status, error: res.error };
}

// ─────────────────────────── follow-ups ───────────────────────────
export async function cancelPendingFollowUps(db: DB, lead: Pick<Lead, "id" | "business_id">, note: string) {
  await db.from("follow_ups").update({ status: "cancelled", processed_at: new Date().toISOString(), note })
    .eq("lead_id", lead.id).eq("business_id", lead.business_id).eq("status", "pending");
  await db.from("leads").update({ next_follow_up_at: null }).eq("id", lead.id).eq("business_id", lead.business_id);
}

async function scheduleNextFollowUp(db: DB, business: Business, lead: Lead, step: number) {
  const plan = PLANS[business.plan as PlanId] ?? PLANS.trial;
  const delays = business.follow_up_delays_hours.slice(0, Math.min(plan.maxFollowUps, 8));
  // Never more than one pending follow-up per lead.
  await cancelPendingFollowUps(db, lead, "Rescheduled");
  if (step >= delays.length) return null;
  const at = outsideQuietHours(new Date(Date.now() + Math.max(1, delays[step]) * 3600_000), business);
  await db.from("follow_ups").insert({ business_id: business.id, lead_id: lead.id, step, scheduled_for: at.toISOString() });
  await db.from("leads").update({ next_follow_up_at: at.toISOString(), follow_up_step: step })
    .eq("id", lead.id).eq("business_id", business.id);
  return at;
}

// ─────────────────────────── qualification ───────────────────────────
async function applyQualification(db: DB, business: Business, lead: Lead, out: GuardedOutput) {
  if (out.guarded.includes("prompt_injection")) return lead; // don't let an attack change the score
  const temperature = temperatureFromScore(out.score);
  let status = lead.status as LeadStatus;
  if (out.intent === "not_interested") status = "lost";
  else if (out.ready_for_owner) status = "qualified";
  if (isClosed(lead.status)) status = lead.status as LeadStatus;

  const merged = { ...(lead.details as Record<string, string>), ...out.details };
  const details = Object.fromEntries(Object.entries(merged).slice(0, 20).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 300)]));
  const update: Database["public"]["Tables"]["leads"]["Update"] = {
    score: out.score, temperature, status, ai_summary: out.summary.slice(0, 800), details,
  };
  const learnedName = out.details?.Name?.trim();
  if (!firstName(lead.name) && learnedName && SAFE_NAME.test(learnedName)) update.name = learnedName;
  if (out.handoff) {
    update.needs_attention = true;
    update.attention_reason = (out.handoff_reason ?? "The AI needs a team member to help").slice(0, 300);
  }
  if (!lead.estimated_value && business.average_job_value > 0) update.estimated_value = business.average_job_value;
  await db.from("leads").update(update).eq("id", lead.id).eq("business_id", business.id);

  if (lead.score !== out.score || lead.temperature !== temperature) {
    await logEvent(db, lead, "scored", { from: lead.score, to: out.score, temperature });
  }
  const updated = { ...lead, ...update } as Lead;
  if (temperature === "hot" && lead.temperature !== "hot") {
    await notifyOwner(db, business, updated, "hot_lead", `🔥 Hot lead: ${updated.name}`, out.summary || `${updated.name} is ready to talk.`);
  }
  if (out.handoff && !lead.needs_attention) {
    await notifyOwner(db, business, updated, "needs_attention", `${updated.name} needs a reply from you`, update.attention_reason as string);
  }
  return updated;
}

// ─────────────────────────── cost & spam caps ───────────────────────────
async function withinAiBudget(db: DB, business: Business, lead: Lead): Promise<boolean> {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const plan = PLANS[business.plan as PlanId] ?? PLANS.trial;
  const { count: bizCount } = await db.from("messages").select("id", { count: "exact", head: true })
    .eq("business_id", business.id).eq("sender", "ai").gte("created_at", since);
  if ((bizCount ?? 0) >= plan.aiMessagesPerDay) {
    log.security("ai.business_daily_cap", { businessId: business.id, cap: plan.aiMessagesPerDay });
    await flag(db, business, lead, `Daily assistant limit (${plan.aiMessagesPerDay} messages) reached — please reply yourself or upgrade.`,
      "Daily assistant limit reached");
    return false;
  }
  if (plan.id === "trial" && !(await limit("trialAiGlobal", "all"))) {
    await flag(db, business, lead, "The assistant is temporarily unavailable on free trials. Please reply yourself.");
    return false;
  }
  const { count: leadCount } = await db.from("messages").select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id).eq("business_id", business.id).eq("sender", "ai").gte("created_at", since);
  if ((leadCount ?? 0) >= Math.min(LEAD_AI_MESSAGES_PER_DAY, business.max_ai_messages_per_lead_per_day)) {
    log.security("ai.lead_daily_cap", { businessId: business.id, leadId: lead.id });
    await db.from("leads").update({ ai_paused: true }).eq("id", lead.id).eq("business_id", business.id);
    await cancelPendingFollowUps(db, lead, "Lead message cap reached");
    await flag(db, business, lead, "Unusually long conversation — the assistant paused itself. Please take a look.",
      `Assistant paused for ${lead.name}`);
    return false;
  }
  return true;
}

/** Auto-responder loop: the same inbound text 3 times in a row within 15 minutes. */
function looksLikeBotLoop(messages: Message[]) {
  const inbound = messages.filter((m) => m.direction === "inbound").slice(-3);
  return inbound.length === 3 && new Set(inbound.map((m) => m.body.trim().toLowerCase())).size === 1 &&
    Date.now() - new Date(inbound[0].created_at).getTime() < 15 * 60_000;
}

// ─────────────────────────── the AI turn ───────────────────────────
export type TurnResult =
  | { status: "sent"; message: Message | null; output: GuardedOutput }
  | { status: "drafted"; message: Message | null; output: GuardedOutput }
  | { status: "busy" | "skipped" | "blocked" | "ai_failed" };

const SAFE_ACK = (b: Business, lead: Lead) =>
  `Hi${firstName(lead.name) ? ` ${firstName(lead.name)}` : ""}, thanks for your message to ${b.name}. A member of the team will get back to you shortly.`;

async function aiRespond(db: DB, leadId: string, mode: AiMode, followUpStep?: number, depth = 0): Promise<TurnResult> {
  const { data: claimed, error } = await db.rpc("claim_lead_turn", { p_lead: leadId, p_seconds: 90 });
  if (error) { log.error("engine.lock_failed", { leadId, error: error.message }); return { status: "busy" }; }
  if (!claimed) return { status: "busy" }; // the lock holder will re-run for us

  let result: TurnResult = { status: "skipped" };
  try {
    result = await aiRespondLocked(db, leadId, mode, followUpStep);
  } finally {
    const { data: again } = await db.rpc("release_lead_turn", { p_lead: leadId });
    if (again && depth < 2) {
      const rerun = await aiRespond(db, leadId, "reply", undefined, depth + 1);
      if (result.status !== "sent") result = rerun;
    }
  }
  return result;
}

async function aiRespondLocked(db: DB, leadId: string, mode: AiMode, followUpStep?: number): Promise<TurnResult> {
  const { lead, business, messages } = await loadContext(db, leadId);
  const billing = billingState(business);
  if (!billing.active) {
    await flag(db, business, lead, billing.reason ?? "Subscription inactive");
    return { status: "blocked" };
  }
  if (lead.ai_paused || isClosed(lead.status) || lead.do_not_contact) return { status: "skipped" };
  if (business.ai_mode === "off") return { status: "skipped" }; // business-wide kill switch
  if (lead.channel === "sms" && lead.sms_consent !== "granted") {
    // No consent → no AI call at all (no cost, no text). The owner can record consent or contact them another way.
    if (!lead.needs_attention) {
      await flag(db, business, lead, "No SMS consent is recorded for this person, so the assistant won't text them. Record consent or contact them another way.",
        `${lead.name}: no SMS consent recorded`);
    }
    return { status: "blocked" };
  }
  const review = business.ai_mode === "review";
  if (review && mode === "follow_up") return { status: "skipped" }; // automatic follow-ups only run in Auto mode

  // Idempotency: only act if the conversation is actually in the state this turn expects.
  const last = messages.at(-1);
  const hasOutbound = messages.some((m) => m.direction === "outbound");
  if (mode === "reply" && !hasOutbound) mode = "first_reply"; // e.g. a new person texting in: greet them
  if (mode === "first_reply" && hasOutbound) return { status: "skipped" };
  // Review mode: one pending draft per lead (a newer turn replaces an older unapproved draft).
  const pendingDraft = messages.find((m) => m.status === "draft");
  if (mode === "reply" && last?.direction !== "inbound") return { status: "skipped" };
  if (mode === "follow_up" && last?.direction === "inbound") return { status: "skipped" };

  if (mode === "reply" && looksLikeBotLoop(messages)) {
    log.security("engine.bot_loop_detected", { businessId: business.id, leadId: lead.id });
    await db.from("leads").update({ ai_paused: true }).eq("id", lead.id).eq("business_id", business.id);
    await flag(db, business, lead, "This looks like an automated reply loop — the assistant paused itself.", `Assistant paused for ${lead.name}`);
    return { status: "blocked" };
  }
  if (!(await withinAiBudget(db, business, lead))) return { status: "blocked" };

  let out: GuardedOutput;
  try {
    out = await runAiTurn({ business, lead, messages, mode, followUpStep });
  } catch (e) {
    if (!(e instanceof AiUnavailableError)) throw e;
    await logEvent(db, lead, "ai_failed", { mode });
    if (mode === "follow_up") return { status: "ai_failed" }; // caller reschedules; nothing is sent
    // Don't leave the lead hanging: one polite holding reply, and a human is alerted.
    const ackedRecently = messages.some((m) => m.direction === "outbound" && m.body.startsWith(SAFE_ACK(business, lead).slice(0, 30)) &&
      Date.now() - new Date(m.created_at).getTime() < 86400_000);
    if (!ackedRecently && !review) await sendOutbound(db, business, lead, SAFE_ACK(business, lead), "ai");
    await flag(db, business, lead, `The assistant couldn't reply (AI service unavailable). Please reply to ${lead.name} yourself.`,
      `${lead.name} needs a reply from you`);
    return { status: "ai_failed" };
  }

  if (review) {
    // Review mode: store the AI's message as a DRAFT for the owner to approve, edit or discard. Nothing is sent.
    if (pendingDraft) await db.from("messages").update({ status: "discarded" }).eq("id", pendingDraft.id).eq("status", "draft");
    const { data: draft } = await db.from("messages").insert({
      business_id: business.id, lead_id: lead.id, direction: "outbound", sender: "ai", channel: lead.channel,
      body: out.reply, status: "draft", is_follow_up: false,
    }).select().single();
    if (out.guarded.length) await logEvent(db, lead, "ai_guarded", { rules: out.guarded });
    const { data: fresh } = await db.from("leads").select("*").eq("id", lead.id).single();
    await applyQualification(db, business, fresh ?? lead, out);
    await db.from("leads").update({ needs_attention: true, attention_reason: "The assistant drafted a reply — review and send it." })
      .eq("id", lead.id).eq("business_id", business.id);
    if (!lead.needs_attention) await notifyOwner(db, business, lead, "needs_attention", `Draft reply ready for ${lead.name}`, "Review and approve the assistant's reply.");
    return { status: "drafted", message: draft as Message, output: out };
  }

  const sent = await sendOutbound(db, business, lead, out.reply, "ai", mode === "follow_up");
  if (sent.status === "skipped") return { status: "skipped" };
  if (out.guarded.length) await logEvent(db, lead, "ai_guarded", { rules: out.guarded });
  const { data: fresh } = await db.from("leads").select("*").eq("id", lead.id).single();
  const updated = await applyQualification(db, business, fresh ?? lead, out);

  if (out.intent === "opt_out") {
    await db.from("leads").update({ status: "opted_out", ai_paused: true, sms_consent: "revoked", sms_consent_at: new Date().toISOString(), sms_consent_source: "ai_detected_opt_out" })
      .eq("id", lead.id).eq("business_id", business.id);
    await recordConsent(db, { businessId: business.id, leadId: lead.id, phone: lead.phone, action: "revoked", basis: "ai_detected_opt_out" });
    await cancelPendingFollowUps(db, lead, "Lead opted out");
  } else if (mode !== "follow_up") {
    // Only nudge when the ball is in the lead's court (not when they're waiting on the business).
    if (!out.ready_for_owner && !out.handoff && out.intent !== "not_interested" && !out.guarded.includes("prompt_injection")) {
      await scheduleNextFollowUp(db, business, updated, 0);
    }
  }
  return { status: "sent", message: sent.msg, output: out };
}

// ─────────────────────────── public API: leads ───────────────────────────
export interface NewLeadInput {
  name: string; phone?: string | null; email?: string | null; source?: string; channel?: "sms" | "test";
  service_requested?: string | null; location?: string | null; initial_message?: string | null;
  estimated_value?: number | null;
  /** SMS consent captured at creation (web-form checkbox, owner attestation, or the person texting us first). */
  consent?: { basis: "web_form_checkbox" | "owner_attestation" | "inbound_message" | "api"; evidence?: Record<string, unknown> };
}

/** Creates a lead (or returns a very recent duplicate) and, unless told otherwise, starts the conversation. */
export async function createLead(businessId: string, input: NewLeadInput, opts: { startAi?: boolean } = {}) {
  const db = createAdminClient();
  const { data: business } = await db.from("businesses").select("*").eq("id", businessId).single();
  if (!business) throw new NotFoundError("Business not found");
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;

  // Idempotency: the same person submitting twice (double click, Zapier retry) → one lead, one first message.
  if (phone || email) {
    const findRecent = async () => {
      const since = new Date(Date.now() - LEAD_DEDUPE_WINDOW_MS).toISOString();
      let q = db.from("leads").select("*").eq("business_id", businessId).gte("created_at", since);
      q = phone ? q.eq("phone", phone) : q.eq("email", email!);
      return (await q.order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    };
    let existing = await findRecent();
    // Concurrent submissions: an atomic claim on (business, contact, 10-min bucket) lets exactly one through.
    if (!existing && !(await claimEvent("lead_dedupe", `${businessId}:${phone ?? email}:${Math.floor(Date.now() / LEAD_DEDUPE_WINDOW_MS)}`))) {
      for (let i = 0; i < 20 && !existing; i++) { await new Promise((r) => setTimeout(r, 150)); existing = await findRecent(); }
    }
    if (existing) {
      log.info("lead.deduplicated", { businessId, leadId: existing.id });
      return { ...existing, deduplicated: true as const };
    }
  }

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("leads").select("id", { count: "exact", head: true })
    .eq("business_id", businessId).gte("created_at", monthStart.toISOString());
  const billing = billingState(business);
  const overLimit = (count ?? 0) >= billing.plan.leadLimit;
  const blockedReason = !billing.active ? billing.reason ?? null
    : overLimit ? `Monthly limit of ${billing.plan.leadLimit} leads reached — upgrade to keep the assistant replying.` : null;
  const channel = input.channel === "sms" && phone ? "sms" : "test";
  const suppressed = channel === "sms" && (await isSuppressed(db, businessId, phone));
  const initial = redactSensitive(stripInvisible(input.initial_message ?? "").trim().slice(0, 2000));

  const { data: lead, error } = await db.from("leads").insert({
    business_id: businessId,
    name: stripInvisible(input.name).trim().slice(0, 100) || UNKNOWN_LEAD_NAME,
    phone, email,
    source: (input.source ?? "manual").slice(0, 30),
    channel,
    service_requested: stripInvisible(input.service_requested ?? "").trim().slice(0, 120) || null,
    location: stripInvisible(input.location ?? "").trim().slice(0, 120) || null,
    initial_message: initial.text || null,
    // A previously opted-out number is never treated as consenting, even if a new form says otherwise.
    sms_consent: suppressed ? "revoked" : "none",
    estimated_value: input.estimated_value ?? (business.average_job_value > 0 ? business.average_job_value : null),
    ai_paused: !business.ai_enabled_by_default || Boolean(blockedReason),
    needs_attention: Boolean(blockedReason),
    attention_reason: blockedReason,
  }).select().single();
  if (error || !lead) {
    log.error("lead.create_failed", { businessId, error: error?.message });
    throw new Error("Could not create lead");
  }
  log.info("lead.created", { businessId, leadId: lead.id, source: lead.source, channel });

  await logEvent(db, lead, "created", { source: lead.source, channel: lead.channel });
  if (initial.redacted.length) await logEvent(db, lead, "sensitive_data_redacted", { kinds: initial.redacted });
  if (suppressed) {
    await db.from("leads").update({ needs_attention: true, attention_reason: "This number previously opted out of texts. The assistant won't text them." })
      .eq("id", lead.id);
    lead.sms_consent = "revoked";
  } else if (channel === "sms" && input.consent) {
    await recordConsent(db, { businessId, leadId: lead.id, phone, action: "granted", basis: input.consent.basis, evidence: input.consent.evidence });
    lead.sms_consent = "granted";
  }
  if (lead.initial_message) {
    await db.from("messages").insert({
      business_id: businessId, lead_id: lead.id, direction: "inbound", sender: "lead",
      channel: lead.channel, body: lead.initial_message, status: "received",
    });
  }
  if (blockedReason && overLimit) {
    await notifyOwner(db, business, lead, "limit_reached", "Lead limit reached", blockedReason);
  }
  if (opts.startAi !== false && !lead.ai_paused) await aiRespond(db, lead.id, "first_reply");
  return { ...lead, deduplicated: false as const };
}

/** Sends the assistant's first message (used when a lead was created with startAi: false). Idempotent. */
export async function startConversation(leadId: string) {
  return aiRespond(createAdminClient(), leadId, "first_reply");
}

/**
 * Durably stores an inbound message. Idempotent per provider message ID (Twilio retries are no-ops).
 * Returns whether the AI should now respond.
 */
export async function recordInbound(leadId: string, rawBody: string, channel: string, providerId?: string) {
  const db = createAdminClient();
  const { lead, business } = await loadContext(db, leadId);
  const { text: body, redacted } = redactSensitive(stripInvisible(rawBody).slice(0, MAX_INBOUND_CHARS));
  if (redacted.length) log.info("message.sensitive_redacted", { businessId: business.id, leadId, kinds: redacted });
  const now = new Date().toISOString();

  const { error } = await db.from("messages").insert({
    business_id: lead.business_id, lead_id: lead.id, direction: "inbound", sender: "lead",
    channel, body, status: "received", provider_message_id: providerId ?? null,
  });
  if (error?.code === "23505") {
    log.info("message.duplicate_inbound_ignored", { businessId: business.id, leadId });
    return { duplicate: true, respond: false } as const;
  }
  if (error) throw new Error("Could not store inbound message");

  // OPT-OUT FIRST — before anything else, and as ONE atomic write of status + consent, so there is no window in
  // which a concurrent request (e.g. the AI replying to an earlier message) can still text this person.
  if (lead.status !== "opted_out" && (detectOptOut(body) || OPT_OUT_PHRASE.test(body))) {
    await db.from("leads").update({
      status: "opted_out", ai_paused: true, temperature: "cold", sms_consent: "revoked", sms_consent_at: now, sms_consent_source: "keyword_stop",
      last_inbound_at: now, last_message_at: now, last_message_preview: preview(body),
    }).eq("id", lead.id).eq("business_id", business.id);
    await recordConsent(db, { businessId: business.id, leadId: lead.id, phone: lead.phone, action: "revoked", basis: "keyword_stop",
      evidence: { message_excerpt: body.trim().slice(0, 60) } });
    await cancelPendingFollowUps(db, lead, "Lead opted out");
    await logEvent(db, lead, "opted_out");
    log.info("lead.opted_out", { businessId: business.id, leadId: lead.id });
    return { duplicate: false, respond: false } as const; // carriers send the STOP confirmation; we never message again
  }

  // Opted-out lead texting START/UNSTOP/YES → opted back in (AI stays paused; the owner decides).
  if (lead.status === "opted_out") {
    if (OPT_IN.test(body) && channel === "sms") {
      await recordConsent(db, { businessId: business.id, leadId: lead.id, phone: lead.phone, action: "reinstated", basis: "keyword_start", evidence: { keyword: body.trim().slice(0, 20) } });
      await db.from("leads").update({ status: "engaged", last_inbound_at: now, last_message_at: now, last_message_preview: preview(body) })
        .eq("id", lead.id).eq("business_id", business.id);
      await logEvent(db, lead, "opted_in");
      await notifyOwner(db, business, lead, "lead_replied", `${lead.name} opted back in`, "They can be messaged again. The assistant is still paused.");
    }
    return { duplicate: false, respond: false } as const;
  }

  // The person texted the business themselves → consent to reply by text about their enquiry (never after an opt-out).
  if (channel === "sms" && lead.sms_consent === "none" && !(await isSuppressed(db, business.id, lead.phone))) {
    await recordConsent(db, { businessId: business.id, leadId: lead.id, phone: lead.phone, action: "granted", basis: "inbound_message",
      evidence: { message_sid: providerId ?? null } });
  }
  await cancelPendingFollowUps(db, lead, "Lead replied");
  await db.from("leads").update({ last_inbound_at: now, last_message_at: now, last_message_preview: preview(body), follow_up_step: 0 })
    .eq("id", lead.id).eq("business_id", business.id);
  // Status transition decided by the database row's CURRENT value, not our possibly-stale copy.
  await db.from("leads").update({ status: "engaged" }).eq("id", lead.id).eq("business_id", business.id).in("status", ["new", "contacted", "unresponsive"]);

  if (lead.ai_paused || isClosed(lead.status)) {
    await db.from("leads").update({ needs_attention: true, attention_reason: "Lead replied while the assistant is paused" })
      .eq("id", lead.id).eq("business_id", business.id);
    await notifyOwner(db, business, lead, "lead_replied", `${lead.name} replied`, preview(body));
    return { duplicate: false, respond: false } as const;
  }
  return { duplicate: false, respond: true } as const;
}

export async function respondToLead(leadId: string) {
  return aiRespond(createAdminClient(), leadId, "reply");
}

/** Inbound + immediate response (in-app test chat). */
export async function handleInbound(leadId: string, body: string, channel: string, providerId?: string) {
  const r = await recordInbound(leadId, body, channel, providerId);
  return r.respond ? respondToLead(leadId) : null;
}

// ─────────────────────────── public API: owner actions (always business-scoped) ───────────────────────────
export async function sendOwnerMessage(businessId: string, leadId: string, body: string) {
  const db = createAdminClient();
  const { lead, business } = await loadContext(db, leadId, businessId);
  if (lead.status === "opted_out") throw new Error("This lead opted out of messages.");
  const result = await sendOutbound(db, business, lead, body.slice(0, 1000), "owner");
  if (result.status === "skipped") return result;
  if (!lead.ai_paused) await logEvent(db, lead, "owner_took_over");
  await db.from("leads").update({ ai_paused: true, needs_attention: result.status === "failed", ...(result.status !== "failed" ? { attention_reason: null } : {}) })
    .eq("id", lead.id).eq("business_id", businessId);
  await cancelPendingFollowUps(db, lead, "Owner took over");
  return result;
}

export async function setAiPaused(businessId: string, leadId: string, paused: boolean) {
  const db = createAdminClient();
  const { lead, business } = await loadContext(db, leadId, businessId);
  if (!paused && lead.status === "opted_out") throw new Error("This lead opted out — the assistant can't message them.");
  await db.from("leads").update({ ai_paused: paused }).eq("id", lead.id).eq("business_id", businessId);
  await logEvent(db, lead, paused ? "ai_paused" : "ai_resumed");
  if (paused) {
    await cancelPendingFollowUps(db, lead, "AI paused");
  } else if (!isClosed(lead.status)) {
    // On resume: answer an unanswered message, start a never-started conversation, or reschedule nudges.
    const { data: last } = await db.from("messages").select("direction").eq("lead_id", lead.id).eq("business_id", businessId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { count: outCount } = await db.from("messages").select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id).eq("direction", "outbound");
    if (!outCount) await aiRespond(db, lead.id, "first_reply");
    else if (last?.direction === "inbound") await aiRespond(db, lead.id, "reply");
    else await scheduleNextFollowUp(db, business, { ...lead, ai_paused: false }, 0);
  }
}

export async function closeLead(businessId: string, leadId: string, outcome: "won" | "lost", value?: number | null) {
  const db = createAdminClient();
  const { lead } = await loadContext(db, leadId, businessId);
  await db.from("leads").update({
    status: outcome, closed_at: new Date().toISOString(), needs_attention: false, attention_reason: null,
    ...(value != null && Number.isFinite(value) ? { estimated_value: value } : {}),
  }).eq("id", lead.id).eq("business_id", businessId);
  await cancelPendingFollowUps(db, lead, `Marked ${outcome}`);
  await logEvent(db, lead, `marked_${outcome}`, value != null ? { value } : {});
}

export async function reopenLead(businessId: string, leadId: string) {
  const db = createAdminClient();
  const { lead } = await loadContext(db, leadId, businessId);
  if (lead.status === "opted_out") throw new Error("Opted-out leads can't be reopened.");
  await db.from("leads").update({ status: lead.last_inbound_at ? "engaged" : "contacted", closed_at: null })
    .eq("id", lead.id).eq("business_id", businessId);
  await logEvent(db, lead, "reopened");
}

export async function resolveAttention(businessId: string, leadId: string) {
  const db = createAdminClient();
  const { lead } = await loadContext(db, leadId, businessId);
  await db.from("leads").update({ needs_attention: false, attention_reason: null }).eq("id", lead.id).eq("business_id", businessId);
}

/** GDPR erasure: permanently deletes a lead and (by cascade) its messages, follow-ups, events and alerts. */
export async function deleteLead(businessId: string, leadId: string) {
  const db = createAdminClient();
  await loadContext(db, leadId, businessId);
  const { error } = await db.from("leads").delete().eq("id", leadId).eq("business_id", businessId);
  if (error) throw new Error("Could not delete lead");
  log.info("lead.deleted", { businessId, leadId });
}

// ─────────────────────────── review workflow, consent & data controls (owner, business-scoped) ───────────────────────────
/** Approve (optionally edited) AI draft → sent. Keeps the AI's original text if the owner edited it. */
export async function approveDraft(businessId: string, leadId: string, messageId: string, userId: string, editedBody?: string) {
  const db = createAdminClient();
  const { lead, business } = await loadContext(db, leadId, businessId);
  const { data: draft } = await db.from("messages").select("*").eq("id", messageId).eq("lead_id", lead.id)
    .eq("business_id", businessId).eq("status", "draft").maybeSingle();
  if (!draft) throw new NotFoundError("Draft not found");
  const body = (editedBody ?? draft.body).trim().slice(0, 1000);
  // Discard the draft row first so the duplicate guard and history stay clean, then send as a normal message.
  await db.from("messages").update({ status: "discarded" }).eq("id", draft.id).eq("status", "draft");
  const res = await sendOutbound(db, business, lead, body, "ai");
  if (res.status === "skipped" || !res.msg) {
    await db.from("messages").update({ status: "draft" }).eq("id", draft.id); // restore so nothing is lost
    return res;
  }
  await db.from("messages").update({
    approved_by: userId, approved_at: new Date().toISOString(), original_body: body !== draft.body ? draft.body : null,
  }).eq("id", res.msg.id);
  await db.from("messages").delete().eq("id", draft.id).eq("status", "discarded"); // the sent copy carries the provenance
  await db.from("leads").update({ needs_attention: false, attention_reason: null }).eq("id", lead.id).eq("business_id", businessId);
  await audit(db, { businessId, actor: "user", userId, action: body !== draft.body ? "draft.edited_and_sent" : "draft.approved", targetType: "message", targetId: res.msg.id });
  return res;
}

export async function discardDraft(businessId: string, leadId: string, messageId: string, userId: string) {
  const db = createAdminClient();
  await loadContext(db, leadId, businessId);
  await db.from("messages").update({ status: "discarded" }).eq("id", messageId).eq("lead_id", leadId).eq("business_id", businessId).eq("status", "draft");
  await db.from("leads").update({ needs_attention: false, attention_reason: null }).eq("id", leadId).eq("business_id", businessId);
  await audit(db, { businessId, actor: "user", userId, action: "draft.discarded", targetType: "message", targetId: messageId });
}

/** The owner confirms the person asked to be contacted by text (with a note of how). Never overrides an opt-out. */
export async function recordOwnerConsent(businessId: string, leadId: string, userId: string, note: string) {
  const db = createAdminClient();
  const { lead } = await loadContext(db, leadId, businessId);
  if (lead.status === "opted_out" || lead.sms_consent === "revoked" || (await isSuppressed(db, businessId, lead.phone))) {
    throw new Error("This person opted out. Only they can opt back in (by texting START).");
  }
  if (!lead.phone) throw new Error("This lead has no phone number.");
  await recordConsent(db, { businessId, leadId, phone: lead.phone, action: "granted", basis: "owner_attestation",
    evidence: { attested_by: userId, note: note.slice(0, 300) } });
  await db.from("leads").update({ channel: "sms" }).eq("id", leadId).eq("business_id", businessId);
  await audit(db, { businessId, actor: "user", userId, action: "consent.recorded_by_owner", targetType: "lead", targetId: leadId });
}

export async function markDoNotContact(businessId: string, leadId: string, userId: string) {
  const db = createAdminClient();
  const { lead } = await loadContext(db, leadId, businessId);
  await db.from("leads").update({ do_not_contact: true, ai_paused: true }).eq("id", leadId).eq("business_id", businessId);
  await recordConsent(db, { businessId, leadId, phone: lead.phone, action: "revoked", basis: "owner_marked_do_not_contact", evidence: { by: userId } });
  await cancelPendingFollowUps(db, lead, "Marked do not contact");
  await audit(db, { businessId, actor: "user", userId, action: "lead.do_not_contact", targetType: "lead", targetId: leadId });
}

/** Business-wide AI mode. "off" is the kill switch: stops all AI and cancels every pending automatic follow-up. */
export async function setBusinessAiMode(businessId: string, mode: "auto" | "review" | "off", userId: string) {
  const db = createAdminClient();
  await db.from("businesses").update({
    ai_mode: mode, ...(mode === "auto" ? { ai_mode_acknowledged_at: new Date().toISOString(), ai_mode_acknowledged_by: userId } : {}),
  }).eq("id", businessId);
  if (mode !== "auto") {
    await db.from("follow_ups").update({ status: "cancelled", processed_at: new Date().toISOString(), note: `AI mode: ${mode}` })
      .eq("business_id", businessId).eq("status", "pending");
    await db.from("leads").update({ next_follow_up_at: null }).eq("business_id", businessId);
  }
  await audit(db, { businessId, actor: "user", userId, action: `ai_mode.${mode}` });
  log.info("audit.ai_mode_changed", { businessId, mode, userId });
}

/** Everything held about a business's customers, as JSON (data portability / access requests). */
export async function exportBusinessData(businessId: string, opts: { leadId?: string } = {}) {
  const db = createAdminClient();
  const scope = <T extends { eq: (c: string, v: string) => T }>(q: T) => (opts.leadId ? q.eq("lead_id", opts.leadId) : q);
  const leadsQ = db.from("leads").select("*").eq("business_id", businessId);
  const [{ data: business }, { data: leads }, { data: messages }, { data: consent }, { data: events }, { data: followUps }] = await Promise.all([
    db.from("businesses").select("id, name, industry, description, services, service_areas, opening_hours, faqs, contact_phone, contact_email, website, booking_link, tone, timezone, ai_mode, retention_days, created_at").eq("id", businessId).single(),
    opts.leadId ? leadsQ.eq("id", opts.leadId) : leadsQ,
    scope(db.from("messages").select("lead_id, created_at, direction, sender, channel, body, status, approved_at, original_body").eq("business_id", businessId).neq("status", "discarded")),
    scope(db.from("consent_events").select("lead_id, channel, action, basis, evidence, created_at").eq("business_id", businessId)),
    scope(db.from("lead_events").select("lead_id, type, data, created_at").eq("business_id", businessId)),
    scope(db.from("follow_ups").select("lead_id, step, scheduled_for, status, processed_at").eq("business_id", businessId)),
  ]);
  return {
    exported_at: new Date().toISOString(), format_version: 1,
    note: "Messages with sender 'ai' were generated by the assistant; 'owner' by the business; 'lead' by the customer. 'original_body' is the AI draft before the business edited it.",
    business: opts.leadId ? undefined : business, leads, messages, consent_events: consent, lead_events: events, follow_ups: followUps,
  };
}

/** Closes the account: deletes the business and ALL its customer data (cascade), then the owner's login. */
export async function deleteBusinessAccount(businessId: string, userId: string) {
  const db = createAdminClient();
  const { error } = await db.from("businesses").delete().eq("id", businessId);
  if (error) throw new Error("Could not delete account data");
  await db.auth.admin.deleteUser(userId);
  log.info("audit.account_deleted", { businessId, userId }); // audit rows were deleted with the business; keep a log line
}

// ─────────────────────────── background processing (cron) ───────────────────────────
const FOLLOW_UP_MAX_ATTEMPTS = 3;

/** Sends due follow-ups. Safe to run concurrently: each follow-up is claimed atomically. */
export async function processDueFollowUps(max = 25) {
  const db = createAdminClient();
  const { data: due } = await db.from("follow_ups").select("id")
    .eq("status", "pending").lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for").limit(max);

  const results: { id: string; outcome: string }[] = [];
  for (const { id } of due ?? []) {
    const { data: claimed } = await db.from("follow_ups").update({ status: "processing" })
      .eq("id", id).eq("status", "pending").select().maybeSingle();
    if (!claimed) continue; // another worker got it

    const done = (status: "sent" | "skipped" | "failed", note?: string, messageId?: string | null) =>
      db.from("follow_ups").update({ status, processed_at: new Date().toISOString(), note: note ?? null, message_id: messageId ?? null }).eq("id", id);
    try {
      const { lead, business } = await loadContext(db, claimed.lead_id, claimed.business_id);
      const skip = lead.ai_paused ? "AI paused" : isClosed(lead.status) ? `Lead ${lead.status}` : null;
      if (skip) { await done("skipped", skip); results.push({ id, outcome: "skipped" }); continue; }

      const r = await aiRespond(db, lead.id, "follow_up", claimed.step);
      if (r.status === "busy" || r.status === "ai_failed") {
        const attempts = claimed.attempts + 1;
        if (attempts >= FOLLOW_UP_MAX_ATTEMPTS) {
          await done("failed", r.status === "busy" ? "Lead busy" : "AI unavailable");
          await flag(db, business, lead, `An automatic follow-up to ${lead.name} couldn't be sent. Consider contacting them yourself.`);
        } else {
          await db.from("follow_ups").update({ status: "pending", attempts, scheduled_for: new Date(Date.now() + 15 * 60_000).toISOString() }).eq("id", id);
        }
        results.push({ id, outcome: `retry:${r.status}` });
        continue;
      }
      if (r.status !== "sent") { await done("skipped", r.status); results.push({ id, outcome: "skipped" }); continue; }
      await done("sent", undefined, r.message?.id);
      const nextAt = await scheduleNextFollowUp(db, business, lead, claimed.step + 1);
      if (!nextAt) {
        await db.from("leads").update({ status: "unresponsive", follow_up_step: claimed.step + 1 })
          .eq("id", lead.id).eq("business_id", business.id).in("status", ["new", "contacted", "engaged"]);
      }
      results.push({ id, outcome: "sent" });
    } catch (e) {
      log.error("followup.failed", { followUpId: id, error: e });
      await done("failed", "Internal error");
      results.push({ id, outcome: "failed" });
    }
  }
  return results;
}

/**
 * Recovery sweep: finds conversations a crashed/timed-out request left unanswered and answers them once.
 * Bounded by ai_retry_count so a persistent failure can't loop.
 */
export async function sweepStalledConversations(max = 20) {
  const db = createAdminClient();
  const { data: ids } = await db.rpc("leads_needing_ai", { p_limit: max });
  const results: { leadId: string; outcome: string }[] = [];
  for (const row of ids ?? []) {
    // Per-lead isolation: one tenant's bad data can never stop recovery for other tenants.
    try {
      await db.from("leads").update({ ai_retry_count: row.ai_retry_count + 1 }).eq("id", row.id);
      const r = await aiRespond(db, row.id, row.needs_first_reply ? "first_reply" : "reply");
      log.warn("engine.sweep_recovered", { leadId: row.id, outcome: r.status });
      results.push({ leadId: row.id, outcome: r.status });
    } catch (e) {
      log.error("engine.sweep_failed", { leadId: row.id, error: e });
      results.push({ leadId: row.id, outcome: "failed" });
    }
  }
  return results;
}

/** Housekeeping: drop expired rate-limit windows and old webhook idempotency keys. */
export async function cleanupHousekeeping() {
  const db = createAdminClient();
  await db.from("rate_limits").delete().lt("window_start", new Date(Date.now() - 2 * 86400_000).toISOString());
  await db.from("webhook_events").delete().lt("received_at", new Date(Date.now() - 30 * 86400_000).toISOString());
  // Per-business data retention (leads older than the configured period, with their messages and events).
  const { data: purged, error } = await db.rpc("purge_expired_data");
  if (error) log.error("retention.purge_failed", { error: error.message });
  else if (purged?.length) log.info("retention.purged", { businesses: purged.length, leads: purged.reduce((n, r) => n + r.leads_deleted, 0) });
}

// ─────────────────────────── inbound SMS routing ───────────────────────────
/** To number → business, From number → most recent lead (or a new one). Returns the lead and whether to respond. */
export async function routeInboundSms(to: string, from: string, body: string, sid: string, opts: { rateLimited?: boolean } = {}) {
  const db = createAdminClient();
  const toN = normalizePhone(to), fromN = normalizePhone(from);
  if (!toN || !fromN) return { ok: false as const, reason: "Invalid phone numbers" };
  let { data: business } = await db.from("businesses").select("*").eq("sms_number", toN).maybeSingle();
  if (!business && process.env.TWILIO_PHONE_NUMBER && normalizePhone(process.env.TWILIO_PHONE_NUMBER) === toN) {
    // Shared number (early stage). A reply to it can only belong to a business that TEXTS FROM the shared
    // number (no dedicated number), and specifically the one that last texted this person.
    // (Red-team fix: previously any tenant's most recently active lead with this phone could receive it.)
    const { data: candidates } = await db.from("leads").select("business_id, last_outbound_at, businesses!inner(sms_number)")
      .eq("phone", fromN).is("businesses.sms_number", null).not("last_outbound_at", "is", null)
      .order("last_outbound_at", { ascending: false }).limit(2);
    if (candidates?.length) {
      if (candidates.length > 1 && candidates[0].business_id !== candidates[1].business_id) {
        log.warn("sms.shared_number_ambiguous", { candidates: candidates.length }); // dedicated numbers avoid this
      }
      ({ data: business } = await db.from("businesses").select("*").eq("id", candidates[0].business_id).is("sms_number", null).maybeSingle());
    }
  }
  if (!business) return { ok: false as const, reason: "No business for this number" };

  const { data: existing } = await db.from("leads").select("id").eq("business_id", business.id).eq("phone", fromN)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) {
    const r = await recordInbound(existing.id, body, "sms", sid);
    if (opts.rateLimited && r.respond) {
      const { lead } = await loadContext(db, existing.id, business.id);
      await flag(db, business, lead, "Lots of texts from this number in a short time — the assistant is holding off.");
      return { ok: true as const, leadId: existing.id, respond: false };
    }
    return { ok: true as const, leadId: existing.id, respond: r.respond };
  }
  // A brand-new person texted the business number → new lead (idempotent on the Twilio message SID).
  const { data: seen } = await db.from("messages").select("lead_id").eq("provider_message_id", sid).maybeSingle();
  if (seen) return { ok: true as const, leadId: seen.lead_id, respond: false };
  const lead = await createLead(business.id, {
    name: UNKNOWN_LEAD_NAME, phone: fromN, source: "sms", channel: "sms",
    consent: { basis: "inbound_message", evidence: { message_sid: sid, note: "Person texted the business number first" } },
  }, { startAi: false });
  const r = await recordInbound(lead.id, body, "sms", sid);
  return { ok: true as const, leadId: lead.id, respond: r.respond && !opts.rateLimited, newLead: true };
}
