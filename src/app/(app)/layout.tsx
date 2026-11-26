import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { billingState } from "@/lib/billing/plans";
import { AppNav } from "./nav";
import { redirect } from "next/navigation";
import { missingAgreements } from "@/lib/compliance/agreements";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  if ((await missingAgreements(user.id)).length) redirect("/legal/accept");
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const billing = billingState(business);
  const trialDays = differenceInCalendarDays(new Date(business.trial_ends_at), new Date());

  return (
    <div className="min-h-screen">
      <AppNav businessName={business.name} email={user.email ?? ""} unread={count ?? 0} aiMode={business.ai_mode} />
      <div className="lg:pl-60">
        {(!billing.active || billing.plan.id === "trial") && (
          <div className={`border-b px-6 py-2 text-center text-[13px] ${billing.active ? "border-line bg-surface text-ink-2" : "border-danger/20 bg-danger-soft text-danger"}`}>
            {billing.active ? `Free trial · ${trialDays} day${trialDays === 1 ? "" : "s"} left.` : `${billing.reason} The assistant has stopped replying to leads.`}{" "}
            <Link href="/settings/billing" className="font-medium underline underline-offset-2">Choose a plan</Link>
          </div>
        )}
        {business.ai_mode !== "auto" && (
          <div className="border-b border-line bg-warm-soft px-6 py-2 text-center text-[13px] text-[#7a5212]">
            {business.ai_mode === "off" ? "The assistant is OFF — no automatic replies or follow-ups are being sent." : "Review mode — the assistant drafts replies and nothing is sent until you approve it."}{" "}
            <Link href="/settings/privacy" className="font-medium underline underline-offset-2">Change</Link>
          </div>
        )}
        <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
