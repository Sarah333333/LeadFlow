"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button, Field, Logo, Notice } from "@/components/ui";
import { FaqEditor, HoursEditor, ServicesEditor, TagInput, ToneSelector } from "@/components/business-editors";
import { CURRENCIES, DEFAULT_FAQ_QUESTIONS, TIMEZONES, TRADES } from "@/lib/business/trades";
import type { BusinessProfile } from "@/lib/business/schema";
import type { OpeningHours } from "@/lib/types";
import { cn } from "@/lib/utils";
import { completeOnboarding, saveBusinessProfile } from "./actions";
import { BUSINESS_RESPONSIBILITIES } from "@/lib/compliance/legal";

const STEPS = [
  { title: "Your business", description: "The basics your assistant will introduce." },
  { title: "Services & prices", description: "What you do and what it typically costs." },
  { title: "Areas, hours & FAQs", description: "So the assistant can answer common questions." },
  { title: "Assistant & alerts", description: "How it sounds, and where we send hot leads." },
];

export function OnboardingWizard({ initial }: { initial: BusinessProfile }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<BusinessProfile>(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [ack, setAck] = useState(false);
  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  function pickTrade(id: string) {
    const trade = TRADES.find((t) => t.id === id)!;
    setP((x) => ({
      ...x, industry: id,
      // Only pre-fill if they haven't typed their own services yet.
      services: x.services.some((s) => s.name) ? x.services : trade.services.map((name) => ({ name, price_range: "", description: "" })),
      faqs: x.faqs.length ? x.faqs : DEFAULT_FAQ_QUESTIONS.map((question) => ({ question, answer: "" })),
    }));
  }

  function validate(): string | undefined {
    if (step === 0 && p.name.trim().length < 2) return "Enter your business name.";
    if (step === 1 && !p.services.some((s) => s.name.trim())) return "Add at least one service.";
    if (step === 3 && !ack) return "Please confirm the statements about your responsibilities.";
  }

  function next() {
    const v = validate();
    if (v) return setError(v);
    setError(undefined);
    start(async () => {
      if (step < STEPS.length - 1) {
        const res = await saveBusinessProfile(p); // save progress so nothing is lost
        if (res?.error) return setError(res.error);
        setStep(step + 1);
        window.scrollTo({ top: 0 });
      } else {
        const res = await completeOnboarding(p, ack);
        if (res?.error) setError(res.error);
      }
    });
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <span className="text-[13px] text-muted">Step {step + 1} of {STEPS.length}</span>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 pt-6 md:grid-cols-[220px_1fr]">
        <ol className="hidden space-y-1 md:block">
          {STEPS.map((s, i) => (
            <li key={s.title} className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-sm", i === step ? "font-medium text-ink" : "text-muted")}>
              <span className={cn("grid size-6 place-items-center rounded-full border text-xs",
                i < step ? "border-brand bg-brand text-white" : i === step ? "border-ink text-ink" : "border-line-strong")}>
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              {s.title}
            </li>
          ))}
        </ol>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{STEPS[step].title}</h1>
          <p className="mb-8 mt-1 text-sm text-muted">{STEPS[step].description}</p>

          <div className="space-y-6 rounded-xl border border-line bg-surface p-5 sm:p-7">
            {step === 0 && (
              <>
                <Field label="Business name"><input className="field" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="ABC Roofing" autoFocus /></Field>
                <div>
                  <Field label="What kind of business is it?"><span /></Field>
                  <div className="-mt-1 flex flex-wrap gap-2">
                    {TRADES.map((t) => (
                      <button key={t.id} type="button" onClick={() => pickTrade(t.id)}
                        className={cn("rounded-full border px-3 py-1.5 text-sm transition", p.industry === t.id ? "border-ink bg-ink text-white" : "border-line hover:border-line-strong")}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Short description" hint="1–3 sentences the assistant can use">
                  <textarea className="field min-h-[90px]" value={p.description} onChange={(e) => set("description", e.target.value)}
                    placeholder="Family-run roofing company serving Dublin for 20 years. We handle repairs, new roofs and gutters. Fully insured." />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Phone"><input className="field" value={p.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+353 1 234 5678" /></Field>
                  <Field label="Email"><input className="field" type="email" value={p.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></Field>
                  <Field label="Website"><input className="field" value={p.website} onChange={(e) => set("website", e.target.value)} placeholder="abcroofing.ie" /></Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                  <Field label="Currency">
                    <select className="field" value={p.currency} onChange={(e) => set("currency", e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Average job value" hint="Used to estimate revenue on your dashboard">
                    <input className="field max-w-[200px]" type="number" min={0} value={p.average_job_value || ""} onChange={(e) => set("average_job_value", Number(e.target.value))} placeholder="650" />
                  </Field>
                </div>
                <ServicesEditor value={p.services} onChange={(v) => set("services", v)} currency={p.currency} />
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Service areas" hint="Press Enter after each one">
                  <TagInput value={p.service_areas} onChange={(v) => set("service_areas", v)} placeholder="Dublin, Meath, Kildare…" />
                </Field>
                <Field label="Opening hours"><HoursEditor value={p.opening_hours as OpeningHours} onChange={(v) => set("opening_hours", v as BusinessProfile["opening_hours"])} /></Field>
                <Field label="Frequently asked questions" hint="Only answered questions are used">
                  <FaqEditor value={p.faqs} onChange={(v) => set("faqs", v)} />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label="Tone of voice"><ToneSelector value={p.tone} onChange={(v) => set("tone", v as BusinessProfile["tone"])} /></Field>
                <Field label="Booking link" hint="Optional — the assistant can share it with hot leads">
                  <input className="field" value={p.booking_link} onChange={(e) => set("booking_link", e.target.value)} placeholder="https://calendly.com/abc-roofing" />
                </Field>
                <Field label="Time zone">
                  <select className="field max-w-xs" value={p.timezone} onChange={(e) => set("timezone", e.target.value)}>
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <div className="rounded-lg border border-line bg-canvas/60 p-4">
                  <p className="mb-3 text-sm font-medium">Where should we alert you about hot leads?</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mobile number"><input className="field" value={p.notify_phone} onChange={(e) => set("notify_phone", e.target.value)} placeholder="+353 87 123 4567" /></Field>
                    <Field label="Email"><input className="field" type="email" value={p.notify_email} onChange={(e) => set("notify_email", e.target.value)} /></Field>
                  </div>
                </div>
                <Notice>Your assistant only uses what you entered here. When it doesn&apos;t know something, it tells the lead a team member will follow up and alerts you. New accounts start in <strong>Review mode</strong>: the assistant drafts replies and nothing is sent until you approve it. You can switch on automatic sending in Settings → Privacy &amp; AI.</Notice>
                <div className="rounded-lg border border-line p-4">
                  <p className="mb-2 text-sm font-medium">Your responsibilities</p>
                  <ul className="mb-3 list-disc space-y-1 pl-5 text-[13px] text-ink-2">{BUSINESS_RESPONSIBILITIES.map((r) => <li key={r}>{r}</li>)}</ul>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-brand)]" /> I understand and agree.</label>
                </div>
              </>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex items-center justify-between border-t border-line pt-5">
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>Back</Button>
              <Button type="button" variant={step === STEPS.length - 1 ? "brand" : "primary"} onClick={next} disabled={pending}>
                {pending ? "Saving…" : step === STEPS.length - 1 ? "Finish setup" : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
