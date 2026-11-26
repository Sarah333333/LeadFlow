import { after, NextResponse, type NextRequest } from "next/server";
import twilio from "twilio";
import { z } from "zod";
import { env } from "@/lib/env";
import { respondToLead, routeInboundSms } from "@/lib/engine";
import { BodyTooLarge, readBody } from "@/lib/security/http";
import { claimEvent, completeEvent, releaseEvent } from "@/lib/security/idempotency";
import { limit } from "@/lib/security/rate-limit";
import { log } from "@/lib/log";

// Inbound SMS from Twilio. Configure the number's "A message comes in" webhook: POST {APP_URL}/api/webhooks/twilio
const TWIML_OK = () => new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

const inbound = z.object({
  MessageSid: z.string().regex(/^(SM|MM)[0-9a-fA-F]{32}$/),
  From: z.string().min(3).max(32),
  To: z.string().min(3).max(32),
  Body: z.string().max(10_000).default(""),
});

export async function POST(req: NextRequest) {
  let raw: string;
  try { raw = await readBody(req, 64 * 1024); } catch (e) {
    return new NextResponse(e instanceof BodyTooLarge ? "Payload too large" : "Bad request", { status: e instanceof BodyTooLarge ? 413 : 400 });
  }
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!env.twilioToken || !twilio.validateRequest(env.twilioToken, signature, `${env.appUrl}/api/webhooks/twilio`, params)) {
    log.security("webhook.invalid_signature", { provider: "twilio" });
    return new NextResponse("Invalid signature", { status: 403 });
  }
  const parsed = inbound.safeParse(params);
  if (!parsed.success) {
    log.warn("webhook.invalid_payload", { provider: "twilio" });
    return new NextResponse("Bad request", { status: 400 });
  }
  const { MessageSid, From, To, Body } = parsed.data;

  // Idempotency: Twilio may deliver the same message more than once.
  if (!(await claimEvent("twilio", MessageSid))) {
    log.info("webhook.duplicate", { provider: "twilio" });
    return TWIML_OK();
  }
  try {
    const rateLimited = !(await limit("smsInboundPerSender", From));
    // Store the message durably BEFORE replying to Twilio, so it can never be lost.
    const res = await routeInboundSms(To, From, Body, MessageSid, { rateLimited });
    await completeEvent("twilio", MessageSid);
    if (!res.ok) { log.warn("sms.unrouted", { reason: res.reason }); return TWIML_OK(); }
    // Generate the AI reply after responding (Twilio waits max 15s). If this crashes, the cron sweep recovers it.
    if (res.respond) after(() => respondToLead(res.leadId).then(() => undefined).catch((e) => log.error("sms.respond_failed", { leadId: res.leadId, error: e })));
    return TWIML_OK();
  } catch (e) {
    await releaseEvent("twilio", MessageSid);
    log.error("webhook.failed", { provider: "twilio", error: e });
    return new NextResponse("Error", { status: 500 });
  }
}
