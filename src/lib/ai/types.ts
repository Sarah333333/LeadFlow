import type { Business, Lead, Message } from "@/lib/types";

export type AiMode = "first_reply" | "reply" | "follow_up";

export interface AiTurnInput {
  business: Business;
  lead: Lead;
  messages: Message[];          // full history, oldest first
  mode: AiMode;
  followUpStep?: number;        // 0-based, for follow_up mode
}

export type Intent = "interested" | "question" | "booking" | "not_interested" | "opt_out" | "other";

export interface AiTurnOutput {
  reply: string;
  score: number;                // 0-100 purchase intent / fit
  summary: string;              // 1-3 sentences for the owner
  details: Record<string, string>; // extracted facts: {"Urgency": "ASAP", "Roof type": "Slate"}
  intent: Intent;
  handoff: boolean;             // AI could not help → a human must step in
  handoff_reason: string | null;
  ready_for_owner: boolean;     // qualified enough for the owner to call / quote
}

export interface AiProvider {
  name: string;
  generate(input: AiTurnInput, systemPrompt: string): Promise<AiTurnOutput>;
}
