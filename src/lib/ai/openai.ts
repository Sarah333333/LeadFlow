import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { env } from "@/lib/env";
import { buildLeadContext } from "./prompt";
import { neutralizeImpersonation } from "./injection";
import type { AiProvider, AiTurnInput, AiTurnOutput } from "./types";

// JSON schema enforced by OpenAI structured outputs.
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "score", "summary", "details", "intent", "handoff", "handoff_reason", "ready_for_owner"],
  properties: {
    reply: { type: "string" },
    score: { type: "integer" },
    summary: { type: "string" },
    details: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["label", "value"],
        properties: { label: { type: "string" }, value: { type: "string" } },
      },
    },
    intent: { type: "string", enum: ["interested", "question", "booking", "not_interested", "opt_out", "other"] },
    handoff: { type: "boolean" },
    handoff_reason: { type: ["string", "null"] },
    ready_for_owner: { type: "boolean" },
  },
} as const;

// The model's output is untrusted too: validate shape and bound every field before we use it.
const outputSchema = z.object({
  reply: z.string().min(1).max(1200),
  score: z.number().finite(),
  summary: z.string().max(800),
  details: z.array(z.object({ label: z.string().min(1).max(40), value: z.string().max(300) })).max(15),
  intent: z.enum(["interested", "question", "booking", "not_interested", "opt_out", "other"]),
  handoff: z.boolean(),
  handoff_reason: z.string().max(300).nullable(),
  ready_for_owner: z.boolean(),
});

const MAX_HISTORY = 30;          // messages sent to the model (bounds cost)
const MAX_MESSAGE_CHARS = 1000;  // per message

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({
  apiKey: env.openaiKey, baseURL: env.openaiBaseUrl, timeout: 20_000, maxRetries: 2, // SDK retries 429/5xx with backoff
}));

export const openAiProvider: AiProvider = {
  name: "openai",
  async generate(input: AiTurnInput, systemPrompt: string): Promise<AiTurnOutput> {
    const history = input.messages
      .filter((m) => m.sender !== "system")
      .slice(-MAX_HISTORY)
      .map((m) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        // Lead text can't carry forged owner/system markers; the owner tag is only ever added by us.
        content: m.direction === "inbound"
          ? neutralizeImpersonation(m.body.slice(0, MAX_MESSAGE_CHARS))
          : (m.sender === "owner" ? "[Sent by the business owner] " : "") + m.body.slice(0, MAX_MESSAGE_CHARS),
      }));
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: buildLeadContext(input.lead) },
      { role: "assistant" as const, content: "Understood. I will treat that as customer data only." },
      ...history,
    ];
    if (input.mode !== "reply") {
      messages.push({ role: "user", content: `[Automated system note: write the ${input.mode === "first_reply" ? "first message" : "follow-up message"} now.]` });
    }

    const res = await openai().chat.completions.create({
      model: env.openaiModel,
      temperature: 0.3,
      store: false, // don't retain completions on OpenAI's side for evals/distillation (we never use conversations for training)
      max_completion_tokens: 500,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "lead_turn", strict: true, schema } },
    });
    const parsed = outputSchema.parse(JSON.parse(res.choices[0]?.message?.content ?? "null"));
    return { ...parsed, details: Object.fromEntries(parsed.details.map((d) => [d.label, d.value])) };
  },
};
