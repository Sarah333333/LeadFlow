import "server-only";
import { env, integrations } from "@/lib/env";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { firstName } from "@/lib/utils";
import { log } from "@/lib/log";
import { buildKnowledgeBase, buildSystemPrompt, rulesText } from "./prompt";
import { openAiProvider } from "./openai";
import { demoProvider } from "./demo";
import {
  clampScore, detectDanger, detectUrgency, makesUnauthorisedPromise, makesUnverifiedClaim, mentionsUnknownPrice,
} from "./guards";
import { detectPromptInjection, leaksInternals, stripLinks } from "./injection";
import type { AiTurnInput, AiTurnOutput } from "./types";

export * from "./types";

export class AiUnavailableError extends Error {}

export const aiProviderName = () => (integrations.ai() ? "openai" : env.allowDemoAi ? "demo" : "none");

export type GuardedOutput = AiTurnOutput & { guarded: string[] };

/**
 * Runs one AI turn and enforces business-safety rules on the result. The AI proposes; this function decides.
 * Throws AiUnavailableError when no AI could produce a safe answer — the engine then takes the safe path.
 */
export async function runAiTurn(input: AiTurnInput): Promise<GuardedOutput> {
  const { business, lead } = input;
  const known = firstName(lead.name);
  const safeFallback = `Thanks${known ? `, ${known}` : ""} — a member of the ${business.name} team will get back to you on that shortly.`;
  const latestInbound = [...input.messages].reverse().find((m) => m.direction === "inbound")?.body ?? "";

  // 1. Obvious prompt-injection attempts never reach the model.
  if (input.mode === "reply" && detectPromptInjection(latestInbound)) {
    log.security("ai.prompt_injection_suspected", { businessId: business.id, leadId: lead.id });
    return {
      reply: `Sorry${known ? `, ${known}` : ""} — I can only help with enquiries about ${business.name}'s services. What can we help you with?`,
      score: lead.score, summary: lead.ai_summary ?? "", details: {}, intent: "other",
      handoff: false, handoff_reason: null, ready_for_owner: false, guarded: ["prompt_injection"],
    };
  }

  const plan = PLANS[business.plan as PlanId] ?? PLANS.trial;
  const system = buildSystemPrompt(input, plan.customInstructions);
  const provider = integrations.ai() ? openAiProvider : env.allowDemoAi ? demoProvider : null;
  if (!provider) throw new AiUnavailableError("No AI provider configured");

  let out: AiTurnOutput;
  try {
    out = await provider.generate(input, system);
  } catch (err) {
    log.error("ai.request_failed", { businessId: business.id, leadId: lead.id, provider: provider.name, error: err });
    throw new AiUnavailableError("AI request failed");
  }

  // 2. Output guards.
  const guarded: string[] = [];
  const knowledge = buildKnowledgeBase(business);
  const internal = [rulesText(business.name), ...(business.custom_instructions.trim() ? [business.custom_instructions] : [])];

  if (leaksInternals(out.reply, internal) || leaksInternals(out.summary, [business.custom_instructions].filter(Boolean))) {
    log.security("ai.leak_blocked", { businessId: business.id, leadId: lead.id });
    out.reply = safeFallback; out.summary = lead.ai_summary ?? ""; guarded.push("leak");
  }
  if (mentionsUnknownPrice(out.reply, knowledge)) {
    out.reply = safeFallback; out.handoff = true;
    out.handoff_reason = out.handoff_reason ?? "Lead asked about pricing not configured in settings";
    guarded.push("unknown_price");
  }
  if (makesUnauthorisedPromise(out.reply, knowledge)) {
    out.reply = safeFallback; out.handoff = true;
    out.handoff_reason = out.handoff_reason ?? "AI attempted to make a promise it is not allowed to make";
    guarded.push("promise");
  }
  if (makesUnverifiedClaim(out.reply, knowledge)) {
    out.reply = safeFallback; out.handoff = true;
    out.handoff_reason = out.handoff_reason ?? "Customer asked about compliance, certification or safety — please answer personally";
    guarded.push("unverified_claim");
  }
  // AI disclosure: the first message always identifies itself as automated, even if the model forgot.
  if (input.mode === "first_reply" && !/\b(automated|virtual|ai) assistant\b/i.test(out.reply)) {
    out.reply = `This is ${business.name}'s automated assistant. ${out.reply}`;
    guarded.push("disclosure_added");
  }
  if (out.reply.length > 480) { out.reply = out.reply.slice(0, 477).trimEnd() + "…"; guarded.push("too_long"); }

  // 3. Deterministic scoring floors: never let the model miss an obviously hot lead.
  const leadText = `${lead.initial_message ?? ""}\n${latestInbound}`;
  out.score = clampScore(out.score);
  if (detectUrgency(leadText) && out.intent !== "not_interested") {
    out.score = Math.max(out.score, 85); out.ready_for_owner = true;
    out.details = { ...out.details, Urgency: out.details?.Urgency ?? "Urgent" };
  }
  if (detectDanger(latestInbound)) {
    out.handoff = true; out.handoff_reason = out.handoff_reason ?? "Possible safety issue or complaint — please call the lead";
  }
  // Owner-facing fields: no links (a lead could plant phishing via the model).
  out.summary = stripLinks(out.summary);
  out.handoff_reason = out.handoff_reason ? stripLinks(out.handoff_reason) : null;
  out.details = Object.fromEntries(Object.entries(out.details ?? {}).map(([k, v]) => [k, stripLinks(String(v))]));
  if (guarded.length) log.warn("ai.output_guarded", { businessId: business.id, leadId: lead.id, rules: guarded });
  return { ...out, guarded };
}
