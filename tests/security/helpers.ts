import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import twilio from "twilio";
import Stripe from "stripe";
import type { Database } from "@/lib/database.types";
import { LEGAL_VERSIONS } from "@/lib/compliance/legal";

// Keys come from the environment (scripts/test-security.sh exports them from `supabase status`). Never hardcode keys.
const required = (name: string) => { const v = process.env[name]; if (!v) throw new Error(`${name} is not set — run tests via npm run test:security`); return v; };
export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
export const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
export const APP = process.env.TEST_APP_URL ?? "http://localhost:3100";
export const MOCK = "http://127.0.0.1:4010";

export const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
export const anon = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

export const rand = () => randomBytes(4).toString("hex");
export const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeout = 15_000): Promise<T> {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("waitFor timed out");
    await sleep(250);
  }
}

export interface Tenant {
  email: string; userId: string; businessId: string; cookie: string;
  db: SupabaseClient<Database>; intakeKey: string; smsNumber: string;
}

/** A real user + business, signed in through Supabase Auth (real JWT, RLS applies). */
export async function createTenant(label: string, patch: Database["public"]["Tables"]["businesses"]["Update"] = {}, opts: { skipAgreements?: boolean } = {}): Promise<Tenant> {
  const email = `${label}-${rand()}@test.leadflow.dev`;
  const password = `Pw-${randomBytes(12).toString("hex")}`;
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const db = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await db.auth.signInWithPassword({ email, password });
  if (e2 || !s.session) throw e2 ?? new Error("no session");
  const { data: businessId } = await db.rpc("create_business", { p_name: `${label} Ltd` });
  const smsNumber = `+3538${Math.floor(1e8 + Math.random() * 8e8)}`;
  await admin.from("businesses").update({
    onboarding_completed: true, services: [{ name: "Roof repair", price_range: "€150–€400", description: "" }],
    sms_number: smsNumber, website: `https://${label}.example.com`, ai_mode: "auto", ...patch,
  }).eq("id", businessId!);
  if (!opts.skipAgreements) {
    await admin.from("agreements").insert((["terms", "privacy", "business_responsibilities"] as const).map((document) => ({
      user_id: created.user!.id, business_id: businessId!, document, version: LEGAL_VERSIONS[document] })));
  }
  const { data: b } = await admin.from("businesses").select("intake_key").eq("id", businessId!).single();
  const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString("base64url")}`;
  return { email, userId: created.user!.id, businessId: businessId!, cookie, db, intakeKey: b!.intake_key, smsNumber };
}

export async function seedLead(businessId: string, fields: Partial<Database["public"]["Tables"]["leads"]["Insert"]> = {}) {
  const { data, error } = await admin.from("leads").insert({
    business_id: businessId, name: `Lead ${rand()}`, phone: `+3538${Math.floor(1e8 + Math.random() * 8e8)}`, channel: "test",
    status: "contacted", last_outbound_at: new Date().toISOString(), ...fields,
  }).select().single();
  if (error) throw error;
  await admin.from("messages").insert({ business_id: businessId, lead_id: data.id, direction: "outbound", sender: "ai", body: `Hello ${rand()}`, channel: data.channel });
  return data;
}

export const messagesOf = async (leadId: string) =>
  (await admin.from("messages").select("*").eq("lead_id", leadId).order("created_at")).data ?? [];
export const leadRow = async (leadId: string) => (await admin.from("leads").select("*").eq("id", leadId).single()).data!;

// ── Server actions, called directly over HTTP like an attacker would ──
let manifest: Record<string, { page: string }> | null = null;
function actionIndex() {
  if (manifest) return manifest;
  const m = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8"));
  manifest = {};
  for (const [id, entry] of Object.entries<{ workers: Record<string, { moduleId: string }>; exportedName?: string }>(m.node)) {
    const [page, w] = Object.entries(entry.workers)[0];
    // Production builds expose exportedName directly; dev builds encode it in the loader moduleId.
    const name = entry.exportedName ?? decodeURIComponent(String(w.moduleId)).match(new RegExp(`"id":"${id}","exportedName":"(\\w+)"`))?.[1];
    if (name) manifest[name] = { page, id } as never;
  }
  return manifest;
}
function pageUrl(page: string) {
  return page.replace(/^app/, "").replace(/\/page$/, "").replace(/\/\([^)]+\)/g, "").replace(/\[[^\]]+\]/g, randomUUID()) || "/";
}

export async function callAction(name: string, args: unknown[], cookie: string | null, opts: { origin?: string } = {}) {
  const entry = actionIndex()[name] as unknown as { id: string; page: string } | undefined;
  if (!entry) throw new Error(`action ${name} not found in manifest`);
  const res = await fetch(APP + pageUrl(entry.page), {
    method: "POST", redirect: "manual",
    headers: {
      "Next-Action": entry.id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component",
      Origin: opts.origin ?? APP, ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, text: await res.text(), location: res.headers.get("location") };
}

// ── AI mock control ──
export async function mockMode(mode: string) { await fetch(`${MOCK}/__mode`, { method: "POST", body: JSON.stringify({ mode }) }); }
export async function mockRequests(): Promise<{ messages: { role: string; content: string }[] }[]> { return (await fetch(`${MOCK}/__requests`)).json(); }

// ── Webhooks ──
export const TWILIO_TOKEN = required("TWILIO_AUTH_TOKEN");
export async function twilioInbound(params: Record<string, string>, opts: { badSignature?: boolean } = {}) {
  const url = `${APP}/api/webhooks/twilio`;
  const sig = opts.badSignature ? "bogus" : twilio.getExpectedTwilioSignature(TWILIO_TOKEN, url, params);
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": sig }, body: new URLSearchParams(params) });
  return res.status;
}
export const sid = () => `SM${randomBytes(16).toString("hex")}`;

const stripe = new Stripe(required("STRIPE_SECRET_KEY"));
export async function stripeEvent(type: string, object: unknown, opts: { id?: string; created?: number; badSignature?: boolean } = {}) {
  const payload = JSON.stringify({ id: opts.id ?? `evt_${rand()}`, object: "event", type, created: opts.created ?? Math.floor(Date.now() / 1000), data: { object } });
  const header = opts.badSignature ? "t=1,v1=deadbeef" : stripe.webhooks.generateTestHeaderString({ payload, secret: required("STRIPE_WEBHOOK_SECRET") });
  const res = await fetch(`${APP}/api/webhooks/stripe`, { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
  return res.status;
}

export async function runCron() {
  const res = await fetch(`${APP}/api/cron/follow-ups`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  return { status: res.status, body: await res.json() };
}

/** True if any request the mock AI received contains this text (robust to unrelated background AI calls). */
export async function modelSaw(text: string) {
  return JSON.stringify(await mockRequests()).includes(JSON.stringify(text).slice(1, -1));
}
