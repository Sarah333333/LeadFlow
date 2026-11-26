"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Hand, Pause, Play, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { closeLeadAction, deleteLeadAction, reopenLeadAction, resolveAttentionAction, setAiPausedAction } from "../actions";

export function LeadActions({ leadId, aiPaused, status, defaultValue, currency }: {
  leadId: string; aiPaused: boolean; status: string; defaultValue: number | null; currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [wonOpen, setWonOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ? String(defaultValue) : "");
  const closed = ["won", "lost", "opted_out"].includes(status);

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>) =>
    start(async () => {
      try {
        const res = await fn();
        setError(res?.error);
      } catch {
        setError("Something went wrong. Please refresh and try again.");
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {!closed && (
          <>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => {
              run(() => setAiPausedAction(leadId, true));
              window.dispatchEvent(new Event("leadflow:takeover"));
            }}>
              <Hand className="size-3.5" /> Take over
            </Button>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setAiPausedAction(leadId, !aiPaused))}>
              {aiPaused ? <><Play className="size-3.5" /> Resume AI</> : <><Pause className="size-3.5" /> Pause AI</>}
            </Button>
            <Button variant="brand" size="sm" disabled={pending} onClick={() => setWonOpen((o) => !o)}>
              <CheckCircle2 className="size-3.5" /> Mark won
            </Button>
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => closeLeadAction(leadId, "lost"))}>
              <XCircle className="size-3.5" /> Lost
            </Button>
          </>
        )}
        {closed && status !== "opted_out" && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => reopenLeadAction(leadId))}>
            <RotateCcw className="size-3.5" /> Reopen
          </Button>
        )}
      </div>
      {wonOpen && (
        <form className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2"
          onSubmit={(e) => { e.preventDefault(); setWonOpen(false); run(() => closeLeadAction(leadId, "won", value ? Number(value) : null)); }}>
          <label className="text-[13px] text-ink-2" htmlFor="jobvalue">Job value ({currency})</label>
          <input id="jobvalue" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="field w-28 py-1" autoFocus />
          <Button size="sm" variant="brand" type="submit">Save</Button>
        </form>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

export function DeleteLead({ leadId, name }: { leadId: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button type="button" disabled={pending} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-danger"
        onClick={() => {
          if (!confirm(`Permanently delete ${name} and the whole conversation? This can't be undone.`)) return;
          start(async () => { const r = await deleteLeadAction(leadId); if (r?.error) setError(r.error); });
        }}>
        <Trash2 className="size-3.5" /> {pending ? "Deleting…" : "Delete lead & conversation"}
      </button>
      {error && <Notice tone="danger" className="mt-2">{error}</Notice>}
    </div>
  );
}

export function ResolveAttention({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} className="shrink-0 text-[13px] font-medium underline underline-offset-2"
      onClick={() => start(async () => { await resolveAttentionAction(leadId); router.refresh(); })}>
      Mark handled
    </button>
  );
}
