import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type Business = Tables["businesses"]["Row"];
export type Lead = Tables["leads"]["Row"];
export type Message = Tables["messages"]["Row"];
export type FollowUp = Tables["follow_ups"]["Row"];
export type LeadEvent = Tables["lead_events"]["Row"];
export type Notification = Tables["notifications"]["Row"];

export type Temperature = "hot" | "warm" | "cold";
export type LeadStatus =
  | "new" | "contacted" | "engaged" | "qualified" | "won" | "lost" | "unresponsive" | "opted_out";
export type Tone = "friendly" | "professional" | "casual";

export interface ServiceItem { name: string; price_range: string; description: string }
export interface FaqItem { question: string; answer: string }
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export interface DayHours { open: string; close: string; closed: boolean }
export type OpeningHours = Partial<Record<Day, DayHours>>;

export const DAYS: { key: Day; label: string }[] = [
  { key: "mon", label: "Monday" }, { key: "tue", label: "Tuesday" }, { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" }, { key: "fri", label: "Friday" }, { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export const LEAD_SOURCES = [
  { value: "website", label: "Website form" }, { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" }, { value: "google", label: "Google" },
  { value: "referral", label: "Referral" }, { value: "phone", label: "Phone call" },
  { value: "manual", label: "Manual" }, { value: "webhook", label: "Integration" },
  { value: "sms", label: "Text message" }, { value: "other", label: "Other" },
] as const;

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", engaged: "Engaged", qualified: "Qualified",
  won: "Won", lost: "Lost", unresponsive: "Unresponsive", opted_out: "Opted out",
};

export const CLOSED_STATUSES: LeadStatus[] = ["won", "lost", "opted_out"];
