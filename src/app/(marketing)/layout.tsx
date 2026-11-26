import Link from "next/link";
import { LinkButton, Logo } from "@/components/ui";
import { getUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/"><Logo /></Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/pricing" className="hidden rounded-lg px-3 py-2 text-sm text-ink-2 hover:text-ink sm:block">Pricing</Link>
            {user ? <LinkButton href="/dashboard" size="sm">Open dashboard</LinkButton> : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:text-ink">Log in</Link>
                <LinkButton href="/signup" size="sm">Start free trial</LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <Logo className="text-sm" />
          <span className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-ink">Terms (draft)</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy (draft)</Link>
            <Link href="/legal/subprocessors" className="hover:text-ink">Third-party services</Link>
            <span>© {new Date().getFullYear()} LeadFlow AI</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
