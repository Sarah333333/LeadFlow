import { LinkButton } from "@/components/ui";
import { PlanCards } from "@/components/plan-cards";

export const metadata = { title: "Pricing" };

const FAQ = [
  ["What counts as a lead?", "Any new enquiry that comes in — from your website, Facebook, a text message or added by hand. Replies and follow-ups don't count."],
  ["Do I need a card for the trial?", "No. You get 14 days and 25 leads free. Pick a plan when you're ready."],
  ["Will the AI make up prices or book jobs?", "No. It only uses the information you give it. If it doesn't know, it tells the customer a team member will follow up — and alerts you."],
  ["Can I jump into a conversation?", "Any time. One tap pauses the assistant and you take it from there."],
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pays for itself with one extra job</h1>
        <p className="mt-4 text-lg text-muted">Simple monthly plans. Cancel anytime. Every plan starts with a 14-day free trial.</p>
      </div>
      <PlanCards action={(p) => <LinkButton href="/signup" className="w-full" variant={p.highlighted ? "primary" : "secondary"}>Start free trial</LinkButton>} />
      <div className="mx-auto mt-20 grid max-w-4xl gap-x-12 gap-y-8 sm:grid-cols-2">
        {FAQ.map(([q, a]) => (
          <div key={q}><h3 className="font-medium">{q}</h3><p className="mt-1.5 text-sm leading-relaxed text-muted">{a}</p></div>
        ))}
      </div>
    </main>
  );
}
