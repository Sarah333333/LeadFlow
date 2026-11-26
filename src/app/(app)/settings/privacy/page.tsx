import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_RESPONSIBILITIES, LEGAL_VERSIONS } from "@/lib/compliance/legal";
import { formatDate } from "@/lib/utils";
import { AiModeControl, DataControls, DeleteAccount } from "./controls";

export const metadata = { title: "Privacy & AI" };

export default async function PrivacySettingsPage() {
  const { user, business: b } = await requireBusiness();
  const supabase = await createClient();
  const [{ data: agreements }, { data: auditRows }, { count: suppressed }] = await Promise.all([
    supabase.from("agreements").select("document, version, accepted_at").eq("user_id", user.id).order("accepted_at", { ascending: false }),
    supabase.from("audit_log").select("action, actor_type, created_at, details").order("created_at", { ascending: false }).limit(25),
    supabase.from("suppression_list").select("phone_hash", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Assistant mode" description="Choose how much the assistant does on its own. Change it at any time — it takes effect immediately." />
        <div className="p-5"><AiModeControl mode={b.ai_mode as "auto" | "review" | "off"} acknowledgedAt={b.ai_mode_acknowledged_at} responsibilities={BUSINESS_RESPONSIBILITIES} /></div>
      </Card>

      <Card>
        <CardHeader title="Customer data" description="How long LeadFlow keeps your customers' data, and how much the assistant may send." />
        <div className="p-5"><DataControls retentionDays={b.retention_days} maxPerLead={b.max_ai_messages_per_lead_per_day} /></div>
      </Card>

      <Card>
        <CardHeader title="Export & access requests" description="Download everything LeadFlow holds about your customers (for your records or a customer's access request)." />
        <div className="flex flex-wrap items-center gap-3 p-5 text-sm">
          <a href="/api/export" className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-4 font-medium hover:bg-canvas">Download all data (JSON)</a>
          <span className="text-[13px] text-muted">For one customer, use “Export this lead” on their page. To erase a customer, use “Delete lead &amp; conversation”.</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Messaging consent" />
        <div className="space-y-2 p-5 text-[13px] text-ink-2">
          <p>LeadFlow only texts people with a recorded reason to: they texted you first, ticked a consent box on your form, or you confirmed they asked to be texted. Anyone who replies STOP (or asks to stop) is never texted again.</p>
          <p className="text-muted">{suppressed ?? 0} number{suppressed === 1 ? "" : "s"} on your do-not-text list. These are stored as one-way hashes and kept even after a lead is deleted, so opt-outs keep being honoured.</p>
          <p className="text-muted">You are responsible for making sure your messaging is lawful where you and your customers are. LeadFlow&apos;s controls help, but don&apos;t guarantee that.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Agreements" />
        <ul className="divide-y divide-line text-[13px]">
          {(agreements ?? []).map((a, i) => (
            <li key={i} className="flex justify-between px-5 py-2.5">
              <span><Link href={a.document === "privacy" ? "/privacy" : "/terms"} className="font-medium hover:underline">{a.document.replace("_", " ")}</Link> <span className="text-muted">· version {a.version}{a.version !== LEGAL_VERSIONS[a.document as keyof typeof LEGAL_VERSIONS] ? " (outdated)" : ""}</span></span>
              <span className="text-muted">{formatDate(a.accepted_at, "d MMM yyyy")}</span>
            </li>
          ))}
          {!agreements?.length && <li className="px-5 py-3 text-muted">No agreements recorded.</li>}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Activity log" description="Important changes and automated actions on your account." />
        <ul className="divide-y divide-line text-[13px]">
          {(auditRows ?? []).map((r, i) => (
            <li key={i} className="flex justify-between gap-3 px-5 py-2">
              <span><span className="font-medium">{r.action}</span> <span className="text-muted">· {r.actor_type === "user" ? "you" : r.actor_type}</span></span>
              <span className="shrink-0 text-muted">{formatDate(r.created_at, "d MMM, HH:mm")}</span>
            </li>
          ))}
          {!auditRows?.length && <li className="px-5 py-3 text-muted">Nothing yet.</li>}
        </ul>
      </Card>

      <Card className="border-danger/25">
        <CardHeader title="Delete account" description="Permanently deletes your business, every customer conversation and your login. Your subscription is cancelled first. This cannot be undone." />
        <div className="p-5"><DeleteAccount businessName={b.name} /></div>
      </Card>
    </div>
  );
}
