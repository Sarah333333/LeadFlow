import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;
type ConsentBasis = Database["public"]["Tables"]["consent_events"]["Insert"]["basis"];

/** Pseudonymised phone identifier (matches the DB trigger's computation). */
export const phoneHash = (businessId: string, phone: string) =>
  createHash("sha256").update(`${businessId}:${phone}`).digest("hex");

export const ipHash = (ip: string) => createHash("sha256").update(`ip:${ip}`).digest("hex").slice(0, 32);

export async function audit(db: DB, e: {
  businessId: string | null; actor: "user" | "ai" | "system"; userId?: string | null;
  action: string; targetType?: string; targetId?: string | null; details?: Record<string, unknown>;
}) {
  await db.from("audit_log").insert({
    business_id: e.businessId, actor_type: e.actor, actor_user_id: e.userId ?? null, action: e.action,
    target_type: e.targetType ?? null, target_id: e.targetId ?? null, details: (e.details ?? {}) as never,
  });
}

/** Append to the consent ledger and update the lead's current SMS consent state. */
export async function recordConsent(db: DB, e: {
  businessId: string; leadId: string; phone: string | null; action: "granted" | "revoked" | "reinstated";
  basis: ConsentBasis; evidence?: Record<string, unknown>;
}) {
  await db.from("consent_events").insert({
    business_id: e.businessId, lead_id: e.leadId, phone_hash: e.phone ? phoneHash(e.businessId, e.phone) : null,
    channel: "sms", action: e.action, basis: e.basis, evidence: (e.evidence ?? {}) as never,
  });
  const now = new Date().toISOString();
  if (e.action === "revoked") {
    await db.from("leads").update({ sms_consent: "revoked", sms_consent_at: now, sms_consent_source: e.basis })
      .eq("id", e.leadId).eq("business_id", e.businessId);
    if (e.phone) {
      await db.from("suppression_list").upsert({ business_id: e.businessId, phone_hash: phoneHash(e.businessId, e.phone), channel: "sms", reason: e.basis },
        { onConflict: "business_id,phone_hash,channel", ignoreDuplicates: true });
    }
  } else {
    await db.from("leads").update({ sms_consent: "granted", sms_consent_at: now, sms_consent_source: e.basis })
      .eq("id", e.leadId).eq("business_id", e.businessId);
    if (e.action === "reinstated" && e.phone) {
      await db.from("suppression_list").delete().eq("business_id", e.businessId).eq("phone_hash", phoneHash(e.businessId, e.phone)).eq("channel", "sms");
    }
  }
}

export async function isSuppressed(db: DB, businessId: string, phone: string | null) {
  if (!phone) return false;
  const { data } = await db.from("suppression_list").select("reason").eq("business_id", businessId)
    .eq("phone_hash", phoneHash(businessId, phone)).eq("channel", "sms").maybeSingle();
  return Boolean(data);
}
