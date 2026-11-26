// Webhook authenticity, idempotency, ordering; intake abuse controls; rate limits.
import { beforeAll, describe, expect, it } from "vitest";
import { admin, APP, createTenant, leadRow, messagesOf, mockMode, randomIp, sid, sleep, stripeEvent, twilioInbound, waitFor, type Tenant } from "./helpers";

let T: Tenant;
beforeAll(async () => {
  await mockMode("ok");
  T = await createTenant("hooks");
});

describe("Twilio inbound", () => {
  const from = () => `+3538${Math.floor(1e8 + Math.random() * 8e8)}`;
  it("rejects bad signatures", async () => {
    expect(await twilioInbound({ MessageSid: sid(), From: from(), To: T.smsNumber, Body: "hi" }, { badSignature: true })).toBe(403);
  });
  it("rejects malformed payloads", async () => {
    expect(await twilioInbound({ MessageSid: "not-a-sid", From: from(), To: T.smsNumber, Body: "hi" })).toBe(400);
  });
  it("rejects oversized payloads", async () => {
    const res = await fetch(`${APP}/api/webhooks/twilio`, { method: "POST", body: "Body=" + "x".repeat(70_000), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    expect(res.status).toBe(413);
  });
  it("the same Twilio message delivered 3 times → one stored message, one AI reply", async () => {
    const phone = from(), messageSid = sid();
    const params = { MessageSid: messageSid, From: phone, To: T.smsNumber, Body: "Hi, my roof is leaking in the kitchen" };
    const statuses = await Promise.all([twilioInbound(params), twilioInbound(params), twilioInbound(params)]);
    expect(statuses.every((s) => s === 200)).toBe(true);
    const lead = await waitFor(async () => (await admin.from("leads").select("id").eq("business_id", T.businessId).eq("phone", phone).maybeSingle()).data);
    await waitFor(async () => (await messagesOf(lead.id)).some((m) => m.direction === "outbound"));
    await sleep(1500);
    const msgs = await messagesOf(lead.id);
    expect(msgs.filter((m) => m.direction === "inbound")).toHaveLength(1);
    expect(msgs.filter((m) => m.direction === "outbound")).toHaveLength(1);
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("business_id", T.businessId).eq("phone", phone);
    expect(count).toBe(1);
  });
  it("STOP opts out; no reply; owner cannot message; START opts back in", async () => {
    const phone = from();
    await twilioInbound({ MessageSid: sid(), From: phone, To: T.smsNumber, Body: "Need a quote for gutters please" });
    const lead = await waitFor(async () => (await admin.from("leads").select("id").eq("phone", phone).eq("business_id", T.businessId).maybeSingle()).data);
    await waitFor(async () => (await messagesOf(lead.id)).some((m) => m.direction === "outbound"));
    await twilioInbound({ MessageSid: sid(), From: phone, To: T.smsNumber, Body: "STOP" });
    await sleep(1500);
    const after = await leadRow(lead.id);
    expect(after.status).toBe("opted_out");
    expect(after.ai_paused).toBe(true);
    expect((await messagesOf(lead.id)).at(-1)!.body).toBe("STOP"); // nothing sent after STOP
    const { count: pending } = await admin.from("follow_ups").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("status", "pending");
    expect(pending).toBe(0);
    await twilioInbound({ MessageSid: sid(), From: phone, To: T.smsNumber, Body: "START" });
    await waitFor(async () => (await leadRow(lead.id)).status === "engaged");
    expect((await leadRow(lead.id)).ai_paused).toBe(true); // owner decides when the AI resumes
  });
  it("first SMS includes opt-out instructions", async () => {
    const phone = from();
    await twilioInbound({ MessageSid: sid(), From: phone, To: T.smsNumber, Body: "Do you clean gutters?" });
    const lead = await waitFor(async () => (await admin.from("leads").select("id").eq("phone", phone).eq("business_id", T.businessId).maybeSingle()).data);
    const out = await waitFor(async () => (await messagesOf(lead.id)).find((m) => m.direction === "outbound"));
    expect(out.body).toContain("Reply STOP to opt out");
  });
});

describe("Stripe", () => {
  const sub = (price: string, status = "active", customer = `cus_${T.businessId.slice(0, 8)}`) => ({
    id: `sub_${T.businessId.slice(0, 8)}`, object: "subscription", customer, status, metadata: { business_id: T.businessId },
    items: { data: [{ price: { id: price }, current_period_end: Math.floor(Date.now() / 1000) + 2_592_000 }] },
  });
  const plan = async () => (await admin.from("businesses").select("plan, subscription_status").eq("id", T.businessId).single()).data!;

  it("rejects bad signatures and does not change the plan", async () => {
    expect(await stripeEvent("customer.subscription.updated", sub("price_pro_test"), { badSignature: true })).toBe(400);
    expect((await plan()).plan).toBe("trial");
  });
  it("applies a verified subscription", async () => {
    expect(await stripeEvent("customer.subscription.created", sub("price_growth_test"), { id: "evt_dup_test_" + T.businessId })).toBe(200);
    expect(await plan()).toEqual({ plan: "growth", subscription_status: "active" });
  });
  it("a duplicate event ID is processed only once", async () => {
    await admin.from("businesses").update({ plan: "pro" }).eq("id", T.businessId); // simulate later state
    expect(await stripeEvent("customer.subscription.created", sub("price_growth_test"), { id: "evt_dup_test_" + T.businessId })).toBe(200);
    expect((await plan()).plan).toBe("pro"); // the replay did not re-apply "growth"
  });
  it("an older event arriving late never overwrites newer state", async () => {
    const now = Math.floor(Date.now() / 1000);
    await stripeEvent("customer.subscription.updated", sub("price_pro_test"), { created: now + 5 });
    await stripeEvent("customer.subscription.updated", sub("price_starter_test"), { created: now - 3600 });
    expect((await plan()).plan).toBe("pro");
  });
  it("cancellation stops the assistant for new leads", async () => {
    await stripeEvent("customer.subscription.deleted", sub("price_pro_test", "canceled"), { created: Math.floor(Date.now() / 1000) + 10 });
    expect((await plan()).subscription_status).toBe("canceled");
    const res = await fetch(`${APP}/api/leads/intake/${T.intakeKey}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": randomIp() }, body: JSON.stringify({ name: "After cancel", email: `c${Date.now()}@x.example`, message: "hello" }) });
    expect(res.status).toBe(201);
    const lead_id = (await waitFor(async () => (await admin.from("leads").select("id").eq("name", "After cancel").eq("business_id", T.businessId).maybeSingle()).data)).id;
    await sleep(1500);
    expect((await leadRow(lead_id)).ai_paused).toBe(true);
    expect((await messagesOf(lead_id)).filter((m) => m.direction === "outbound")).toHaveLength(0);
    await admin.from("businesses").update({ plan: "trial", subscription_status: "trialing", stripe_event_at: null }).eq("id", T.businessId);
  });
});

describe("cron", () => {
  it.each([undefined, "Bearer wrong", "Bearer ", `bearer ${process.env.CRON_SECRET}`])("rejects auth header %s", async (h) => {
    const res = await fetch(`${APP}/api/cron/follow-ups`, { headers: h ? { Authorization: h } : {} });
    expect(res.status).toBe(401);
  });
});

describe("lead intake", () => {
  const post = (body: unknown, ip = randomIp(), headers: Record<string, string> = {}) =>
    fetch(`${APP}/api/leads/intake/${T.intakeKey}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers }, body: JSON.stringify(body) });

  it("unknown keys get 404", async () => {
    const res = await fetch(`${APP}/api/leads/intake/${"0".repeat(36)}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": randomIp() }, body: "{}" });
    expect(res.status).toBe(404);
  });
  it("validates fields", async () => {
    expect((await post({ name: "X", email: "not-an-email" })).status).toBe(422);
    expect((await post({ name: "X", phone: "call me maybe" })).status).toBe(422);
    expect((await post({ foo: "bar" })).status).toBe(422);
    expect((await post({ name: "x".repeat(500) })).status).toBe(422);
  });
  it("rejects bodies over 32 KB", async () => {
    expect((await post({ name: "X", message: "y".repeat(40_000) })).status).toBe(413);
  });
  it("the same person submitting twice creates one lead and one first reply", async () => {
    const body = { name: "Double Click", email: `dc${Date.now()}@x.example`, message: "Need a roof repair" };
    const [r1, r2] = await Promise.all([post(body), post(body)]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    await post(body);
    await sleep(2000);
    const { data: leads } = await admin.from("leads").select("id").eq("email", body.email);
    expect(leads).toHaveLength(1); // concurrent + repeated submissions collapse into one lead
    expect((await messagesOf(leads![0].id)).filter((m) => m.direction === "outbound")).toHaveLength(1);
  });
  it("Idempotency-Key replays are ignored", async () => {
    const key = `idem-${Date.now()}`;
    const p1 = `08${Math.floor(1e7 + Math.random() * 8e7)}`, p2 = `08${Math.floor(1e7 + Math.random() * 8e7)}`;
    expect((await post({ name: "Idem", phone: p1 }, randomIp(), { "Idempotency-Key": key })).status).toBe(201);
    expect((await post({ name: "Idem 2", phone: p2 }, randomIp(), { "Idempotency-Key": key })).status).toBe(201);
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("phone", `+353${p2.slice(1)}`);
    expect(count).toBe(0); // the replay was ignored
  });
  it("never texts numbers outside the allowed countries (SMS-pumping guard)", async () => {
    const phone = `+8821${Math.floor(1e7 + Math.random() * 8e7)}`;
    expect((await post({ name: "Premium Rate", phone, message: "quote please", sms_consent: "yes" })).status).toBe(201);
    const lead_id = (await waitFor(async () => (await admin.from("leads").select("id").eq("phone", phone).maybeSingle()).data)).id;
    const out = await waitFor(async () => (await messagesOf(lead_id)).find((m) => m.direction === "outbound"));
    expect(out.status).toBe("failed");
    expect(out.error).toBe("Country not enabled for SMS");
  });
  it("honeypot submissions are silently dropped", async () => {
    const email = `bot${Date.now()}@x.example`;
    expect((await post({ name: "Bot", email, website: "http://spam.example" })).status).toBe(201); // indistinguishable
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("email", email);
    expect(count).toBe(0);
  });
  it("rate-limits a single IP (6/min)", async () => {
    const ip = randomIp();
    const statuses = [];
    for (let i = 0; i < 8; i++) statuses.push((await post({ name: `RL ${i}`, email: `rl${i}${Date.now()}@x.example` }, ip)).status);
    expect(statuses.slice(0, 6).every((s) => s === 201)).toBe(true);
    expect(statuses.slice(6)).toEqual([429, 429]);
  });
});

describe("rate limits on AI-cost actions", () => {
  it("test-mode chat is limited per user (20 / 10 min)", async () => {
    const { callAction } = await import("./helpers");
    const U = await createTenant("rl-user");
    const { data: lead } = await admin.from("leads").insert({ business_id: U.businessId, name: "RL", channel: "test", ai_paused: true }).select().single();
    let limited = false;
    for (let i = 0; i < 22; i++) {
      const r = await callAction("simulateLeadAction", [lead!.id, `msg ${i}`], U.cookie);
      if (r.text.includes("Test chat limit reached")) { limited = true; break; }
    }
    expect(limited).toBe(true);
    expect((await messagesOf(lead!.id)).length).toBeLessThanOrEqual(20);
  });
});
