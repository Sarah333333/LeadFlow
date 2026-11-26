import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Claims a webhook/event ID exactly once. Returns false if it was already processed (or is being processed).
 * On failure call releaseEvent() so the provider's retry can process it again.
 */
export async function claimEvent(provider: string, eventId: string): Promise<boolean> {
  const { error } = await createAdminClient().from("webhook_events").insert({ provider, event_id: eventId.slice(0, 200) });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`idempotency store unavailable: ${error.code}`);
}

export async function completeEvent(provider: string, eventId: string) {
  await createAdminClient().from("webhook_events").update({ status: "done" }).eq("provider", provider).eq("event_id", eventId.slice(0, 200));
}

export async function releaseEvent(provider: string, eventId: string) {
  await createAdminClient().from("webhook_events").delete().eq("provider", provider).eq("event_id", eventId.slice(0, 200));
}
