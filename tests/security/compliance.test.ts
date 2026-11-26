// Legal-risk controls: consent, opt-out, review workflow, kill switch, export, retention, deletion, redaction,
// AI disclosure & claims, append-only records, tenant isolation of the new tables.
import { beforeAll, describe, expect, it } from "vitest";
import {
  admin, APP, callAction, createTenant, leadRow, messagesOf, mockMode, modelSaw, randomIp, runCron, sid, sleep,
  twilioInbound, waitFor, type Tenant,
} from "./helpers";

const phone = () => `+3538${Math.floor(1e8 + Math.random() * 8e8)}`;
const intake = (T: Tenant, body: Record<string, unknown>) =>
  fetch(`${APP}/api/leads/intake/${T.intakeKey}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": randomIp(), referer: "https://example.com/contact" }, body: JSON.stringify(body) });
const leadByPhone = (T: Tenant, p: string) => waitFor(async () => (await admin.from("leads").select("*").eq("business_id", T.businessId).eq("phone", p).maybeSingle()).data);

let T: Tenant;
beforeAll(async () => { await mockMode("ok"); T = await createTenant("legal"); });

describe("SMS consent", () => {
  it("a web lead WITHOUT a consent tick is saved but never texted, and no AI is spent on it", async () => {
    const p = phone();
    await intake(T, { name: "No Consent", phone: p, message: "Quote for gutters please" });
    const lead = await leadByPhone(T, p);
    await sleep(1500);
    expect(lead.channel).toBe("sms");
    expect((await leadRow(lead.id)).sms_consent).toBe("none");
    expect((await messagesOf(lead.id)).filter((m) => m.direction === "outbound")).toHaveLength(0);
    expect(await modelSaw("Quote for gutters please")).toBe(false);
    expect((await leadRow(lead.id)).attention_reason).toMatch(/No SMS consent/);
  });

  it("a web lead WITH a consent tick records the evidence (wording, page, hashed IP — never the raw IP)", async () => {
    const p = phone();
    await intake(T, { name: "Has Consent", phone: p, message: "Roof leak", sms_consent: "yes", consent_text: "Text me about my enquiry" });
    const lead = await leadByPhone(T, p);
    expect(lead.sms_consent).toBe("granted");
    const { data: ev } = await admin.from("consent_events").select("*").eq("lead_id", lead.id).single();
    expect(ev!.basis).toBe("web_form_checkbox");
    expect(ev!.evidence).toMatchObject({ consent_text: "Text me about my enquiry", page: "https://example.com/contact" });
    expect(JSON.stringify(ev!.evidence)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(ev!.phone_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("the DATABASE refuses to record an SMS for a lead without consent (backstop for code bugs)", async () => {
    const { data: lead } = await admin.from("leads").insert({ business_id: T.businessId, name: "Raw", phone: phone(), channel: "sms" }).select().single();
    const { error } = await admin.from("messages").insert({ business_id: T.businessId, lead_id: lead!.id, direction: "outbound", sender: "owner", channel: "sms", body: "hi", status: "queued" });
    expect(error?.message).toMatch(/sms blocked/);
  });

  it("the owner cannot text a lead without consent, but can record consent with a note", async () => {
    const p = phone();
    await intake(T, { name: "Phoned In", phone: p });
    const lead = await leadByPhone(T, p);
    const r = await callAction("ownerSendAction", [lead.id, "Hi, it's Pat"], T.cookie);
    expect(r.text).toMatch(/No SMS consent/);
    await callAction("recordConsentAction", [lead.id, "Phoned on Monday, asked us to text a quote"], T.cookie);
    expect((await leadRow(lead.id)).sms_consent).toBe("granted");
    const { data: ev } = await admin.from("consent_events").select("basis, evidence").eq("lead_id", lead.id).single();
    expect(ev!.basis).toBe("owner_attestation");
    expect(ev!.evidence).toMatchObject({ attested_by: T.userId });
  });
});

describe("opt-out", () => {
  it.each(["STOP", "Please stop texting me", "don't contact me again"])("'%s' opts out, suppresses the number, and survives lead deletion", async (msg) => {
    const p = phone();
    await twilioInbound({ MessageSid: sid(), From: p, To: T.smsNumber, Body: "Hi, need a roofer" });
    const lead = await leadByPhone(T, p);
    await twilioInbound({ MessageSid: sid(), From: p, To: T.smsNumber, Body: msg });
    await waitFor(async () => (await leadRow(lead.id)).status === "opted_out");
    expect((await leadRow(lead.id)).sms_consent).toBe("revoked");
    // The owner cannot override an opt-out
    const r = await callAction("recordConsentAction", [lead.id, "They said it was fine on the phone"], T.cookie);
    expect(r.text).toMatch(/opted out/);
    // Delete the lead → suppression persists → a new form submission WITH consent still isn't texted
    await callAction("deleteLeadAction", [lead.id], T.cookie);
    expect((await admin.from("leads").select("id").eq("id", lead.id).maybeSingle()).data).toBeNull(); // really deleted
    await sleep(500);
    await intake(T, { name: "Came Back", phone: p, sms_consent: "yes", message: "hello again" });
    const again = await leadByPhone(T, p);
    await sleep(1500);
    expect(again.sms_consent).toBe("revoked");
    expect((await messagesOf(again.id)).filter((m) => m.direction === "outbound")).toHaveLength(0);
  });

  it("RACE: a first message and STOP arriving at the same moment always end opted out", async () => {
    for (let i = 0; i < 3; i++) {
      const p = phone();
      await Promise.all([
        twilioInbound({ MessageSid: sid(), From: p, To: T.smsNumber, Body: "Hi, I need a quote" }),
        sleep(30).then(() => twilioInbound({ MessageSid: sid(), From: p, To: T.smsNumber, Body: "STOP" })),
      ]);
      await sleep(2500);
      const { data: leads } = await admin.from("leads").select("status, sms_consent").eq("business_id", T.businessId).eq("phone", p);
      for (const l of leads ?? []) {
        if (l.sms_consent === "revoked") expect(l.status).toBe("opted_out");
      }
      expect((leads ?? []).some((l) => l.sms_consent === "revoked")).toBe(true);
    }
  });

  it("the database keeps an opt-out sticky: stale writes can't undo it, and only START (not the owner) can re-grant", async () => {
    const { data: lead } = await admin.from("leads").insert({ business_id: T.businessId, name: "Sticky", phone: phone(), channel: "sms", status: "opted_out", sms_consent: "revoked", sms_consent_source: "keyword_stop" }).select().single();
    await admin.from("leads").update({ status: "engaged" }).eq("id", lead!.id);
    expect((await leadRow(lead!.id)).status).toBe("opted_out");
    await admin.from("leads").update({ sms_consent: "granted", sms_consent_source: "owner_attestation" }).eq("id", lead!.id);
    expect((await leadRow(lead!.id)).sms_consent).toBe("revoked");
    await admin.from("leads").update({ sms_consent: "granted", sms_consent_source: "keyword_start" }).eq("id", lead!.id);
    expect((await leadRow(lead!.id)).sms_consent).toBe("granted");
  });

  it("deleting a lead keeps its consent proof, unlinked (pseudonymised)", async () => {
    const p = phone();
    await intake(T, { name: "Erase Me", phone: p, sms_consent: "yes" });
    const lead = await leadByPhone(T, p);
    const r = await callAction("deleteLeadAction", [lead.id], T.cookie);
    expect(r.status).toBeLessThan(400);
    expect((await admin.from("leads").select("id").eq("id", lead.id).maybeSingle()).data).toBeNull();
    const { data: ev } = await admin.from("consent_events").select("lead_id, phone_hash, basis").eq("business_id", T.businessId).eq("basis", "web_form_checkbox").is("lead_id", null);
    expect(ev!.length).toBeGreaterThanOrEqual(1);
  });

  it("consent records are append-only", async () => {
    const { data: ev } = await admin.from("consent_events").select("id").eq("business_id", T.businessId).limit(1).single();
    const { error } = await admin.from("consent_events").update({ evidence: { tampered: true } }).eq("id", ev!.id);
    expect(error?.message).toMatch(/append-only/);
  });
});

describe("AI controls", () => {
  it("Review mode: the AI drafts, nothing is sent until the owner approves; edits keep the original", async () => {
    const R = await createTenant("review", { ai_mode: "review" });
    const { data: lead } = await admin.from("leads").insert({ business_id: R.businessId, name: "Rev", channel: "test", status: "contacted", last_outbound_at: new Date().toISOString() }).select().single();
    await admin.from("messages").insert({ business_id: R.businessId, lead_id: lead!.id, direction: "outbound", sender: "owner", body: "Hi!", created_at: new Date(Date.now() - 60_000).toISOString() });
    await callAction("simulateLeadAction", [lead!.id, "How soon can you come?"], R.cookie);
    const draft = (await messagesOf(lead!.id)).find((m) => m.status === "draft")!;
    expect(draft).toBeTruthy();
    expect((await messagesOf(lead!.id)).filter((m) => m.sender === "ai" && m.status !== "draft")).toHaveLength(0);
    await callAction("approveDraftAction", [lead!.id, draft.id, "Edited by the owner before sending."], R.cookie);
    const sent = (await messagesOf(lead!.id)).find((m) => m.sender === "ai" && m.status === "sent")!;
    expect(sent.body).toBe("Edited by the owner before sending.");
    expect(sent.original_body).toBe(draft.body);
    expect(sent.approved_by).toBe(R.userId);
    const { data: auditRows } = await admin.from("audit_log").select("action").eq("business_id", R.businessId);
    expect(auditRows!.map((a) => a.action)).toContain("draft.edited_and_sent");
  });

  it("Review mode: approving an UNEDITED draft sends it exactly once", async () => {
    const R = await createTenant("review2", { ai_mode: "review" });
    const { data: lead } = await admin.from("leads").insert({ business_id: R.businessId, name: "Rev2", channel: "test", status: "contacted", last_outbound_at: new Date().toISOString() }).select().single();
    await admin.from("messages").insert({ business_id: R.businessId, lead_id: lead!.id, direction: "outbound", sender: "owner", body: "Hi!", created_at: new Date(Date.now() - 60_000).toISOString() });
    await callAction("simulateLeadAction", [lead!.id, "Do you do gutters?"], R.cookie);
    const draft = (await messagesOf(lead!.id)).find((m) => m.status === "draft")!;
    await callAction("approveDraftAction", [lead!.id, draft.id, null], R.cookie);
    await callAction("approveDraftAction", [lead!.id, draft.id, null], R.cookie); // double click
    const sent = (await messagesOf(lead!.id)).filter((m) => m.sender === "ai" && m.status === "sent");
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toBe(draft.body);
    expect(sent[0].original_body).toBeNull();
  });

  it("Auto mode can't be enabled without the acknowledgement", async () => {
    const R = await createTenant("ack", { ai_mode: "review" });
    const r = await callAction("setAiModeAction", [{ mode: "auto" }], R.cookie);
    expect(r.text).toMatch(/confirm/);
    expect((await admin.from("businesses").select("ai_mode").eq("id", R.businessId).single()).data!.ai_mode).toBe("review");
    await callAction("setAiModeAction", [{ mode: "auto", acknowledged: true }], R.cookie);
    const b = (await admin.from("businesses").select("ai_mode, ai_mode_acknowledged_by").eq("id", R.businessId).single()).data!;
    expect(b).toEqual({ ai_mode: "auto", ai_mode_acknowledged_by: R.userId });
  });

  it("the kill switch stops all AI immediately and cancels pending follow-ups", async () => {
    const K = await createTenant("kill");
    const { data: lead } = await admin.from("leads").insert({ business_id: K.businessId, name: "K", channel: "test", status: "contacted", last_outbound_at: new Date().toISOString() }).select().single();
    await admin.from("messages").insert({ business_id: K.businessId, lead_id: lead!.id, direction: "outbound", sender: "ai", body: "Hi", created_at: new Date(Date.now() - 60_000).toISOString() });
    await admin.from("follow_ups").insert({ business_id: K.businessId, lead_id: lead!.id, step: 0, scheduled_for: new Date(Date.now() + 3600_000).toISOString() });
    await callAction("stopAllAiAction", [], K.cookie);
    expect((await admin.from("follow_ups").select("status").eq("lead_id", lead!.id).single()).data!.status).toBe("cancelled");
    await callAction("simulateLeadAction", [lead!.id, "Hello? (kill switch test)"], K.cookie);
    expect(await modelSaw("Hello? (kill switch test)")).toBe(false);
  });

  it("the first message always discloses it's an automated assistant", async () => {
    await mockMode("ok"); // mock reply does not mention being an assistant
    await intake(T, { name: "Disclosure", email: `d${Date.now()}@x.example`, message: "Need a roof repair" });
    const lead = await waitFor(async () => (await admin.from("leads").select("id").eq("name", "Disclosure").eq("business_id", T.businessId).maybeSingle()).data);
    const first = await waitFor(async () => (await messagesOf(lead.id)).find((m) => m.direction === "outbound"));
    expect(first.body).toMatch(/automated assistant/i);
  });

  it("compliance / safety claims not stated by the business are never sent", async () => {
    await mockMode("claim");
    const { data: lead } = await admin.from("leads").insert({ business_id: T.businessId, name: "Claim", channel: "test", status: "contacted", last_outbound_at: new Date().toISOString() }).select().single();
    await admin.from("messages").insert({ business_id: T.businessId, lead_id: lead!.id, direction: "outbound", sender: "ai", body: "Hi", created_at: new Date(Date.now() - 60_000).toISOString() });
    await callAction("simulateLeadAction", [lead!.id, "Is your work up to code?"], T.cookie);
    const last = (await messagesOf(lead!.id)).at(-1)!;
    expect(last.body).not.toMatch(/compliant|up to code|completely safe/i);
    await mockMode("ok");
  });

  it("payment card numbers are removed before storage and never reach the AI", async () => {
    const { data: lead } = await admin.from("leads").insert({ business_id: T.businessId, name: "Card", channel: "test", status: "contacted", last_outbound_at: new Date().toISOString() }).select().single();
    await callAction("simulateLeadAction", [lead!.id, "Here's my card 4242 4242 4242 4242 for the deposit"], T.cookie);
    const stored = (await messagesOf(lead!.id)).find((m) => m.direction === "inbound")!;
    expect(stored.body).toContain("[card number removed]");
    expect(stored.body).not.toMatch(/4242/);
    expect(await modelSaw("4242 4242")).toBe(false);
  });
});

describe("data controls", () => {
  it("export: owner gets only their own data; other tenants' leads 404; unauthenticated 401", async () => {
    const O = await createTenant("export-other");
    const { data: theirs } = await admin.from("leads").insert({ business_id: O.businessId, name: "Not Yours" }).select().single();
    const all = await fetch(`${APP}/api/export`, { headers: { Cookie: T.cookie } });
    expect(all.status).toBe(200);
    expect(all.headers.get("content-disposition")).toContain("attachment");
    const json = await all.json();
    expect(json.leads.every((l: { business_id: string }) => l.business_id === T.businessId)).toBe(true);
    expect(JSON.stringify(json)).not.toContain("Not Yours");
    expect((await fetch(`${APP}/api/export?lead=${theirs!.id}`, { headers: { Cookie: T.cookie } })).status).toBe(404);
    expect((await fetch(`${APP}/api/export`)).status).toBe(401);
  });

  it("retention purge deletes only expired leads, only for businesses with a retention period", async () => {
    const A = await createTenant("ret-a", { retention_days: 90 });
    const B = await createTenant("ret-b", { retention_days: null });
    const old = new Date(Date.now() - 200 * 86400_000).toISOString();
    const { data: aOld } = await admin.from("leads").insert({ business_id: A.businessId, name: "Old A", created_at: old, last_message_at: old }).select().single();
    const { data: aNew } = await admin.from("leads").insert({ business_id: A.businessId, name: "New A" }).select().single();
    const { data: bOld } = await admin.from("leads").insert({ business_id: B.businessId, name: "Old B", created_at: old, last_message_at: old }).select().single();
    await admin.rpc("purge_expired_data");
    expect((await admin.from("leads").select("id").eq("id", aOld!.id).maybeSingle()).data).toBeNull();
    expect((await admin.from("leads").select("id").eq("id", aNew!.id).maybeSingle()).data).not.toBeNull();
    expect((await admin.from("leads").select("id").eq("id", bOld!.id).maybeSingle()).data).not.toBeNull();
    const { data: log } = await admin.from("audit_log").select("action").eq("business_id", A.businessId).eq("action", "retention.purged");
    expect(log!.length).toBe(1);
  });

  it("account deletion removes the business, all customer data and the login", async () => {
    const D = await createTenant("delete-me");
    const { data: lead } = await admin.from("leads").insert({ business_id: D.businessId, name: "Gone Soon" }).select().single();
    expect((await callAction("deleteAccountAction", ["wrong name"], D.cookie)).text).toMatch(/Type your business name/);
    await callAction("deleteAccountAction", ["delete-me Ltd"], D.cookie);
    expect((await admin.from("businesses").select("id").eq("id", D.businessId).maybeSingle()).data).toBeNull();
    expect((await admin.from("leads").select("id").eq("id", lead!.id).maybeSingle()).data).toBeNull();
    expect((await admin.auth.admin.getUserById(D.userId)).data.user).toBeNull();
  });
});

describe("agreements, isolation & internal tools", () => {
  it("users without the current Terms/Privacy acceptance are sent to accept them", async () => {
    const N = await createTenant("no-agreements", {}, { skipAgreements: true });
    const res = await fetch(`${APP}/dashboard`, { headers: { Cookie: N.cookie }, redirect: "manual" });
    expect(res.headers.get("location")).toContain("/legal/accept");
  });

  it("consent records, suppression list and audit log are isolated between businesses and read-only for users", async () => {
    const X = await createTenant("iso-x");
    for (const t of ["consent_events", "suppression_list", "audit_log"] as const) {
      const { data } = await X.db.from(t).select("business_id").eq("business_id", T.businessId);
      expect(data ?? [], t).toHaveLength(0);
    }
    const { error } = await X.db.from("consent_events").insert({ business_id: X.businessId, channel: "sms", action: "granted", basis: "api" });
    expect(error).not.toBeNull();
    // A user can't remove a number from their own do-not-text list (only the person can opt back in).
    await admin.from("suppression_list").insert({ business_id: X.businessId, phone_hash: "f".repeat(64), channel: "sms", reason: "keyword_stop" });
    await X.db.from("suppression_list").delete().eq("business_id", X.businessId);
    const { count } = await admin.from("suppression_list").select("phone_hash", { count: "exact", head: true }).eq("business_id", X.businessId);
    expect(count).toBe(1);
  });

  it("the internal dashboard needs allow-listed email AND verified email AND a server-set admin flag", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const signIn = async (email: string, password: string) => {
      const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      const { data } = await c.auth.signInWithPassword({ email, password });
      return `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
    };
    const email = "ops-admin@test.leadflow.dev", password = `Pw-${crypto.randomUUID()}`;
    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const old = existing.users.find((u) => u.email === email);
    if (old) await admin.auth.admin.deleteUser(old.id);
    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    // Allow-listed + verified, but no server-set flag → hidden
    expect((await fetch(`${APP}/internal/risk`, { headers: { Cookie: await signIn(email, password) } })).status).toBe(404);
    // A user can't grant themselves the flag (user_metadata is user-editable; app_metadata is not)
    const self = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    await self.auth.signInWithPassword({ email, password });
    await self.auth.updateUser({ data: { leadflow_admin: true } });
    expect((await fetch(`${APP}/internal/risk`, { headers: { Cookie: await signIn(email, password) } })).status).toBe(404);
    // Server grants the flag → visible
    await admin.auth.admin.updateUserById(u.user!.id, { app_metadata: { leadflow_admin: true } });
    const ok = await fetch(`${APP}/internal/risk`, { headers: { Cookie: await signIn(email, password) } });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("does not mean LeadFlow is legally compliant");
  });

  it("the internal risk dashboard is invisible to customers", async () => {
    const res = await fetch(`${APP}/internal/risk`, { headers: { Cookie: T.cookie } });
    expect(res.status).toBe(404);
  });

  it("legal pages are public and clearly marked as drafts", async () => {
    for (const p of ["/terms", "/privacy", "/legal/subprocessors"]) {
      const html = await (await fetch(APP + p)).text();
      expect(html, p).toMatch(/DRAFT/);
      expect(html, p).not.toMatch(/\b(fully compliant|GDPR[- ]compliant|lawsuit[- ]proof|100% compliant)\b/i);
    }
  });
});

it("cron still runs cleanly with retention enabled", async () => {
  expect((await runCron()).status).toBe(200);
});
