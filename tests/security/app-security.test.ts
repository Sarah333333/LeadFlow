// Attacks against the running app over HTTP.
import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { admin, APP, callAction, createTenant, leadRow, messagesOf, mockMode, randomIp, seedLead, SERVICE_KEY, type Tenant } from "./helpers";

let A: Tenant, B: Tenant;
let bLead: Awaited<ReturnType<typeof seedLead>>;

beforeAll(async () => {
  await mockMode("ok");
  A = await createTenant("app-a");
  B = await createTenant("app-b");
  bLead = await seedLead(B.businessId, { name: "Victim Lead", status: "engaged" });
});

describe("authentication", () => {
  it.each(["/dashboard", "/leads", "/leads/new", "/notifications", "/settings", "/settings/billing", "/onboarding"])("%s requires login", async (p) => {
    const res = await fetch(APP + p, { redirect: "manual" });
    expect([302, 303, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });
  it("a forged / expired session cookie is rejected", async () => {
    // Deliberately forged session: an invalid access token for a real user ID (the attack under test).
    const fake = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify({ access_token: "forged-invalid-token", refresh_token: "x", user: { id: A.userId } })).toString("base64url")}`;
    const res = await fetch(APP + "/dashboard", { headers: { Cookie: fake }, redirect: "manual" });
    expect(res.headers.get("location")).toContain("/login");
  });
  it("server actions do nothing without a session", async () => {
    const before = (await messagesOf(bLead.id)).length;
    await callAction("ownerSendAction", [bLead.id, "unauthenticated"], null);
    await callAction("setAiPausedAction", [bLead.id, true], null);
    expect((await messagesOf(bLead.id)).length).toBe(before);
    expect((await leadRow(bLead.id)).ai_paused).toBe(false);
  });
});

describe("IDOR: tenant A calling actions with tenant B's lead ID", () => {
  it("cannot send a message to B's lead", async () => {
    const before = (await messagesOf(bLead.id)).length;
    const r = await callAction("ownerSendAction", [bLead.id, "hello from A"], A.cookie);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await messagesOf(bLead.id)).length).toBe(before);
  });
  it("cannot inject a simulated lead message (AI cost) into B's lead", async () => {
    const before = (await messagesOf(bLead.id)).length;
    await callAction("simulateLeadAction", [bLead.id, "hi"], A.cookie);
    expect((await messagesOf(bLead.id)).length).toBe(before);
  });
  it.each([
    ["setAiPausedAction", [true]], ["closeLeadAction", ["won", 999]], ["reopenLeadAction", []],
    ["resolveAttentionAction", []], ["deleteLeadAction", []],
  ])("%s has no effect on B's lead", async (name, extra) => {
    const before = await leadRow(bLead.id);
    await callAction(name as string, [bLead.id, ...(extra as unknown[])], A.cookie);
    const after = await leadRow(bLead.id);
    expect(after).toBeTruthy();
    expect({ s: after.status, p: after.ai_paused, v: after.estimated_value }).toEqual({ s: before.status, p: before.ai_paused, v: before.estimated_value });
  });
  it("cannot open B's lead page", async () => {
    const res = await fetch(`${APP}/leads/${bLead.id}`, { headers: { Cookie: A.cookie } });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("Victim Lead");
  });
  it("B's data never appears in A's pages", async () => {
    for (const p of ["/dashboard", "/leads", "/notifications"]) {
      const html = await (await fetch(APP + p, { headers: { Cookie: A.cookie } })).text();
      expect(html, p).not.toContain("Victim Lead");
    }
  });
  it("malformed IDs are rejected cleanly", async () => {
    const r = await callAction("ownerSendAction", ["' OR 1=1 --", "x"], A.cookie);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("CSRF", () => {
  it("server actions from a foreign origin are rejected", async () => {
    const own = await seedLead(A.businessId, { status: "engaged" });
    const before = (await messagesOf(own.id)).length;
    const r = await callAction("ownerSendAction", [own.id, "csrf"], A.cookie, { origin: "https://evil.example" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await messagesOf(own.id)).length).toBe(before);
  });
});

describe("input validation & injection", () => {
  it("search input cannot add filter clauses (PostgREST injection)", async () => {
    const res = await fetch(`${APP}/leads?q=${encodeURIComponent('x",business_id.neq.00000000-0000-0000-0000-000000000000,name.ilike."%')}`, { headers: { Cookie: A.cookie } });
    expect(res.status).toBe(200);
    expect(await res.text()).not.toContain("Victim Lead");
  });
  it("stored XSS payloads are rendered as text", async () => {
    const payload = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const lead = await seedLead(A.businessId, { name: payload, initial_message: payload });
    await admin.from("messages").insert({ business_id: A.businessId, lead_id: lead.id, direction: "inbound", sender: "lead", body: payload });
    const html = await (await fetch(`${APP}/leads/${lead.id}`, { headers: { Cookie: A.cookie } })).text();
    expect(html).not.toContain(`<img src=x onerror="alert(1)">`);
    expect(html).not.toContain("<script>alert(2)</script>");
    expect(html).toContain("&lt;img src=x");
  });
  it("business profile rejects javascript: URLs, oversized input and unknown fields", async () => {
    const base = { name: "Safe Biz", industry: "roofing", timezone: "Europe/Dublin", tone: "friendly", currency: "EUR" };
    for (const bad of [{ booking_link: "javascript:alert(1)" }, { description: "x".repeat(10_000) }, { plan: "pro" }, { timezone: "Mars/Base" }, { services: Array(100).fill({ name: "s", price_range: "", description: "" }) }]) {
      const r = await callAction("saveProfileAction", [{ ...base, ...bad }], A.cookie);
      expect(r.text, JSON.stringify(bad).slice(0, 60)).toContain("error");
    }
    const { data } = await admin.from("businesses").select("booking_link, plan").eq("id", A.businessId).single();
    expect(data!.booking_link ?? "").not.toContain("javascript");
    expect(data!.plan).toBe("trial");
  });
  it("oversized server action bodies are rejected", async () => {
    const r = await callAction("ownerSendAction", [bLead.id, "x".repeat(400_000)], A.cookie);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("open redirects", () => {
  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "/%2F%2Fevil.example"])("auth callback ignores next=%s", async (next) => {
    const res = await fetch(`${APP}/auth/callback?next=${encodeURIComponent(next)}`, { redirect: "manual" });
    const loc = new URL(res.headers.get("location")!, APP);
    expect(loc.origin).toBe(new URL(APP).origin);
  });
  it("intake form cannot redirect to foreign sites", async () => {
    const body = new URLSearchParams({ name: "R", email: `r${Date.now()}@x.example`, redirect: "https://evil.example/phish" });
    const res = await fetch(`${APP}/api/leads/intake/${A.intakeKey}`, { method: "POST", body, redirect: "manual", headers: { "x-forwarded-for": randomIp() } });
    expect(res.headers.get("location") ?? "").not.toContain("evil.example");
  });
});

describe("secrets & headers", () => {
  it("no server secret appears in any client bundle", () => {
    const secrets = [SERVICE_KEY, process.env.STRIPE_SECRET_KEY!, process.env.STRIPE_WEBHOOK_SECRET!, process.env.TWILIO_AUTH_TOKEN!,
      process.env.OPENAI_API_KEY!, process.env.CRON_SECRET!].filter(Boolean); // secret VALUES (variable names are not secrets)
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); });
    walk(".next/static");
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const content = readFileSync(f, "utf8");
      for (const s of secrets) expect(content.includes(s), `${s.slice(0, 12)}… in ${f}`).toBe(false);
    }
  });
  it.each(["/.env", "/.env.local", "/.git/config", "/package.json", "/next.config.ts"])("%s is not served", async (p) => {
    expect((await fetch(APP + p, { redirect: "manual" })).status).not.toBe(200);
  });
  it("security headers are set", async () => {
    const res = await fetch(APP + "/login");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toContain("max-age");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
  it("authenticated pages are not cacheable", async () => {
    const res = await fetch(APP + "/dashboard", { headers: { Cookie: A.cookie } });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

describe("CORS", () => {
  const EVIL = "https://evil.example";
  it.each(["/api/export", "/api/cron/follow-ups", "/api/webhooks/stripe", "/api/webhooks/twilio", "/api/webhooks/twilio/status", "/auth/callback"])(
    "%s does not allow cross-origin reads", async (p) => {
      const pre = await fetch(APP + p, { method: "OPTIONS", headers: { Origin: EVIL, "Access-Control-Request-Method": "POST" } });
      const get = await fetch(APP + p, { headers: { Origin: EVIL }, redirect: "manual" });
      for (const r of [pre, get]) {
        expect(r.headers.get("access-control-allow-origin"), p).toBeNull();
        expect(r.headers.get("access-control-allow-credentials"), p).toBeNull();
      }
    });
  it("authenticated pages never allow cross-origin reads", async () => {
    const res = await fetch(APP + "/dashboard", { headers: { Origin: EVIL, Cookie: A.cookie } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("the public intake endpoint allows any origin but NEVER with credentials (no cookies are used)", async () => {
    const res = await fetch(`${APP}/api/leads/intake/${A.intakeKey}`, { method: "OPTIONS", headers: { Origin: EVIL } });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });
});

describe("exposed files & debug mode", () => {
  it.each(["/.env.example", "/.git/HEAD", "/supabase/config.jsonc", "/supabase/migrations", "/backups/", "/docs/SECURITY.md",
    "/docs/legal/LEGAL_RISK_REGISTER.md", "/scripts/grant-admin.mjs", "/tsconfig.json", "/.next/server/server-reference-manifest.json",
    "/src/lib/env.ts", "/node_modules/next/package.json"])("%s is not served", async (p) => {
    const res = await fetch(APP + p, { redirect: "manual" });
    expect(res.status, p).not.toBe(200);
  });
  it("no JavaScript source maps are shipped to browsers", () => {
    const maps: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".map")) maps.push(p); });
    walk(".next/static");
    expect(maps).toEqual([]);
  });
  it("the app runs as a production build (no dev tooling, no stack traces)", async () => {
    const html = await (await fetch(APP + "/login")).text();
    expect(html).not.toMatch(/__nextjs_original-stack-frame|webpack-hmr|react-refresh|next-devtools/);
    // Trigger a server error: the response must not contain a stack trace or file paths
    const r = await callAction("ownerSendAction", ["not-a-uuid", "x"], A.cookie);
    expect(r.text).not.toMatch(/at \w+ \(|\/home\/|node_modules|\.ts:\d+/);
  });
  it("unknown routes reveal nothing: logged out → login redirect (no route enumeration); logged in → plain 404", async () => {
    const anonRes = await fetch(APP + "/definitely-not-a-page", { redirect: "manual" });
    expect(anonRes.headers.get("location")).toContain("/login");
    const res = await fetch(APP + "/definitely-not-a-page", { headers: { Cookie: A.cookie } });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/\/home\/|node_modules|at \w+ \(/i);
  });
});
