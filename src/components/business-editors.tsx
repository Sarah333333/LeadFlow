"use client";
import { Plus, X } from "lucide-react";
import { DAYS, type Day, type DayHours, type FaqItem, type OpeningHours, type ServiceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ServicesEditor({ value, onChange, currency }: { value: ServiceItem[]; onChange: (v: ServiceItem[]) => void; currency: string }) {
  const set = (i: number, patch: Partial<ServiceItem>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const sym = { EUR: "€", GBP: "£", USD: "$", CAD: "$", AUD: "$" }[currency] ?? "";
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1.2fr_1fr_1.4fr_32px] gap-2 px-1 text-xs font-medium text-muted sm:grid">
        <span>Service</span><span>Typical price</span><span>Notes for the AI (optional)</span><span />
      </div>
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1.2fr_1fr_1.4fr_32px] sm:border-0 sm:p-0">
          <input className="field" placeholder="e.g. Roof repair" value={s.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input className="field" placeholder={`e.g. ${sym}150–${sym}400`} value={s.price_range} onChange={(e) => set(i, { price_range: e.target.value })} />
          <input className="field" placeholder="e.g. Price depends on access" value={s.description} onChange={(e) => set(i, { description: e.target.value })} />
          <button type="button" aria-label="Remove service" onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="grid h-9 place-items-center rounded-lg text-faint hover:bg-black/5 hover:text-ink"><X className="size-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { name: "", price_range: "", description: "" }])}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-2 hover:bg-black/5">
        <Plus className="size-4" /> Add service
      </button>
      <p className="text-xs text-muted">Leave a price blank if you never want the AI to mention a price for that service.</p>
    </div>
  );
}

export function FaqEditor({ value, onChange }: { value: FaqItem[]; onChange: (v: FaqItem[]) => void }) {
  const set = (i: number, patch: Partial<FaqItem>) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <div key={i} className="relative rounded-lg border border-line bg-canvas/50 p-3">
          <button type="button" aria-label="Remove question" onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-faint hover:bg-black/5 hover:text-ink"><X className="size-4" /></button>
          <input className="field mb-2 pr-9 font-medium" placeholder="Question" value={f.question} onChange={(e) => set(i, { question: e.target.value })} />
          <textarea className="field min-h-[60px]" placeholder="Your answer — leave blank to skip this question" value={f.answer} onChange={(e) => set(i, { answer: e.target.value })} />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { question: "", answer: "" }])}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-2 hover:bg-black/5">
        <Plus className="size-4" /> Add question
      </button>
    </div>
  );
}

export function HoursEditor({ value, onChange }: { value: OpeningHours; onChange: (v: OpeningHours) => void }) {
  const set = (d: Day, patch: Partial<DayHours>) =>
    onChange({ ...value, [d]: { open: "08:00", close: "18:00", closed: false, ...value[d], ...patch } });
  return (
    <div className="divide-y divide-line rounded-lg border border-line">
      {DAYS.map(({ key, label }) => {
        const h = value[key] ?? { open: "08:00", close: "18:00", closed: true };
        return (
          <div key={key} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <span className="w-24 text-sm text-ink-2">{label}</span>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={!h.closed} onChange={(e) => set(key, { closed: !e.target.checked })} className="size-4 accent-[var(--color-brand)]" />
              Open
            </label>
            <div className={cn("ml-auto flex items-center gap-2", h.closed && "pointer-events-none opacity-40")}>
              <input type="time" className="field w-[110px] py-1.5" value={h.open} onChange={(e) => set(key, { open: e.target.value })} />
              <span className="text-faint">–</span>
              <input type="time" className="field w-[110px] py-1.5" value={h.close} onChange={(e) => set(key, { close: e.target.value })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts]);
  };
  return (
    <div className="field flex min-h-[40px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-0.5 text-[13px] text-ink-2 ring-1 ring-line">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-faint hover:text-ink"><X className="size-3" /></button>
        </span>
      ))}
      <input className="min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-faint" placeholder={value.length ? "" : placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(e.currentTarget.value); e.currentTarget.value = ""; }
          if (e.key === "Backspace" && !e.currentTarget.value && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={(e) => { add(e.currentTarget.value); e.currentTarget.value = ""; }} />
    </div>
  );
}

export const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly", example: "Hi John, thanks so much for getting in touch! Could you tell me a bit more about the leak?" },
  { value: "professional", label: "Professional", example: "Hello John, thank you for contacting us. Could you describe the leak and the affected area?" },
  { value: "casual", label: "Casual", example: "Hey John, thanks for reaching out. What's going on with the leak — roughly how big is it?" },
] as const;

export function ToneSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {TONE_OPTIONS.map((t) => (
        <button type="button" key={t.value} onClick={() => onChange(t.value)}
          className={cn("rounded-lg border p-3 text-left transition", value === t.value ? "border-ink bg-surface ring-4 ring-black/5" : "border-line bg-surface hover:border-line-strong")}>
          <div className="text-sm font-medium">{t.label}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">&ldquo;{t.example}&rdquo;</p>
        </button>
      ))}
    </div>
  );
}
