import "server-only";
import type { User } from "@supabase/supabase-js";
import { log } from "@/lib/log";

/**
 * LeadFlow operator check — ALL of:
 *  1. email in ADMIN_EMAILS,
 *  2. email verified (so nobody can sign up "as" an admin address),
 *  3. app_metadata.leadflow_admin === true — app_metadata can only be set with the service role
 *     (scripts/grant-admin.mjs), never by the user themselves.
 */
export function isPlatformAdmin(user: User | null): boolean {
  if (!user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const ok = admins.includes(user.email.toLowerCase()) && Boolean(user.email_confirmed_at) && user.app_metadata?.leadflow_admin === true;
  if (!ok && admins.includes(user.email.toLowerCase())) log.security("admin.access_denied", { userId: user.id, confirmed: Boolean(user.email_confirmed_at), flag: user.app_metadata?.leadflow_admin === true });
  return ok;
}
