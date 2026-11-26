import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Temperature, LeadStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-black shadow-sm",
  brand: "bg-brand text-white hover:bg-brand-hover shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-canvas shadow-[0_1px_0_rgba(0,0,0,0.03)]",
  ghost: "text-ink-2 hover:bg-black/[0.04]",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft",
};
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition whitespace-nowrap",
    "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/10",
    variants[variant], sizes[size], className,
  );
}

export function Button({ variant, size, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}

export function LinkButton({ variant, size, className, ...p }: React.ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)} {...p} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Label({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-2">
      {children}{hint && <span className="ml-1.5 font-normal text-faint">{hint}</span>}
    </label>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label hint={hint}>{label}</Label>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const tempStyle: Record<Temperature, string> = {
  hot: "bg-hot-soft text-hot", warm: "bg-warm-soft text-warm", cold: "bg-cold-soft text-cold",
};
export function TemperatureBadge({ value }: { value: string }) {
  const t = (value as Temperature) ?? "cold";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize", tempStyle[t])}>
      <span className="size-1.5 rounded-full bg-current" />{t}
    </span>
  );
}

const statusStyle: Partial<Record<LeadStatus, string>> = {
  won: "text-brand bg-brand-soft border-transparent",
  lost: "text-muted", opted_out: "text-muted", unresponsive: "text-muted",
  qualified: "text-ink border-ink/20",
};
export function StatusBadge({ value }: { value: string }) {
  const s = value as LeadStatus;
  return (
    <span className={cn("inline-flex items-center rounded-md border border-line px-1.5 py-0.5 text-xs font-medium text-ink-2", statusStyle[s])}>
      {STATUS_LABELS[s] ?? value}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-hot" : score >= 45 ? "bg-warm" : "bg-cold";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-xs tabular-nums text-ink-2">{score}</span>
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-xl border border-line bg-canvas text-muted">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "danger" | "success"; children: React.ReactNode; className?: string }) {
  const t = {
    info: "bg-canvas border-line text-ink-2", warn: "bg-warm-soft border-warm/20 text-[#7a5212]",
    danger: "bg-danger-soft border-danger/20 text-danger", success: "bg-brand-soft border-brand/20 text-brand",
  }[tone];
  return <div className={cn("rounded-lg border px-3.5 py-2.5 text-[13px]", t, className)}>{children}</div>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--color-brand)" />
        <path d="M7 6.5v11h9.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.5 13.5l2.5-3 2.5 2 2-3" stroke="#9fe0c4" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      LeadFlow
    </span>
  );
}
