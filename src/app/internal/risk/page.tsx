import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { LAUNCH_CHECKLIST, RISKS, STATUS_LABEL, type RiskStatus } from "@/lib/compliance/risk-register";
import { LEGAL_DOCS_ARE_DRAFTS, LEGAL_VERSIONS } from "@/lib/compliance/legal";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Internal — legal & operational risk", robots: { index: false } };

const statusStyle: Record<RiskStatus, string> = {
  open: "bg-danger-soft text-danger", needs_legal_review: "bg-warm-soft text-warm",
  technical_controls: "bg-cold-soft text-cold", reviewed_by_counsel: "bg-brand-soft text-brand",
};

export default async function RiskDashboard() {
  // Operators only. Anyone else gets a 404 (the page's existence isn't revealed).
  if (!isPlatformAdmin(await getUser())) notFound();

  const { data: posture } = await createAdminClient().rpc("security_posture");
  const p = posture?.[0];
  const checks = [
    { label: "Row Level Security on every table", ok: p ? p.tables_without_rls.length === 0 : false, detail: p ? (p.tables_without_rls.length ? `Missing: ${p.tables_without_rls.join(", ")}` : `${p.tables_total} tables`) : "unknown" },
    { label: "Demo AI disabled in production", ok: !env.allowDemoAi || process.env.NODE_ENV !== "production", detail: process.env.NODE_ENV },
    { label: "Cron secret is long enough", ok: (env.cronSecret ?? "").length >= 32, detail: `${(env.cronSecret ?? "").length} chars (≥32 required)` },
    { label: "Retention purge has run", ok: Boolean(p?.last_retention_purge), detail: p?.last_retention_purge ? formatDate(p.last_retention_purge, "d MMM yyyy HH:mm") : "never (normal if nothing has expired yet)" },
    { label: "Leads with pre-tracking ('legacy') SMS consent", ok: (p?.legacy_consent_leads ?? 0) === 0, detail: `${p?.legacy_consent_leads ?? "?"} — review or re-confirm` },
    { label: "Businesses on Auto without acknowledgement", ok: (p?.auto_mode_without_ack ?? 0) === 0, detail: `${p?.auto_mode_without_ack ?? "?"} (pre-existing accounts) — ask them to confirm` },
    { label: "Terms & Privacy Policy reviewed by counsel", ok: !LEGAL_DOCS_ARE_DRAFTS, detail: LEGAL_DOCS_ARE_DRAFTS ? `DRAFT (${LEGAL_VERSIONS.terms})` : "reviewed" },
  ];
  const areas = [...new Set(RISKS.map((r) => r.area))];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Legal & operational risk register</h1>
      <div className="mt-4 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
        Internal tracking tool. <strong>Completing this checklist does not mean LeadFlow is legally compliant</strong>, and nothing here is legal advice.
        Items marked for legal review must be reviewed by a qualified lawyer before launch.
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Live checks</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span>{c.label}</span>
            <span className={cn("rounded-md px-2 py-0.5 text-xs", c.ok ? "bg-brand-soft text-brand" : "bg-warm-soft text-warm")}>{c.ok ? "OK" : "Attention"} · {c.detail}</span>
          </li>
        ))}
      </ul>

      {areas.map((area) => (
        <section key={area} className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">{area} risks</h2>
          <div className="space-y-3">
            {RISKS.filter((r) => r.area === area).map((r) => (
              <details key={r.id} className="rounded-xl border border-line bg-surface p-4">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                  <span><span className="text-muted">{r.id}</span> · <span className="font-medium">{r.title}</span> <span className="text-xs text-muted">({r.severity})</span></span>
                  <span className={cn("rounded-md px-2 py-0.5 text-xs", statusStyle[r.status])}>{STATUS_LABEL[r.status]}{r.reviewedBy ? ` — ${r.reviewedBy}, ${r.reviewedOn}` : ""}</span>
                </summary>
                <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                  <div><dt className="font-medium">Why it matters</dt><dd className="text-ink-2">{r.why}</dd></div>
                  <div><dt className="font-medium">Technical protection</dt><dd className="text-ink-2">{r.technical}</dd></div>
                  <div><dt className="font-medium">Policy / contract protection</dt><dd className="text-ink-2">{r.policy}</dd></div>
                  <div><dt className="font-medium">Needs a qualified lawyer</dt><dd className="text-ink-2">{r.lawyer}</dd></div>
                </dl>
              </details>
            ))}
          </div>
        </section>
      ))}

      <h2 className="mb-3 mt-10 text-sm font-semibold">Before launch</h2>
      <ol className="list-decimal space-y-1.5 rounded-xl border border-line bg-surface py-4 pl-9 pr-4 text-sm">
        {LAUNCH_CHECKLIST.map((item) => <li key={item}>{item} <span className="text-xs text-muted">— record evidence in docs/legal/LAUNCH_CHECKLIST.md</span></li>)}
      </ol>
    </main>
  );
}
