import Link from "next/link";
import { AlertCircle, Plus, Search, Users } from "lucide-react";
import { Card, EmptyState, LinkButton, PageHeader, ScoreBar, StatusBadge, TemperatureBadge } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LEAD_SOURCES, STATUS_LABELS } from "@/lib/types";
import { cn, formatDate, relative } from "@/lib/utils";

export const metadata = { title: "Leads" };

const TEMPS = [
  { value: "", label: "All" }, { value: "hot", label: "Hot" }, { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" }, { value: "attention", label: "Needs you" },
];
const sourceLabel = (s: string) => LEAD_SOURCES.find((x) => x.value === s)?.label ?? s;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ t?: string; status?: string; q?: string }> }) {
  await requireBusiness();
  const { t = "", status = "", q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (t === "attention") query = query.eq("needs_attention", true);
  else if (["hot", "warm", "cold"].includes(t)) query = query.eq("temperature", t);
  if (status in STATUS_LABELS) query = query.eq("status", status);
  if (q) {
    // Quote the value for PostgREST's filter syntax so input can never add extra filter clauses.
    // (RLS still restricts results to this business regardless.)
    const term = q.slice(0, 80).replace(/[%_*\\"]/g, " ").trim();
    const v = `"%${term}%"`;
    if (term) query = query.or(`name.ilike.${v},phone.ilike.${v},email.ilike.${v},service_requested.ilike.${v}`);
  }
  const { data: leads } = await query;
  const href = (p: Record<string, string>) => {
    const s = new URLSearchParams({ t, status, q, ...p });
    [...s.keys()].forEach((k) => !s.get(k) && s.delete(k));
    return `/leads${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Leads" description="Every enquiry and where it stands."
        actions={<LinkButton href="/leads/new" variant="brand"><Plus className="size-4" /> Add lead</LinkButton>} />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {TEMPS.map((x) => (
            <Link key={x.value} href={href({ t: x.value })}
              className={cn("rounded-md px-3 py-1 text-[13px] whitespace-nowrap transition", t === x.value ? "bg-ink text-white" : "text-ink-2 hover:bg-black/[0.04]")}>
              {x.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action="/leads">
          {t && <input type="hidden" name="t" value={t} />}
          <select name="status" defaultValue={status} className="field w-auto py-1.5">
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input name="q" defaultValue={q} placeholder="Search leads" className="field w-full py-1.5 pl-8 md:w-56" />
          </div>
        </form>
      </div>

      <Card className="overflow-hidden">
        {!leads?.length ? (
          <EmptyState icon={<Users className="size-5" />} title={q || t || status ? "No leads match" : "No leads yet"}
            description={q || t || status ? "Try a different filter." : "Add a lead manually, or connect your website form in Settings → Lead intake."}
            action={!q && !t && !status ? <LinkButton href="/leads/new" variant="brand"><Plus className="size-4" /> Add your first lead</LinkButton> : undefined} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-medium text-muted">
                    {["Name", "Source", "Service", "Score", "Status", "Last message", "Next follow-up", "Created"].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-medium first:pl-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {leads.map((l) => (
                    <tr key={l.id} className="group relative transition hover:bg-canvas/70">
                      <td className="py-3 pl-5 pr-4">
                        <Link href={`/leads/${l.id}`} className="absolute inset-0" aria-label={`Open ${l.name}`} />
                        <div className="flex items-center gap-2 font-medium text-ink">
                          {l.name}
                          {l.needs_attention && <AlertCircle className="size-3.5 text-hot" aria-label="Needs attention" />}
                        </div>
                        <div className="text-xs text-muted">{l.phone ?? l.email ?? "—"}</div>
                      </td>
                      <td className="px-4 text-ink-2">{sourceLabel(l.source)}</td>
                      <td className="max-w-[160px] truncate px-4 text-ink-2">{l.service_requested ?? "—"}</td>
                      <td className="px-4"><div className="flex flex-col gap-1"><TemperatureBadge value={l.temperature} /><ScoreBar score={l.score} /></div></td>
                      <td className="px-4"><StatusBadge value={l.status} /></td>
                      <td className="max-w-[240px] px-4">
                        <div className="truncate text-ink-2">{l.last_message_preview ?? "—"}</div>
                        <div className="text-xs text-faint">{relative(l.last_message_at)}</div>
                      </td>
                      <td className="px-4 text-ink-2">{l.next_follow_up_at ? relative(l.next_follow_up_at) : <span className="text-faint">—</span>}</td>
                      <td className="px-4 text-ink-2 whitespace-nowrap">{formatDate(l.created_at, "d MMM")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-line lg:hidden">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="block px-4 py-3.5 active:bg-canvas">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-medium">{l.name}{l.needs_attention && <AlertCircle className="size-3.5 text-hot" />}</span>
                      <TemperatureBadge value={l.temperature} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{l.service_requested ?? "—"} · {sourceLabel(l.source)} · {relative(l.created_at)}</div>
                    <div className="mt-1.5 truncate text-sm text-ink-2">{l.last_message_preview}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
