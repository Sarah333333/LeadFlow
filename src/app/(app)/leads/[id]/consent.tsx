"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { markDoNotContactAction, recordConsentAction } from "../actions";

export function ConsentControls({ leadId, canRecord, doNotContact }: { leadId: string; canRecord: boolean; doNotContact: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, after?: () => void) => start(async () => {
    try { const r = await fn(); setError(r?.error); if (!r?.error) after?.(); } catch { setError("Something went wrong."); }
    router.refresh();
  });
  return (
    <div className="space-y-2">
      {open ? (
        <div className="space-y-2">
          <label className="block text-[13px] text-ink-2" htmlFor="consent-note">How did they ask to be texted?</label>
          <textarea id="consent-note" className="field min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Phoned on 3 May and asked us to text a quote" />
          <p className="text-xs text-muted">Recorded with your name and the time. Only record consent the person actually gave.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="brand" disabled={pending} onClick={() => run(() => recordConsentAction(leadId, note), () => setOpen(false))}>Record consent</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canRecord && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><ShieldCheck className="size-3.5" /> Record consent</Button>}
          {!doNotContact && (
            <Button size="sm" variant="danger" disabled={pending} onClick={() => {
              if (confirm("Mark as do not contact? The assistant and follow-ups stop, and the number is added to your suppression list.")) run(() => markDoNotContactAction(leadId));
            }}><Ban className="size-3.5" /> Do not contact</Button>
          )}
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
