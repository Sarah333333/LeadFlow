import type { Business } from "@/lib/types";
import type { BusinessProfile } from "./schema";
import { DEFAULT_HOURS } from "./trades";

/** DB row → editable profile (used by onboarding and Settings → Business). */
export function toProfile(b: Business | null, email = ""): BusinessProfile {
  const hours = b?.opening_hours as BusinessProfile["opening_hours"] | undefined;
  return {
    name: b?.name ?? "", industry: b?.industry ?? "roofing", description: b?.description ?? "",
    contact_phone: b?.contact_phone ?? "", contact_email: b?.contact_email ?? email, website: b?.website ?? "",
    services: (b?.services as BusinessProfile["services"]) ?? [], average_job_value: Number(b?.average_job_value ?? 0),
    currency: b?.currency ?? "EUR", service_areas: b?.service_areas ?? [],
    opening_hours: hours && Object.keys(hours).length ? hours : DEFAULT_HOURS,
    faqs: (b?.faqs as BusinessProfile["faqs"]) ?? [], tone: (b?.tone as BusinessProfile["tone"]) ?? "friendly",
    booking_link: b?.booking_link ?? "", timezone: b?.timezone ?? "Europe/Dublin",
    notify_phone: b?.notify_phone ?? "", notify_email: b?.notify_email ?? email,
  };
}
