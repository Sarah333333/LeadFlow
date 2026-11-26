"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "Business" }, { href: "/settings/ai", label: "Assistant" },
  { href: "/settings/follow-ups", label: "Follow-ups" }, { href: "/settings/notifications", label: "Alerts" },
  { href: "/settings/intake", label: "Lead sources" }, { href: "/settings/privacy", label: "Privacy & AI" }, { href: "/settings/billing", label: "Billing" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
          className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition",
            path === t.href ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
