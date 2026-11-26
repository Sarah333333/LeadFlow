"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardHeader, Field, Notice } from "@/components/ui";
import { SaveBar } from "@/components/save-bar";
import { saveNotificationsAction } from "../actions";

type State = { notify_email: string; notify_phone: string; notify_on_hot: boolean; notify_on_attention: boolean };

export function NotifyForm({ initial, smsAllowed, smsConfigured, emailConfigured }: { initial: State; smsAllowed: boolean; smsConfigured: boolean; emailConfigured: boolean }) {
  const [s, setS] = useState(initial);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = useTransition();
  const set = <K extends keyof State>(k: K, v: State[K]) => { setS((x) => ({ ...x, [k]: v })); setResult(undefined); };
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => setResult(await saveNotificationsAction(s))); }}>
      <Card>
        <CardHeader title="When to alert you" />
        <div className="space-y-4 p-5">
          {([
            ["notify_on_hot", "A lead turns hot", "Urgent or ready to book — call them while they're keen."],
            ["notify_on_attention", "A lead needs a human", "The assistant couldn't answer, a message failed, or the lead replied while the AI was paused."],
          ] as const).map(([k, title, desc]) => (
            <label key={k} className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" checked={s[k]} onChange={(e) => set(k, e.target.checked)} />
              <span><span className="font-medium">{title}</span><span className="block text-muted">{desc}</span></span>
            </label>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Where to alert you" description="Alerts always appear in LeadFlow too." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Email"><input className="field" type="email" value={s.notify_email} onChange={(e) => set("notify_email", e.target.value)} /></Field>
          <Field label="Mobile (SMS)" hint={!smsAllowed ? "Growth plan and above" : undefined}>
            <input className="field" value={s.notify_phone} onChange={(e) => set("notify_phone", e.target.value)} placeholder="+353 87 123 4567" />
          </Field>
        </div>
        {(!smsAllowed || !emailConfigured || !smsConfigured) && (
          <div className="space-y-2 px-5 pb-5">
            {!smsAllowed && <Notice>SMS alerts are included from the Growth plan. <Link href="/settings/billing" className="font-medium underline underline-offset-2">Upgrade</Link></Notice>}
            {!emailConfigured && <Notice tone="warn">Email delivery isn&apos;t configured on this server yet (RESEND_API_KEY).</Notice>}
            {smsAllowed && !smsConfigured && <Notice tone="warn">SMS delivery isn&apos;t configured on this server yet (Twilio).</Notice>}
          </div>
        )}
      </Card>
      <SaveBar pending={pending} result={result} />
    </form>
  );
}
