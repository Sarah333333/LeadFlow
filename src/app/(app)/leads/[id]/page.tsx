import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Bot, FlaskConical, Mail, MapPin, Phone, Sparkles, Wrench } from "lucide-react";
import { Card, CardHeader, Notice, StatusBadge, TemperatureBadge } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aiProviderName } from "@/lib/ai";
import { LEAD_SOURCES } from "@/lib/types";
import { cn, formatDate, money, relative } from "@/lib/utils";
import { Conversation } from "./conversation";
import { DeleteLead, LeadActions, ResolveAttention } from "./lead-actions";
import { ConsentControls } from "./consent";

const EVENT_LABELS: Record<string, string> = {
  created: "Lead created", scored: "Score updated", ai_paused: "AI paused", ai_resumed: "AI resumed",
  owner_took_over: "You took over the conversation", marked_won: "Marked as won", marked_lost: "Marked as lost",
  reopened: "Reopened", opted_out: "Lead opted out (STOP)", send_failed: "Message failed to send",
  ai_guarded: "Safety check rewrote an AI reply",
};

const CONSENT_BASIS: Record<string, string> = {
  inbound_message: "They texted the business first", web_form_checkbox: "Ticked consent box on web form",
  owner_attestation: "Confirmed by you", keyword_stop: "Replied STOP / asked to stop", keyword_start: "Replied START",
  ai_detected_opt_out: "Asked the assistant to stop", owner_marked_do_not_contact: "Marked do not contact by you",
  api: "Via integration", legacy_pre_consent_tracking: "Before consent tracking existed — please verify",
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const [{ data: messages }, { data: followUps }, { data: events }, { data: consent }] = await Promise.all([
    supabase.from("messages").select("*").eq("lead_id", id).order("created_at"),
    supabase.from("follow_ups").select("*").eq("lead_id", id).order("scheduled_for", { ascending: false }),
    supabase.from("lead_events").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("consent_events").select("action, basis, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  // Cancelling a nudge because the lead replied is the system working as intended — don't clutter the panel.
  const visibleFollowUps = (followUps ?? []).filter((f) => !(f.status === "cancelled" && f.note === "Lead replied"));
  const details = Object.entries((lead.details ?? {}) as Record<string, string>).filter(([, v]) => v);
  const isTest = lead.channel === "test";

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> All leads
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight">{lead.name}</h1>
            <TemperatureBadge value={lead.temperature} />
            <StatusBadge value={lead.status} />
            {isTest && <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-1.5 py-0.5 text-xs text-muted ring-1 ring-line"><FlaskConical className="size-3" /> Test lead</span>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {lead.service_requested ?? "Service not specified"} · {LEAD_SOURCES.find((s) => s.value === lead.source)?.label ?? lead.source} · {relative(lead.created_at)}
          </p>
        </div>
        <LeadActions leadId={lead.id} aiPaused={lead.ai_paused} status={lead.status}
          defaultValue={lead.estimated_value ? Number(lead.estimated_value) : null} currency={business.currency} />
      </div>

      {lead.needs_attention && (
        <Notice tone="warn" className="mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" /> {lead.attention_reason ?? "This lead needs your attention."}</span>
          <ResolveAttention leadId={lead.id} />
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-sm font-semibold">Conversation</h2>
            <span className={cn("inline-flex items-center gap-1.5 text-xs", lead.ai_paused ? "text-muted" : "text-brand")}>
              <span className={cn("size-1.5 rounded-full", lead.ai_paused ? "bg-faint" : "bg-brand")} />
              {lead.ai_paused ? "AI paused — you're in control" : `AI active${aiProviderName() === "demo" ? " (demo AI)" : ""}`}
            </span>
          </div>
          <Conversation leadId={lead.id} leadName={lead.name} messages={messages ?? []} isTest={isTest}
            aiPaused={lead.ai_paused} optedOut={lead.status === "opted_out"} />
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">Lead score</span>
                <span className="text-2xl font-semibold tabular-nums">{lead.score}<span className="text-sm font-normal text-faint">/100</span></span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                <div className={cn("h-full rounded-full", lead.score >= 80 ? "bg-hot" : lead.score >= 45 ? "bg-warm" : "bg-cold")} style={{ width: `${lead.score}%` }} />
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-canvas p-3">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
                <div>
                  <p className="text-[13px] leading-relaxed text-ink-2">{lead.ai_summary ?? "The summary appears after the assistant's first reply."}</p>
                  {lead.ai_summary && <p className="mt-1.5 text-[11px] text-faint">AI-generated summary — check the conversation before relying on it.</p>}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Contact" />
            <dl className="space-y-2.5 p-5 text-sm">
              <Row icon={Phone}>{lead.phone ? <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a> : "—"}</Row>
              <Row icon={Mail}>{lead.email ? <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a> : "—"}</Row>
              <Row icon={MapPin}>{lead.location ?? details.find(([k]) => /location|area|town/i.test(k))?.[1] ?? "—"}</Row>
              <Row icon={Wrench}>{lead.service_requested ?? "—"}</Row>
              {lead.estimated_value != null && <div className="flex justify-between border-t border-line pt-2.5 text-[13px]"><span className="text-muted">{lead.status === "won" ? "Job value" : "Estimated value"}</span><span className="font-medium">{money(Number(lead.estimated_value), business.currency)}</span></div>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Important details" description="Extracted by AI from what the customer said — verify before quoting" />
            {details.length ? (
              <dl className="divide-y divide-line">
                {details.map(([k, v]) => (
                  <div key={k} className="px-5 py-2.5 text-[13px]">
                    <dt className="text-muted">{k}</dt>
                    <dd className="mt-0.5 text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="p-5 text-[13px] text-muted">Nothing collected yet.</p>}
          </Card>

          <Card>
            <CardHeader title="Messaging consent" />
            <div className="space-y-3 p-5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Text messages (SMS)</span>
                <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium",
                  lead.do_not_contact || lead.sms_consent === "revoked" ? "bg-danger-soft text-danger" : lead.sms_consent === "granted" ? "bg-brand-soft text-brand" : "bg-canvas text-muted ring-1 ring-line")}>
                  {lead.do_not_contact ? "Do not contact" : lead.sms_consent === "granted" ? "Consent recorded" : lead.sms_consent === "revoked" ? "Opted out" : "No consent recorded"}
                </span>
              </div>
              {lead.sms_consent_source && <p className="text-xs text-muted">{CONSENT_BASIS[lead.sms_consent_source] ?? lead.sms_consent_source} · {formatDate(lead.sms_consent_at, "d MMM yyyy, HH:mm")}</p>}
              {(consent ?? []).length > 1 && (
                <ul className="space-y-1 border-t border-line pt-2 text-xs text-muted">
                  {consent!.map((c, i) => <li key={i}>{c.action} · {CONSENT_BASIS[c.basis] ?? c.basis} · {formatDate(c.created_at, "d MMM, HH:mm")}</li>)}
                </ul>
              )}
              <ConsentControls leadId={lead.id} doNotContact={lead.do_not_contact}
                canRecord={!!lead.phone && lead.sms_consent === "none" && !lead.do_not_contact && lead.status !== "opted_out"} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Follow-ups" />
            {visibleFollowUps.length ? (
              <ul className="divide-y divide-line">
                {visibleFollowUps.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                    <span><span className="font-medium">#{f.step + 1}</span> <span className="text-muted">{f.status === "pending" ? relative(f.scheduled_for) : formatDate(f.processed_at ?? f.scheduled_for, "d MMM, HH:mm")}</span>
                      {f.note && <span className="block text-xs text-faint">{f.note}</span>}</span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-xs capitalize",
                      f.status === "pending" ? "bg-warm-soft text-warm" : f.status === "sent" ? "bg-brand-soft text-brand" : "bg-canvas text-muted")}>{f.status}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-[13px] text-muted">{lead.ai_paused ? "Paused while you\u2019re in control." : lead.status === "qualified" ? "Not needed — the lead is waiting on your team." : "None scheduled."}</p>}
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ul className="space-y-2.5 p-5">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex gap-2.5 text-[13px]">
                  <Bot className="mt-0.5 size-3.5 shrink-0 text-faint" />
                  <span className="flex-1 text-ink-2">
                    {EVENT_LABELS[e.type] ?? e.type}
                    {e.type === "scored" && ` → ${(e.data as { to?: number }).to}`}
                    {e.type === "marked_won" && (e.data as { value?: number }).value ? ` · ${money((e.data as { value: number }).value, business.currency)}` : ""}
                  </span>
                  <span className="text-xs text-faint">{relative(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <a href={`/api/export?lead=${lead.id}`} className="text-[13px] text-muted hover:text-ink">Export this lead (JSON)</a>
            <DeleteLead leadId={lead.id} name={lead.name} />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 text-ink-2"><Icon className="size-3.5 shrink-0 text-faint" />{children}</div>;
}
