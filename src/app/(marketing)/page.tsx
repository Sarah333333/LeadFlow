import { ArrowRight, BellRing, Clock, Flame, Hand, MessageSquareText, ShieldCheck, Zap } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { PlanCards } from "@/components/plan-cards";

const CHAT = [
  { from: "lead", text: "Hi, my roof is leaking. Looking for someone in Dublin." },
  { from: "ai", text: "Hi John, thanks for contacting ABC Roofing. I can help get this started. Could you tell me a little more about the leak and roughly how large the affected area is?" },
  { from: "lead", text: "Back bedroom ceiling, maybe 2 square metres. I need someone ASAP, it's getting worse." },
  { from: "ai", text: "Thanks John, that's really helpful. I've passed this to the team and someone will call you shortly." },
];

export default function Home() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1 text-[13px] text-ink-2">
            <span className="size-1.5 rounded-full bg-brand" /> For roofers, plumbers, electricians & other trades
          </span>
          <h1 className="mt-6 text-[42px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
            Every lead answered in seconds. Even when you&apos;re up a ladder.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            LeadFlow texts new enquiries back instantly, asks the questions you&apos;d ask, and alerts you the moment someone is ready to book. No more leads going cold in your inbox.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href="/signup" size="lg">Start 14-day free trial <ArrowRight className="size-4" /></LinkButton>
            <span className="text-sm text-muted">No card needed · set up in 10 minutes</span>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-line bg-canvas p-4 pb-16 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-6 sm:pb-16">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-surface text-xs font-medium ring-1 ring-line">JM</span>
                <div><div className="text-sm font-medium">John Murphy</div><div className="text-xs text-muted">Roof repair · Dublin · Website</div></div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-hot-soft px-2 py-0.5 text-xs font-medium text-hot"><span className="size-1.5 rounded-full bg-current" />Hot · 92</span>
            </div>
            <div className="space-y-2.5">
              {CHAT.map((m, i) => (
                <div key={i} className={m.from === "ai" ? "flex justify-end" : "flex"}>
                  <p className={m.from === "ai" ? "max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-[13px] leading-relaxed text-white" : "max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2 text-[13px] leading-relaxed"}>{m.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg sm:-left-6">
            <span className="grid size-8 place-items-center rounded-lg bg-hot-soft text-hot"><BellRing className="size-4" /></span>
            <div><div className="text-[13px] font-medium">Hot lead: John Murphy</div><div className="text-xs text-muted">Urgent leak, Dublin · call now</div></div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-canvas">
        <div className="mx-auto grid max-w-6xl gap-px px-5 py-16 sm:grid-cols-3">
          {[
            ["< 30s", "to send a personal first reply to every new lead"],
            ["24/7", "nights, weekends, and while you're on a job"],
            ["0", "leads forgotten — quiet leads get followed up automatically"],
          ].map(([n, t]) => (
            <div key={n} className="px-2 py-4 sm:px-8"><div className="text-4xl font-semibold tracking-tight">{n}</div><p className="mt-2 text-sm text-muted">{t}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Your best receptionist, without the wages</h2>
        <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Zap, "Instant first reply", "Website forms, Facebook, Instagram and texts get a personal reply in seconds — 24/7."],
            [MessageSquareText, "Asks the right questions", "What's the problem, where, how big, how urgent. You get the details you need to quote."],
            [Flame, "Spots the hot ones", "Every lead is scored hot, warm or cold. Urgent jobs are flagged and you're alerted straight away."],
            [Clock, "Follows up for you", "If a lead goes quiet, friendly follow-ups go out on your schedule — never at night."],
            [ShieldCheck, "Never makes things up", "It only uses your prices, areas and answers. Anything else goes to you."],
            [Hand, "You're always in control", "Read every conversation and take over with one tap."],
          ].map(([Icon, title, desc]) => {
            const I = Icon as typeof Zap;
            return (
              <div key={title as string}>
                <span className="grid size-9 place-items-center rounded-lg border border-line bg-canvas"><I className="size-4 text-ink-2" /></span>
                <h3 className="mt-4 font-medium">{title as string}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{desc as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pays for itself with one extra job</h2>
            <p className="mt-3 text-muted">Start free for 14 days. No card required.</p>
          </div>
          <PlanCards action={(p) => <LinkButton href="/signup" className="w-full" variant={p.highlighted ? "primary" : "secondary"}>Start free trial</LinkButton>} />
        </div>
      </section>
    </main>
  );
}
