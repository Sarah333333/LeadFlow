"use client";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardHeader, Notice } from "@/components/ui";
import { SaveBar } from "@/components/save-bar";
import { cn } from "@/lib/utils";
import { saveFollowUpsAction } from "../actions";

type State = { follow_up_delays_hours: number[]; quiet_hours_start: number; quiet_hours_end: number };
const UNITS = [{ l: "hours", h: 1 }, { l: "days", h: 24 }];
const hours = Array.from({ length: 24 }, (_, i) => i);

export function FollowUpForm({ initial, maxSteps, planName }: { initial: State; maxSteps: number; planName: string }) {
  const [s, setS] = useState(initial);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = useTransition();
  const delays = s.follow_up_delays_hours;
  const setDelays = (d: number[]) => { setS({ ...s, follow_up_delays_hours: d }); setResult(undefined); };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => setResult(await saveFollowUpsAction(s))); }}>
      <Card>
        <CardHeader title="Follow-up schedule" description="If a lead stops replying, the assistant sends a short, friendly nudge after each delay. Any reply stops the sequence." />
        <ol className="divide-y divide-line">
          {delays.map((h, i) => {
            const unit = h % 24 === 0 ? UNITS[1] : UNITS[0];
            return (
              <li key={i} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", i >= maxSteps && "opacity-50")}>
                <span className="grid size-6 place-items-center rounded-full bg-canvas text-xs font-medium ring-1 ring-line">{i + 1}</span>
                <span className="text-sm text-ink-2">Send follow-up after</span>
                <input type="number" min={1} className="field w-20 py-1.5" value={h / unit.h}
                  onChange={(e) => setDelays(delays.map((d, j) => (j === i ? Math.max(1, Number(e.target.value)) * unit.h : d)))} />
                <select className="field w-auto py-1.5" value={unit.l}
                  onChange={(e) => { const u = UNITS.find((x) => x.l === e.target.value)!; setDelays(delays.map((d, j) => (j === i ? Math.max(1, Math.round(d / unit.h)) * u.h : d))); }}>
                  {UNITS.map((u) => <option key={u.l}>{u.l}</option>)}
                </select>
                <span className="text-sm text-muted">of silence</span>
                {i >= maxSteps && <span className="text-xs text-warm">Not included in {planName}</span>}
                <button type="button" aria-label="Remove" onClick={() => setDelays(delays.filter((_, j) => j !== i))} className="ml-auto rounded-md p-1 text-faint hover:bg-black/5 hover:text-ink"><X className="size-4" /></button>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-line px-5 py-3">
          <button type="button" disabled={delays.length >= 8} onClick={() => setDelays([...delays, (delays.at(-1) ?? 24) * 2])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink disabled:opacity-40"><Plus className="size-4" /> Add follow-up</button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Quiet hours" description="Follow-ups due during quiet hours wait until the morning (your time zone)." />
        <div className="flex flex-wrap items-center gap-3 p-5 text-sm">
          No follow-ups between
          <select className="field w-auto py-1.5" value={s.quiet_hours_start} onChange={(e) => setS({ ...s, quiet_hours_start: Number(e.target.value) })}>
            {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
          </select>
          and
          <select className="field w-auto py-1.5" value={s.quiet_hours_end} onChange={(e) => setS({ ...s, quiet_hours_end: Number(e.target.value) })}>
            {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
          </select>
        </div>
      </Card>
      <Notice>Replies to a lead&apos;s message are always instant. Quiet hours only apply to automatic follow-ups.</Notice>
      <SaveBar pending={pending} result={result} />
    </form>
  );
}
