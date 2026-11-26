// Rule-based provider used when OPENAI_API_KEY is not set.
// It is deliberately simple: good enough to demo and test the full workflow end-to-end.
import type { FaqItem, ServiceItem } from "@/lib/types";
import type { AiProvider, AiTurnInput, AiTurnOutput } from "./types";
import { detectNotInterested, detectUrgency } from "./guards";
import { firstName } from "@/lib/utils";

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;

interface Slot { key: string; label: string; question: (svc: string) => string; test: RegExp }
const SLOTS: Slot[] = [
  { key: "problem", label: "Problem", test: /.{25,}/, question: (s) => `Could you tell me a little more about the ${s} job — what's happening and roughly how big the area is?` },
  { key: "location", label: "Location", test: /\b(in|at|near|from|area|county|co\.|dublin|cork|galway|street|road|town)\b/i, question: () => "Which town or area is the property in?" },
  { key: "urgency", label: "Urgency", test: /\b(asap|urgent|today|tomorrow|this week|next week|month|no rush|soon|whenever|emergency|weekend)\b/i, question: () => "How soon are you hoping to get this done?" },
  { key: "best_time", label: "Best time to call", test: /\b(morning|afternoon|evening|anytime|any time|after \d|before \d|\d ?(am|pm))\b/i, question: () => "What's the best time for one of the team to give you a quick call?" },
];

const NAME_SLOT: Slot = {
  key: "name", label: "Name", test: /^(?:(?:hi|hey)[, ]+)?(?:it'?s |i'?m |my name is |this is )?[a-z][a-z' -]{1,30}\.?$/i,
  question: () => "Could I get your name, please?",
};
const cleanName = (t: string) =>
  t.replace(/^(?:(?:hi|hey)[, ]+)?(?:it'?s |i'?m |my name is |this is )/i, "").replace(/\.$/, "").trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const demoProvider: AiProvider = {
  name: "demo",
  async generate({ business: b, lead, messages, mode, followUpStep }: AiTurnInput): Promise<AiTurnOutput> {
    const known = firstName(lead.name);
    const first = known ?? "there";
    const svc = (lead.service_requested || "job").toLowerCase();
    const inbound = messages.filter((m) => m.direction === "inbound").map((m) => m.body);
    const last = inbound.at(-1) ?? "";
    const allLeadText = [lead.initial_message ?? "", ...inbound].join(" \n ");

    const SL = known ? SLOTS : [SLOTS[0], NAME_SLOT, ...SLOTS.slice(1)];
    const details: Record<string, string> = { ...(lead.details as Record<string, string>) };
    if (lead.service_requested) details["Service"] = lead.service_requested;
    if (lead.location) details["Location"] = lead.location;
    // A one-line enquiry ("Roof leaking") is not enough detail — ask for more.
    if (!details["Problem"]) {
      const descriptive = [lead.initial_message ?? "", ...inbound].find((t) => t.length >= 40 && !/\?\s*$/.test(t));
      if (descriptive) details["Problem"] = descriptive;
    }
    // Attribute the latest answer to the slot the assistant just asked about — only if it plausibly answers it.
    const lastOut = [...messages].reverse().find((m) => m.direction === "outbound")?.body ?? "";
    const askedSlot = SL.find((s) => lastOut.includes(s.question(svc).slice(0, 25)));
    if (askedSlot && askedSlot.key !== "problem" && last && askedSlot.test.test(last) && !/\?/.test(last)) {
      details[askedSlot.label] = askedSlot.key === "name" ? cleanName(last) : last;
    }
    for (const s of SL) if (!details[s.label] && s.key !== "problem" && s.key !== "name" && s.test.test(last) && !/\?/.test(last)) details[s.label] = last;

    const urgent = detectUrgency(allLeadText);
    if (urgent) details["Urgency"] = details["Urgency"] ?? "Urgent";
    const missing = SL.filter((s) => !details[s.label]);
    const notInterested = detectNotInterested(last);

    let score = 20 + (SL.length - missing.length) * 15 + (inbound.length ? 5 : 0);
    if (urgent) score = Math.max(score, 88);
    if (notInterested) score = 10;
    score = Math.min(100, score);
    const ready = score >= 80 || missing.length === 0;

    let reply = "";
    let handoff = false;
    let handoff_reason: string | null = null;
    let intent: AiTurnOutput["intent"] = inbound.length ? "interested" : "other";

    if (mode === "first_reply") {
      const q = missing[0]?.question(svc) ?? "When would suit you for a quick call?";
      reply = `Hi ${first}, thanks for contacting ${b.name}. I'm ${b.name}'s automated assistant and can help get this started. ${q}`;
    } else if (mode === "follow_up") {
      const step = followUpStep ?? 0;
      reply = step === 0
        ? `Hi ${first}, just checking in about your ${svc} enquiry with ${b.name}. ${missing[0]?.question(svc) ?? "Would you like someone to give you a call?"}`
        : step === 1
          ? `Hi ${first}, no pressure at all — if you'd still like help with your ${svc}, just reply here${b.booking_link ? ` or pick a time that suits: ${b.booking_link}` : " and the team will take it from there"}.`
          : `Hi ${first}, I'll close off your ${svc} enquiry for now so we don't keep messaging you. If you need ${b.name} in the future, just reply to this number.`;
    } else if (notInterested) {
      intent = "not_interested";
      reply = `No problem at all${known ? `, ${known}` : ""} — thanks for letting us know. If anything changes, just text us here.`;
    } else {
      // Try to answer a question from FAQs / services.
      const isQuestion = /\?|\b(how much|price|cost|do you|can you|are you|what|when)\b/i.test(last);
      let answer = "";
      if (isQuestion) {
        intent = "question";
        const lw = words(last);
        const faq = ((b.faqs as unknown as FaqItem[]) ?? [])
          .map((f) => ({ f, s: overlap(lw, words(f.question)) })).sort((x, y) => y.s - x.s)[0];
        if (/\b(how much|price|cost|quote|charge)\b/i.test(last)) {
          const service = ((b.services as unknown as ServiceItem[]) ?? []).find(
            (s) => s.price_range && overlap(words(`${s.name} ${svc}`), words(`${last} ${svc}`)) > 0);
          answer = service
            ? `A typical ${service.name.toLowerCase()} job is usually ${service.price_range}, but a team member will confirm the exact price once they know the details.`
            : "";
        } else if (faq && faq.s > 0) {
          answer = faq.f.answer;
        }
        if (!answer) {
          handoff = true;
          handoff_reason = `Lead asked: "${last.slice(0, 120)}"`;
          answer = "Good question — I'll ask a team member to get back to you on that.";
        }
      }
      const alreadyHandedOver = messages.some((m) => m.direction === "outbound" && m.body.includes("someone will be in touch"));
      if (ready && alreadyHandedOver) {
        reply = answer || `Thanks${known ? ` ${known}` : ""} — I've added that to your enquiry and the team will see it.`;
      } else if (ready) {
        reply = `${answer ? answer + " " : `Thanks${known ? ` ${known}` : ""}, that's really helpful. `}I've passed this to the ${b.name} team and someone will be in touch shortly${b.booking_link ? ` — or you can pick a time here: ${b.booking_link}` : "."}`;
      } else {
        reply = `${answer || `Thanks${known ? ` ${known}` : ""}.`} ${missing[0].question(svc)}`.trim();
      }
    }

    const summary = `${lead.name} needs ${lead.service_requested ?? "help"}${details["Location"] ? ` in ${details["Location"]}` : ""}. ${urgent ? "Urgent — wants someone ASAP. " : ""}${missing.length ? `Still unknown: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.` : "All key details collected — ready for a call/quote."}`;

    return { reply, score, summary, details, intent, handoff, handoff_reason, ready_for_owner: ready };
  },
};
