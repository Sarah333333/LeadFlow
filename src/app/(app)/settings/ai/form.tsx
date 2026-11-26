"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, CardHeader, Field, Notice } from "@/components/ui";
import { ToneSelector } from "@/components/business-editors";
import { SaveBar } from "@/components/save-bar";
import { TIMEZONES } from "@/lib/business/trades";
import { saveAiAction } from "../actions";

type State = { tone: "friendly" | "professional" | "casual"; booking_link: string; timezone: string; ai_enabled_by_default: boolean; custom_instructions: string };

export function AiForm({ initial, customAllowed, provider }: { initial: State; customAllowed: boolean; provider: string }) {
  const [s, setS] = useState(initial);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = useTransition();
  const set = <K extends keyof State>(k: K, v: State[K]) => { setS((x) => ({ ...x, [k]: v })); setResult(undefined); };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => setResult(await saveAiAction(s))); }}>
      {provider === "demo" && (
        <Notice tone="warn">Running the built-in demo assistant. Add an <code>OPENAI_API_KEY</code> to use the full AI for natural conversations.</Notice>
      )}
      <Card>
        <CardHeader title="Voice" />
        <div className="space-y-5 p-5">
          <ToneSelector value={s.tone} onChange={(v) => set("tone", v as State["tone"])} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Booking link" hint="Shared with ready-to-book leads"><input className="field" value={s.booking_link} onChange={(e) => set("booking_link", e.target.value)} placeholder="https://" /></Field>
            <Field label="Time zone"><select className="field" value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" checked={s.ai_enabled_by_default} onChange={(e) => set("ai_enabled_by_default", e.target.checked)} />
            <span><span className="font-medium">Reply to new leads automatically</span><span className="block text-muted">Turn off to review every new lead yourself before the assistant starts.</span></span>
          </label>
        </div>
      </Card>
      <Card>
        <CardHeader title="Custom instructions" description="Extra guidance, e.g. “Always ask if the property is listed” or “We don't work on Sundays”." />
        <div className="p-5">
          <textarea className="field min-h-[120px]" disabled={!customAllowed} value={s.custom_instructions} onChange={(e) => set("custom_instructions", e.target.value)}
            placeholder={customAllowed ? "Write instructions for your assistant…" : ""} />
          {customAllowed && <p className="mt-2 text-[13px] text-muted">The assistant is told to keep these private, but a determined customer could get it to hint at them. Don&apos;t put anything confidential here.</p>}
          {!customAllowed && <p className="mt-2 text-[13px] text-muted">Available on the Pro plan. <Link href="/settings/billing" className="font-medium text-ink underline underline-offset-2">Upgrade</Link></p>}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
          <div className="text-sm">
            <p className="font-medium">Built-in safeguards (always on)</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted">
              <li>Only uses facts from your business settings — never invents prices, times or policies.</li>
              <li>Replies mentioning a price you haven&apos;t set are blocked and replaced with a hand-off.</li>
              <li>Never confirms bookings, refunds or guarantees on your behalf.</li>
              <li>Urgent leads are always marked hot; complaints and safety issues are escalated to you.</li>
              <li>Anyone who texts STOP is never messaged again.</li>
            </ul>
          </div>
        </div>
      </Card>
      <SaveBar pending={pending} result={result} />
    </form>
  );
}
