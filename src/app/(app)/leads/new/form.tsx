"use client";
import { useActionState, useState } from "react";
import { FlaskConical, MessageSquare } from "lucide-react";
import { Button, Field, Notice } from "@/components/ui";
import { LEAD_SOURCES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addLeadAction } from "../actions";

export function NewLeadForm({ smsEnabled, services }: { smsEnabled: boolean; services: string[] }) {
  const [state, action, pending] = useActionState(addLeadAction, undefined);
  const [channel, setChannel] = useState<"test" | "sms">(smsEnabled ? "sms" : "test");
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="channel" value={channel} />
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { id: "sms", icon: MessageSquare, title: "Text the lead", desc: smsEnabled ? "The assistant texts them right away." : "Connect Twilio in settings to enable.", disabled: !smsEnabled },
          { id: "test", icon: FlaskConical, title: "Test mode", desc: "No real texts. You play the lead to see how the assistant responds.", disabled: false },
        ] as const).map((o) => (
          <button key={o.id} type="button" disabled={o.disabled} onClick={() => setChannel(o.id)}
            className={cn("flex gap-3 rounded-lg border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
              channel === o.id ? "border-ink ring-4 ring-black/5" : "border-line hover:border-line-strong")}>
            <o.icon className="mt-0.5 size-4 shrink-0 text-ink-2" />
            <span><span className="block text-sm font-medium">{o.title}</span><span className="mt-0.5 block text-xs text-muted">{o.desc}</span></span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input name="name" required className="field" placeholder="John Murphy" autoFocus /></Field>
        <Field label="Source">
          <select name="source" className="field" defaultValue="website">
            {LEAD_SOURCES.filter((s) => !["webhook", "sms"].includes(s.value)).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Phone" hint={channel === "sms" ? "Required" : "Optional"}><input name="phone" className="field" placeholder="+353 87 123 4567" /></Field>
        <Field label="Email" hint="Optional"><input name="email" type="email" className="field" placeholder="john@email.com" /></Field>
        <Field label="Service requested">
          <input name="service_requested" list="services" className="field" placeholder="Roof repair" />
          <datalist id="services">{services.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Location"><input name="location" className="field" placeholder="Dublin 15" /></Field>
      </div>
      <Field label="Their message" hint="What they wrote in the form, DM or text">
        <textarea name="initial_message" className="field min-h-[96px]" placeholder="Hi, my roof is leaking in the back bedroom after the storm. Can someone take a look?" />
      </Field>
      {channel === "sms" && (
        <label className="flex items-start gap-3 rounded-lg border border-line bg-canvas/60 p-3.5 text-sm">
          <input type="checkbox" name="sms_consent_attested" required className="mt-0.5 size-4 accent-[var(--color-brand)]" />
          <span>
            <span className="font-medium">This person asked us to contact them by text message about their enquiry.</span>
            <span className="mt-0.5 block text-xs text-muted">Recorded with your name and the time as their consent. LeadFlow only texts people who asked to be contacted, and stops immediately if they reply STOP. You are responsible for making sure this is true.</span>
          </span>
        </label>
      )}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button type="submit" variant="brand" disabled={pending}>{pending ? "Adding & sending first reply…" : "Add lead"}</Button>
      </div>
    </form>
  );
}
