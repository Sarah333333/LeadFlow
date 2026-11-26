import { z } from "zod";
import { email, httpUrl, isValidTimeZone, optionalText, phone, text } from "@/lib/security/validation";
import { CURRENCIES, TRADES } from "./trades";

const service = z.object({ name: text(80).pipe(z.string().min(1)), price_range: optionalText(60), description: optionalText(200) });
const faq = z.object({ question: text(200).pipe(z.string().min(1)), answer: text(1000).pipe(z.string().min(1)) });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.object({ open: time, close: time, closed: z.boolean() });
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Shared by onboarding and Settings → Business profile. Every field is bounded. */
export const businessProfileSchema = z.object({
  name: text(100).pipe(z.string().min(2, "Business name is required")),
  industry: z.enum(TRADES.map((t) => t.id) as [string, ...string[]]).default("home_services"),
  description: optionalText(1500),
  contact_phone: phone.default(""),
  contact_email: email.default(""),
  website: httpUrl.default(""),
  services: z.array(service).max(40, "Up to 40 services").default([]),
  average_job_value: z.coerce.number().min(0).max(1_000_000).default(0),
  currency: z.enum(CURRENCIES as unknown as [string, ...string[]]).default("EUR"),
  service_areas: z.array(text(80).pipe(z.string().min(1))).max(60, "Up to 60 service areas").default([]),
  opening_hours: z.object(Object.fromEntries(DAY_KEYS.map((d) => [d, day.optional()]))).strict().default({}),
  faqs: z.array(faq).max(40, "Up to 40 FAQs").default([]),
  tone: z.enum(["friendly", "professional", "casual"]).default("friendly"),
  booking_link: httpUrl.default(""),
  timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").default("Europe/Dublin"),
  notify_phone: phone.default(""),
  notify_email: email.default(""),
}).strict();
/** Shape edited by the onboarding/settings forms (validated by businessProfileSchema on the server). */
export interface BusinessProfile {
  name: string; industry: string; description: string; contact_phone: string; contact_email: string; website: string;
  services: { name: string; price_range: string; description: string }[]; average_job_value: number; currency: string;
  service_areas: string[]; opening_hours: Record<string, { open: string; close: string; closed: boolean }>;
  faqs: { question: string; answer: string }[]; tone: "friendly" | "professional" | "casual";
  booking_link: string; timezone: string; notify_phone: string; notify_email: string;
}

/** Drop half-filled rows from editors before validating. */
export function cleanProfile(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = { ...(raw as Record<string, unknown>) } as Record<string, unknown> & { services?: unknown; faqs?: unknown };
  if (Array.isArray(r.services)) r.services = r.services.filter((s) => s && typeof s === "object" && String((s as { name?: unknown }).name ?? "").trim());
  if (Array.isArray(r.faqs)) r.faqs = r.faqs.filter((f) => f && typeof f === "object" && String((f as { question?: unknown }).question ?? "").trim() && String((f as { answer?: unknown }).answer ?? "").trim());
  return r;
}

export const nullIfEmpty = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/** Store website/booking links with a scheme so they are always safe http(s) links. */
export const normalizeUrl = (s: string | undefined) => {
  const v = nullIfEmpty(s);
  return v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null;
};
