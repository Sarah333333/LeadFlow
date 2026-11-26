import { NextResponse, type NextRequest } from "next/server";
import twilio from "twilio";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/security/http";
import { log } from "@/lib/log";

// Delivery receipts for outbound SMS. Naturally idempotent (sets a status), and never moves a status backwards.
export async function POST(req: NextRequest) {
  let raw: string;
  try { raw = await readBody(req, 32 * 1024); } catch { return new NextResponse("Payload too large", { status: 413 }); }
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  const ok = env.twilioToken && twilio.validateRequest(env.twilioToken, req.headers.get("x-twilio-signature") ?? "",
    `${env.appUrl}/api/webhooks/twilio/status`, params);
  if (!ok) { log.security("webhook.invalid_signature", { provider: "twilio_status" }); return new NextResponse("Invalid signature", { status: 403 }); }

  const status = params.MessageStatus;
  const mapped = status === "delivered" ? "delivered" : ["failed", "undelivered"].includes(status) ? "failed" : null;
  if (mapped && /^(SM|MM)[0-9a-fA-F]{32}$/.test(params.MessageSid ?? "")) {
    const { data: msg } = await createAdminClient().from("messages")
      .update({ status: mapped, error: mapped === "failed" ? `Carrier status: ${status}${params.ErrorCode ? ` (${params.ErrorCode.slice(0, 10)})` : ""}` : null })
      .eq("provider_message_id", params.MessageSid).in("status", ["queued", "sent"]).select("lead_id, business_id").maybeSingle();
    if (mapped === "failed" && msg) {
      log.warn("message.delivery_failed", { businessId: msg.business_id, leadId: msg.lead_id, carrierStatus: status });
      await createAdminClient().from("leads").update({ needs_attention: true, attention_reason: "A text message could not be delivered by the carrier." })
        .eq("id", msg.lead_id).eq("business_id", msg.business_id);
    }
  }
  return new NextResponse(null, { status: 204 });
}
