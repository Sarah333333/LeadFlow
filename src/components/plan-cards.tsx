import { Check } from "lucide-react";
import { PAID_PLANS, type Plan } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function PlanCards({ action, currentPlan }: { action: (plan: Plan) => React.ReactNode; currentPlan?: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PAID_PLANS.map((p) => (
        <div key={p.id} className={cn("relative flex flex-col rounded-xl border bg-surface p-6",
          p.highlighted ? "border-ink shadow-[0_8px_30px_rgba(0,0,0,0.06)]" : "border-line")}>
          {p.highlighted && <span className="absolute -top-2.5 left-6 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-medium text-white">Most popular</span>}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{p.name}</h3>
            {currentPlan === p.id && <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">Current plan</span>}
          </div>
          <div className="mt-3 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-tight">${p.priceMonthly}</span><span className="text-sm text-muted">/month</span></div>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-2">
            {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{f}</li>)}
          </ul>
          <div className="mt-6">{action(p)}</div>
        </div>
      ))}
    </div>
  );
}
