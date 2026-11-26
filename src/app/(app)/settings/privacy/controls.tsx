"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { deleteAccountAction, saveDataSettingsAction, setAiModeAction } from "../actions";

const MODES = [
  { id: "review", title: "Review first", desc: "The assistant drafts every reply; nothing is sent until you approve it. Automatic follow-ups are off." },
  { id: "auto", title: "Automatic", desc: "The assistant replies and follows up on its own, within your rules. You can take over any conversation." },
  { id: "off", title: "Off", desc: "The assistant does nothing. All pending automatic follow-ups are cancelled immediately." },
] as const;

export function AiModeControl({ mode, acknowledgedAt, responsibilities }: { mode: "auto" | "review" | "off"; acknowledgedAt: string | null; responsibilities: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(mode);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await setAiModeAction({ mode: selected, acknowledged: ack }); setResult(r); router.refresh(); });
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button type="button" key={m.id} onClick={() => { setSelected(m.id); setResult(undefined); }}
            className={cn("rounded-lg border p-3 text-left transition", selected === m.id ? "border-ink ring-4 ring-black/5" : "border-line hover:border-line-strong")}>
            <div className="flex items-center gap-2 text-sm font-medium">{m.title}{mode === m.id && <span className="rounded bg-canvas px-1.5 text-[11px] text-muted ring-1 ring-line">current</span>}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">{m.desc}</p>
          </button>
        ))}
      </div>
      {selected === "auto" && mode !== "auto" && (
        <div className="rounded-lg border border-line bg-canvas/60 p-4">
          <p className="mb-2 text-sm font-medium">Before switching on automatic sending, please confirm:</p>
          <ul className="mb-3 list-disc space-y-1 pl-5 text-[13px] text-ink-2">{responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" /> I confirm the statements above.</label>
        </div>
      )}
      {mode === "auto" && acknowledgedAt && <p className="text-xs text-muted">Automatic sending confirmed on {formatDate(acknowledgedAt, "d MMM yyyy")}.</p>}
      {result?.error && <Notice tone="danger">{result.error}</Notice>}
      {result?.ok && <Notice tone="success">Saved — the change is already in effect.</Notice>}
      <div className="flex justify-end"><Button onClick={save} disabled={pending || selected === mode}>{pending ? "Saving…" : "Save mode"}</Button></div>
    </div>
  );
}

const RETENTION = [{ v: 90, l: "90 days" }, { v: 180, l: "6 months" }, { v: 365, l: "1 year" }, { v: 730, l: "2 years" }, { v: 1095, l: "3 years" }];

export function DataControls({ retentionDays, maxPerLead }: { retentionDays: number | null; maxPerLead: number }) {
  const [retention, setRetention] = useState<number | null>(retentionDays);
  const [cap, setCap] = useState(maxPerLead);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4 text-sm">
      <label className="flex flex-wrap items-center gap-3">
        <span className="w-64 text-ink-2">Delete customer conversations after</span>
        <select className="field w-auto py-1.5" value={retention ?? "never"} onChange={(e) => setRetention(e.target.value === "never" ? null : Number(e.target.value))}>
          {RETENTION.map((r) => <option key={r.v} value={r.v}>{r.l} of inactivity</option>)}
          <option value="never">Keep until I delete them</option>
        </select>
      </label>
      <label className="flex flex-wrap items-center gap-3">
        <span className="w-64 text-ink-2">Max assistant messages per customer per day</span>
        <input type="number" min={1} max={25} className="field w-24 py-1.5" value={cap} onChange={(e) => setCap(Number(e.target.value))} />
      </label>
      <p className="text-xs text-muted">Keep data only as long as you need it. Do-not-text records are kept so opt-outs keep being honoured.</p>
      {result?.error && <Notice tone="danger">{result.error}</Notice>}
      <div className="flex items-center justify-end gap-3">
        {result?.ok && <span className="text-[13px] text-brand">Saved</span>}
        <Button disabled={pending} onClick={() => start(async () => setResult(await saveDataSettingsAction({ retention_days: retention, max_ai_messages_per_lead_per_day: cap })))}>Save</Button>
      </div>
    </div>
  );
}

export function DeleteAccount({ businessName }: { businessName: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <label className="block text-[13px] text-ink-2" htmlFor="del-name">Type <strong>{businessName}</strong> to confirm</label>
      <input id="del-name" className="field max-w-sm" value={name} onChange={(e) => setName(e.target.value)} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button variant="danger" disabled={pending || name.trim() !== businessName.trim()}
        onClick={() => start(async () => { const r = await deleteAccountAction(name); if (r?.error) setError(r.error); })}>
        {pending ? "Deleting…" : "Permanently delete account"}
      </Button>
    </div>
  );
}
