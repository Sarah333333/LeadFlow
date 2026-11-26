import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarClock, MessagesSquare, Plus } from "lucide-react";
import { Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, TemperatureBadge } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, initials, money, relative } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const RANGES = [{ v: "7", l: "7 days" }, { v: "30", l: "30 days" }, { v: "90", l: "90 days" }];
const OPEN = ["new", "contacted", "engaged", "qualified"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; welcome?: string }> }) {
  const { business } = await requireBusiness();
  const { range = "30", welcome } = await searchParams;
  const days = Number(RANGES.find((r) => r.v === range)?.v ?? 30);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const supabase = await createClient();

  const [{ data: all }, { data: recent }, { data: upcoming }, { count: sentFollowUps }] = await Promise.all([
    supabase.from("leads").select("id, name, created_at, status, temperature, last_inbound_at, first_response_at, estimated_value, closed_at, needs_attention, attention_reason"),
    supabase.from("leads").select("id, name, temperature, last_message_preview, last_message_at, service_requested")
      .not("last_message_at", "is", null).order("last_message_at", { ascending: false }).limit(6),
    supabase.from("follow_ups").select("id, scheduled_for, step, lead_id, leads(name)").eq("status", "pending").order("scheduled_for").limit(5),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "sent").gte("processed_at", since),
  ]);

  const leads = all ?? [];
  const inRange = leads.filter((l) => l.created_at >= since);
  const open = leads.filter((l) => OPEN.includes(l.status));
  const temp = { hot: 0, warm: 0, cold: 0 } as Record<string, number>;
  open.forEach((l) => { temp[l.temperature] = (temp[l.temperature] ?? 0) + 1; });
  const won = leads.filter((l) => l.status === "won" && l.closed_at && l.closed_at >= since);
  const wonRevenue = won.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const hotPipeline = open.filter((l) => l.temperature === "hot").reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const conversion = inRange.length ? Math.round((inRange.filter((l) => l.status === "won").length / inRange.length) * 100) : 0;
  const responded = inRange.filter((l) => l.last_inbound_at).length;
  const responseRate = inRange.length ? Math.round((responded / inRange.length) * 100) : 0;
  const speeds = inRange.filter((l) => l.first_response_at)
    .map((l) => (new Date(l.first_response_at!).getTime() - new Date(l.created_at).getTime()) / 1000);
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
  const attention = leads.filter((l) => l.needs_attention && !["won", "lost", "opted_out"].includes(l.status)).slice(0, 5);
  const totalOpen = open.length;

  return (
    <>
      <PageHeader title={`Good ${greeting(business.timezone)}`} description={`Here's how ${business.name}'s leads are doing.`}
        actions={
          <>
            <div className="flex rounded-lg border border-line bg-surface p-1">
              {RANGES.map((r) => (
                <Link key={r.v} href={`/dashboard?range=${r.v}`}
                  className={cn("rounded-md px-2.5 py-1 text-[13px] transition", range === r.v ? "bg-ink text-white" : "text-ink-2 hover:bg-black/[0.04]")}>{r.l}</Link>
              ))}
            </div>
            <LinkButton href="/leads/new" variant="brand"><Plus className="size-4" /> Add lead</LinkButton>
          </>
        } />

      {welcome && (
        <Notice tone="success" className="mb-6">
          You&apos;re all set. Try it now: <Link href="/leads/new" className="font-medium underline underline-offset-2">add a test lead</Link> and play the customer to see how your assistant responds.
        </Notice>
      )}

      {attention.length > 0 && (
        <Card className="mb-6 border-hot/25">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm font-semibold"><AlertCircle className="size-4 text-hot" /> Needs you ({attention.length})</div>
          <ul className="divide-y divide-line">
            {attention.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-canvas/70">
                  <span className="min-w-0"><span className="font-medium">{l.name}</span> <span className="text-muted">· {l.attention_reason}</span></span>
                  <ArrowRight className="size-4 shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total leads" value={leads.length} sub={`${totalOpen} open`} />
        <Stat label="New leads" value={inRange.length} sub={`last ${days} days`} />
        <Stat label="Conversion rate" value={`${conversion}%`} sub={`${won.length} won in period`} />
        <Stat label="Estimated revenue" value={money(wonRevenue, business.currency)} sub={`+ ${money(hotPipeline, business.currency)} in hot leads`} />
        <Stat label="Response rate" value={`${responseRate}%`} sub={`${responded} of ${inRange.length} leads replied`} />
        <Stat label="Avg. first reply" value={avgSpeed == null ? "—" : formatSpeed(avgSpeed)} sub="speed to lead" />
        <Stat label="Follow-ups sent" value={sentFollowUps ?? 0} sub={`${upcoming?.length ?? 0} scheduled next`} />
        <Stat label="Hot leads" value={temp.hot} sub="ready to call" accent={temp.hot > 0} />
      </div>

      {/* Temperature split of open leads */}
      <Card className="mt-3 p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Open leads by temperature</h2>
          <span className="text-[13px] text-muted">{totalOpen} open</span>
        </div>
        {totalOpen === 0 ? (
          <div className="h-2.5 rounded-full bg-black/[0.05]" />
        ) : (
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img"
            aria-label={`Hot ${temp.hot}, warm ${temp.warm}, cold ${temp.cold}`}>
            {(["hot", "warm", "cold"] as const).map((t) => temp[t] > 0 && (
              <div key={t} title={`${t}: ${temp[t]}`} className={cn("h-full", { hot: "bg-hot", warm: "bg-warm", cold: "bg-cold" }[t])}
                style={{ width: `${(temp[t] / totalOpen) * 100}%` }} />
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {(["hot", "warm", "cold"] as const).map((t) => (
            <Link key={t} href={`/leads?t=${t}`} className="flex items-center gap-2 text-[13px] text-ink-2 hover:text-ink">
              <span className={cn("size-2 rounded-full", { hot: "bg-hot", warm: "bg-warm", cold: "bg-cold" }[t])} />
              <span className="capitalize">{t}</span>
              <span className="font-semibold tabular-nums text-ink">{temp[t]}</span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Recent conversations" action={<Link href="/leads" className="text-[13px] font-medium text-ink-2 hover:text-ink">View all</Link>} />
          {recent?.length ? (
            <ul className="divide-y divide-line">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/70">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas text-xs font-medium text-ink-2 ring-1 ring-line">{initials(l.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{l.name}</span><TemperatureBadge value={l.temperature} /></span>
                      <span className="block truncate text-[13px] text-muted">{l.last_message_preview}</span>
                    </span>
                    <span className="shrink-0 text-xs text-faint">{relative(l.last_message_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<MessagesSquare className="size-5" />} title="No conversations yet"
              description="Add a lead and the assistant will start the conversation within seconds."
              action={<LinkButton href="/leads/new" variant="brand"><Plus className="size-4" /> Add lead</LinkButton>} />
          )}
        </Card>

        <Card>
          <CardHeader title="Follow-up status" description="Next automatic nudges" />
          {upcoming?.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((f) => (
                <li key={f.id}>
                  <Link href={`/leads/${f.lead_id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-canvas/70">
                    <span className="flex items-center gap-2.5"><CalendarClock className="size-4 text-faint" />
                      <span><span className="font-medium">{(f.leads as unknown as { name: string } | null)?.name}</span> <span className="text-muted">· #{f.step + 1}</span></span>
                    </span>
                    <span className="text-[13px] text-ink-2">{relative(f.scheduled_for)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-8 text-center text-[13px] text-muted">Nothing scheduled. Follow-ups appear when a lead goes quiet.</p>}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        {accent && <span className="size-1.5 rounded-full bg-hot" aria-hidden />}{label}
      </div>
      <div className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-faint">{sub}</div>}
    </Card>
  );
}

function formatSpeed(s: number) {
  if (s < 60) return `${Math.max(1, Math.round(s))}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
