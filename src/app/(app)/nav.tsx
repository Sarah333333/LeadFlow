"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, LayoutDashboard, LogOut, Menu, OctagonX, Settings, Users, X } from "lucide-react";
import { Logo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { logOut } from "@/app/(auth)/actions";
import { stopAllAiAction } from "@/app/(app)/settings/actions";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav({ businessName, email, unread, aiMode }: { businessName: string; email: string; unread: number; aiMode: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
              active ? "bg-black/[0.05] font-medium text-ink" : "text-ink-2 hover:bg-black/[0.03] hover:text-ink")}>
            <Icon className="size-4" strokeWidth={1.8} />
            {label}
            {href === "/notifications" && unread > 0 && (
              <span className="ml-auto rounded-full bg-hot px-1.5 text-[11px] font-semibold leading-5 text-white">{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
  const footer = (
    <div className="border-t border-line pt-3">
      {aiMode === "auto" && (
        <form action={stopAllAiAction} onSubmit={(e) => { if (!confirm("Turn the assistant OFF for all customers now? Pending follow-ups are cancelled.")) e.preventDefault(); }}>
          <button className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-danger hover:bg-danger-soft">
            <OctagonX className="size-4" strokeWidth={1.8} /> Stop all AI
          </button>
        </form>
      )}
      <div className="px-2.5 pb-2">
        <div className="truncate text-sm font-medium">{businessName}</div>
        <div className="truncate text-xs text-muted">{email}</div>
      </div>
      <form action={logOut}>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 hover:bg-black/[0.03]">
          <LogOut className="size-4" strokeWidth={1.8} /> Log out
        </button>
      </form>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-canvas px-3 py-4 lg:flex">
        <Link href="/dashboard" className="mb-6 px-2.5"><Logo /></Link>
        <div className="flex-1">{nav}</div>
        {footer}
      </aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard"><Logo /></Link>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 hover:bg-black/5"><Menu className="size-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-canvas px-3 py-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-2.5">
              <Logo /><button onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
            </div>
            <div className="flex-1">{nav}</div>
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
