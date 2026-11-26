"use client";
import { useState, useTransition } from "react";
import { Card, CardHeader, Field } from "@/components/ui";
import { FaqEditor, HoursEditor, ServicesEditor, TagInput } from "@/components/business-editors";
import { SaveBar } from "@/components/save-bar";
import { CURRENCIES, TRADES } from "@/lib/business/trades";
import type { BusinessProfile } from "@/lib/business/schema";
import type { OpeningHours } from "@/lib/types";
import { saveProfileAction } from "./actions";

export function ProfileForm({ initial }: { initial: BusinessProfile }) {
  const [p, setP] = useState(initial);
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  const [pending, start] = useTransition();
  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => { setP((x) => ({ ...x, [k]: v })); setResult(undefined); };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); start(async () => setResult(await saveProfileAction(p))); }}>
      <p className="text-sm text-muted">Everything here is what your assistant knows. It will never state anything that isn&apos;t on this page.</p>
      <Card>
        <CardHeader title="Business details" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Business name"><input className="field" value={p.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Trade">
            <select className="field" value={p.industry} onChange={(e) => set("industry", e.target.value)}>
              {TRADES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Description" className="sm:col-span-2"><textarea className="field min-h-[90px]" value={p.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Phone"><input className="field" value={p.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} /></Field>
          <Field label="Email"><input className="field" value={p.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></Field>
          <Field label="Website"><input className="field" value={p.website} onChange={(e) => set("website", e.target.value)} /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Services & prices" description="Leave a price blank and the assistant will never quote one." />
        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-[120px_200px]">
            <Field label="Currency"><select className="field" value={p.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Average job value"><input className="field" type="number" min={0} value={p.average_job_value || ""} onChange={(e) => set("average_job_value", Number(e.target.value))} /></Field>
          </div>
          <ServicesEditor value={p.services} onChange={(v) => set("services", v)} currency={p.currency} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Service areas & hours" />
        <div className="space-y-5 p-5">
          <Field label="Service areas"><TagInput value={p.service_areas} onChange={(v) => set("service_areas", v)} placeholder="Type an area and press Enter" /></Field>
          <Field label="Opening hours"><HoursEditor value={p.opening_hours as OpeningHours} onChange={(v) => set("opening_hours", v as BusinessProfile["opening_hours"])} /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Frequently asked questions" description="Questions without an answer are ignored." />
        <div className="p-5"><FaqEditor value={p.faqs} onChange={(v) => set("faqs", v)} /></div>
      </Card>
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        <SaveBar pending={pending} result={result} />
      </div>
    </form>
  );
}
