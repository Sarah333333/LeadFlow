import "server-only";
import twilio from "twilio";
import { env, integrations } from "@/lib/env";

export type Channel = "sms" | "test";

export interface SendResult { status: "sent" | "failed"; providerId?: string; error?: string }

/** Channel adapter. Add WhatsApp / email here later without touching the engine. */
export async function sendToChannel(opts: {
  channel: string; to: string | null; from: string | null; body: string;
}): Promise<SendResult> {
  if (opts.channel === "test") return { status: "sent" }; // shown in-app only

  if (opts.channel === "sms") {
    if (!integrations.sms()) return { status: "failed", error: "SMS is not configured (missing Twilio credentials)" };
    const from = opts.from ?? env.twilioDefaultNumber;
    if (!from) return { status: "failed", error: "No SMS number assigned to this business" };
    if (!opts.to) return { status: "failed", error: "Lead has no phone number" };
    if (!env.smsAllowedPrefixes.some((p) => opts.to!.startsWith(p))) {
      return { status: "failed", error: "Country not enabled for SMS" };
    }
    try {
      const client = twilio(env.twilioSid, env.twilioToken);
      const msg = await client.messages.create({
        to: opts.to, from, body: opts.body,
        statusCallback: `${env.appUrl}/api/webhooks/twilio/status`,
      });
      return { status: "sent", providerId: msg.sid };
    } catch (e) {
      // Twilio errors carry a numeric code; keep a short, owner-friendly message (no internals).
      const code = (e as { code?: number }).code;
      return { status: "failed", error: code ? `SMS provider error ${code}` : "SMS provider unreachable" };
    }
  }
  return { status: "failed", error: `Unknown channel ${opts.channel}` };
}

export { normalizePhone } from "./phone";
