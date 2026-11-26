import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNowStrict, format } from "date-fns";

export const cn = (...c: ClassValue[]) => clsx(c);

export function timeAgo(d: string | null | undefined) {
  if (!d) return "—";
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
}

export function formatDate(d: string | null | undefined, f = "d MMM yyyy") {
  return d ? format(new Date(d), f) : "—";
}

/** "in 3 hours" / "2 minutes ago" */
export function relative(d: string | null | undefined) {
  if (!d) return "—";
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
}

export function money(n: number | null | undefined, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n ?? 0);
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export const UNKNOWN_LEAD_NAME = "Unknown";
/** First name for greetings, or null when we don't actually know their name. */
export function firstName(name: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  if (!n || n === UNKNOWN_LEAD_NAME || /^[+\d(]/.test(n) || n.includes("@")) return null;
  return n.split(/\s+/)[0];
}
