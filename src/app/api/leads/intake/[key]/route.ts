import { after, NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLead, startConversation } from "@/lib/engine";
import { integrations } from "@/lib/env";
import { BodyTooLarge, ipFrom, readBody } from "@/lib/security/http";
import { claimEvent } from "@/lib/security/idempotency";
import { limit } from "@/lib/security/rate-limit";
import { clean } from "@/lib/security/validation";
import { normalizePhone } from "@/lib/messaging/phone";
import { log } from "@/lib/log";
import { ipHash } from "@/lib/compliance/records";

/** Default wording the snippet shows next to the consent checkbox (kept as evidence if the form doesn't send its own). */
const DEFAULT_CONSENT_TEXT = "I agree to be contacted by text message about my enquiry. Reply STOP to opt out at any time.";
const truthy = (v: string | undefined) => !!v && /^(on|true|yes|1|checked|agreed?)$/i.test(v.trim());

/**
 * Public lead intake: website forms, Zapier, Make, Facebook Lead Ads (via Zapier), Typeform…
 * POST JSON or form data to /api/leads/intake/{intake_key}. Field names are matched loosely.
 *
 * Abuse controls: 32 KB body cap · per-IP + per-key rate limits · strict field validation ·
 * honeypot · duplicate-lead dedupe + Idempotency-Key header · plan lead limits & daily AI caps downstream.
 * No cookies are read, so CORS "*" does not expose any user session.
 */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const SOURCES = ["website", "facebook", "instagram", "google", "referral", "phone", "webhook", "other"] as const;
const leadSchema = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().max(254).email().optional(),
  service: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(30).optional(),
});

function pick(d: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && clean(v)) return clean(v);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
}

/** Redirect only to the business's own website (prevents using LeadFlow as an open redirector). */
function allowedRedirect(target: string | undefined, website: string | null): string | null {
  if (!target || !website) return null;
  try {
    const t = new URL(target), w = new URL(/^https?:\/\//.test(website) ? website : `https://${website}`);
    const host = w.hostname.replace(/^www\./, "");
    return ["http:", "https:"].includes(t.protocol) && (t.hostname === host || t.hostname.endsWith(`.${host}`)) ? t.toString() : null;
  } catch { return null; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ip = ipFrom(req.headers);
  const keyId = createHash("sha256").update(key).digest("hex").slice(0, 12); // never log the key itself

  if (!(await limit("intakePerIp", ip))) return json({ error: "Too many requests" }, 429);
  if (!/^[a-f0-9]{36}$/.test(key)) return json({ error: "Unknown intake key" }, 404);

  const db = createAdminClient();
  const { data: business } = await db.from("businesses").select("id, website").eq("intake_key", key).maybeSingle();
  if (!business) {
    log.security("intake.unknown_key", { ip, keyId });
    return json({ error: "Unknown intake key" }, 404);
  }
  if (!(await limit("intakePerKey", business.id)) || !(await limit("intakePerKeyDaily", business.id))) {
    return json({ error: "Too many requests" }, 429);
  }

  const type = req.headers.get("content-type") ?? "";
  let data: Record<string, unknown> = {};
  try {
    const raw = await readBody(req, 32 * 1024);
    data = type.includes("application/json") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
  } catch (e) {
    return json({ error: e instanceof BodyTooLarge ? "Payload too large" : "Invalid body" }, e instanceof BodyTooLarge ? 413 : 400);
  }
  // Normalise keys: "Phone Number" → "phone_number"
  data = Object.fromEntries(Object.entries(data).slice(0, 60).map(([k, v]) => [k.toLowerCase().replace(/[\s-]/g, "_").slice(0, 40), v]));
  // Every accepted request gets the SAME response (new lead, duplicate, or spam trap), so an anonymous caller
  // can't learn lead IDs or whether a person already enquired. (Red-team fix: previously returned lead_id/duplicate.)
  const accepted = () => json({ ok: true }, 201);
  if (pick(data, "website", "_gotcha", "honeypot")) return accepted(); // spam bot: pretend success

  const first = pick(data, "first_name", "firstname"), last = pick(data, "last_name", "lastname");
  const candidate = {
    name: pick(data, "name", "full_name", "fullname", "contact_name") ?? ([first, last].filter(Boolean).join(" ") || undefined),
    phone: pick(data, "phone", "phone_number", "mobile", "tel", "telephone", "cell"),
    email: pick(data, "email", "email_address", "e_mail")?.toLowerCase(),
    service: pick(data, "service", "service_requested", "service_type", "job_type", "interest"),
    location: pick(data, "location", "city", "town", "address", "area", "zip", "postcode", "eircode"),
    message: pick(data, "message", "comments", "notes", "details", "description", "enquiry", "inquiry"),
    source: pick(data, "source", "utm_source", "platform")?.toLowerCase(),
  };
  const parsed = leadSchema.safeParse(candidate);
  if (!parsed.success) return json({ error: `Invalid field: ${parsed.error.issues[0]?.path.join(".")}` }, 422);
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (d.phone && !phone) return json({ error: "Invalid field: phone" }, 422);
  if (!d.name && !phone && !d.email) return json({ error: "Provide at least a name, phone or email" }, 422);

  // Optional client-supplied idempotency key (Zapier/Make retries).
  const idem = req.headers.get("idempotency-key");
  if (idem && /^[\w-]{8,100}$/.test(idem) && !(await claimEvent(`intake:${business.id}`, idem))) {
    return accepted();
  }

  // SMS consent must be explicit (an unticked-by-default checkbox the person ticked). No field → no texts.
  const consented = truthy(pick(data, "sms_consent", "consent", "sms_opt_in", "text_consent"));
  const consentEvidence = consented ? {
    consent_text: (pick(data, "consent_text") ?? DEFAULT_CONSENT_TEXT).slice(0, 500),
    page: (req.headers.get("referer") ?? "").slice(0, 300) || null,
    ip_hash: ipHash(ip), user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200),
    submitted_at: new Date().toISOString(),
  } : undefined;

  const lead = await createLead(business.id, {
    name: d.name ?? "",
    phone, email: d.email ?? null,
    source: SOURCES.includes(d.source as (typeof SOURCES)[number]) ? d.source : "webhook",
    channel: phone && integrations.sms() ? "sms" : "test",
    service_requested: d.service, location: d.location, initial_message: d.message,
    consent: consentEvidence ? { basis: "web_form_checkbox", evidence: consentEvidence } : undefined,
  }, { startAi: false });

  // Respond fast; the assistant's first reply happens right after (cron sweep recovers it if this fails).
  if (!lead.deduplicated && !lead.ai_paused) {
    after(() => startConversation(lead.id).then(() => undefined).catch((e) => log.error("intake.first_reply_failed", { leadId: lead.id, error: e })));
  }

  if (!type.includes("application/json")) {
    const redirect = allowedRedirect(pick(data, "redirect", "_redirect", "_next"), business.website);
    if (redirect) return NextResponse.redirect(redirect, 303);
    // Plain HTML form without an allowed redirect: show a simple, static thank-you page (no user input echoed).
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thanks</title>` +
      `<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;color:#1a1a18">` +
      `<div style="text-align:center"><h1 style="font-size:22px">Thanks — we've got your message</h1>` +
      `<p style="color:#75736c">We'll be in touch shortly. You can close this page.</p></div>`,
      { status: 201, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } },
    );
  }
  return accepted();
}
