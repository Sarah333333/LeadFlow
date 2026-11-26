// Direct database API attacks with real user JWTs (bypassing the app entirely).
import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createTenant, seedLead, type Tenant } from "./helpers";

let A: Tenant, B: Tenant;
let bLead: { id: string };

beforeAll(async () => {
  A = await createTenant("tenant-a");
  B = await createTenant("tenant-b", { stripe_customer_id: `cus_${Date.now()}`, notify_phone: "+353871234567" });
  bLead = await seedLead(B.businessId, { name: "B Secret Customer", email: "secret@b.example" });
  await admin.from("notifications").insert({ business_id: B.businessId, lead_id: bLead.id, type: "hot_lead", title: "B alert" });
  await admin.from("follow_ups").insert({ business_id: B.businessId, lead_id: bLead.id, step: 0, scheduled_for: new Date().toISOString() });
  await admin.from("lead_events").insert({ business_id: B.businessId, lead_id: bLead.id, type: "created" });
});

const TABLES = ["leads", "messages", "follow_ups", "lead_events", "notifications"] as const;

describe("cross-tenant reads", () => {
  it.each(TABLES)("tenant A cannot read tenant B's %s", async (table) => {
    const { data } = await A.db.from(table).select("*").eq("business_id", B.businessId);
    expect(data ?? []).toHaveLength(0);
    const { data: all } = await A.db.from(table).select("business_id");
    expect((all ?? []).every((r) => r.business_id === A.businessId)).toBe(true);
  });
  it("tenant A cannot read tenant B's business settings or billing", async () => {
    const { data } = await A.db.from("businesses").select("*").eq("id", B.businessId);
    expect(data ?? []).toHaveLength(0);
  });
  it("tenant A cannot read tenant B's memberships", async () => {
    const { data } = await A.db.from("business_members").select("*").eq("business_id", B.businessId);
    expect(data ?? []).toHaveLength(0);
  });
  it("tenant A cannot fetch B's lead by ID (IDOR)", async () => {
    const { data } = await A.db.from("leads").select("*").eq("id", bLead.id).maybeSingle();
    expect(data).toBeNull();
  });
});

describe("cross-tenant writes", () => {
  it("tenant A cannot update B's business", async () => {
    const { data } = await A.db.from("businesses").update({ name: "pwned" }).eq("id", B.businessId).select();
    expect(data ?? []).toHaveLength(0);
    expect((await admin.from("businesses").select("name").eq("id", B.businessId).single()).data!.name).not.toBe("pwned");
  });
  it("tenant A cannot insert a lead into B's business", async () => {
    const { error } = await A.db.from("leads").insert({ business_id: B.businessId, name: "x" });
    expect(error).not.toBeNull();
  });
  it("tenant A cannot update or delete B's leads", async () => {
    await A.db.from("leads").update({ name: "pwned" }).eq("id", bLead.id);
    await A.db.from("leads").delete().eq("id", bLead.id);
    const row = (await admin.from("leads").select("name").eq("id", bLead.id).single()).data;
    expect(row?.name).toBe("B Secret Customer");
  });
  it("tenant A cannot mark B's notifications as read", async () => {
    await A.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("business_id", B.businessId);
    const { data } = await admin.from("notifications").select("read_at").eq("business_id", B.businessId);
    expect(data!.every((n) => n.read_at === null)).toBe(true);
  });
  it("tenant A cannot add themselves as a member of B", async () => {
    const { error } = await A.db.from("business_members").insert({ business_id: B.businessId, user_id: A.userId, role: "owner" });
    expect(error).not.toBeNull();
  });
});

describe("least privilege inside your own tenant", () => {
  it("users cannot write leads/messages directly (only via the server)", async () => {
    const lead = await seedLead(A.businessId);
    expect((await A.db.from("leads").insert({ business_id: A.businessId, name: "direct" })).error).not.toBeNull();
    expect((await A.db.from("messages").insert({ business_id: A.businessId, lead_id: lead.id, direction: "outbound", sender: "ai", body: "forged" })).error).not.toBeNull();
    await A.db.from("leads").update({ score: 100 }).eq("id", lead.id);
    expect((await admin.from("leads").select("score").eq("id", lead.id).single()).data!.score).toBe(0);
  });
  it("users cannot grant themselves a paid plan or change billing/SMS/intake columns", async () => {
    for (const patch of [{ plan: "pro" }, { subscription_status: "active" }, { stripe_customer_id: "cus_evil" }, { sms_number: "+15550000000" }, { intake_key: "a".repeat(36) }, { trial_ends_at: "2099-01-01" }]) {
      const { error } = await A.db.from("businesses").update(patch as never).eq("id", A.businessId);
      expect(error, JSON.stringify(patch)).not.toBeNull();
    }
    const { data } = await admin.from("businesses").select("plan").eq("id", A.businessId).single();
    expect(data!.plan).toBe("trial");
  });
  it("users can only change read_at on notifications", async () => {
    await admin.from("notifications").insert({ business_id: A.businessId, type: "hot_lead", title: "orig" });
    const { error } = await A.db.from("notifications").update({ title: "forged" }).eq("business_id", A.businessId);
    expect(error).not.toBeNull();
  });
  it("users cannot call internal functions", async () => {
    expect((await A.db.rpc("rate_limit_hit", { p_key: "x", p_limit: 1, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await A.db.rpc("claim_lead_turn", { p_lead: bLead.id, p_seconds: 9999 })).error).not.toBeNull();
    expect((await A.db.rpc("leads_needing_ai", { p_limit: 100 })).error).not.toBeNull();
  });
  it("users cannot read internal tables", async () => {
    for (const t of ["webhook_events", "rate_limits"] as const) {
      const { data, error } = await A.db.from(t).select("*");
      expect(error !== null || (data ?? []).length === 0, t).toBe(true);
    }
  });
});

describe("anonymous access", () => {
  it.each([...TABLES, "businesses", "business_members", "webhook_events", "rate_limits"] as const)("anon cannot read %s", async (t) => {
    const { data, error } = await anon.from(t).select("*").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
  it("anon cannot create a business", async () => {
    expect((await anon.rpc("create_business", { p_name: "x" })).error).not.toBeNull();
  });
  it("anon cannot insert anything", async () => {
    expect((await anon.from("leads").insert({ business_id: B.businessId, name: "x" })).error).not.toBeNull();
  });
});
