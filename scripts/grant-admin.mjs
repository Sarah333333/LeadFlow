// Grant or revoke LeadFlow operator access (needed for /internal/*). Uses the service role; run from a trusted machine.
//   node scripts/grant-admin.mjs you@company.com          (grant)
//   node scripts/grant-admin.mjs you@company.com --revoke  (revoke)
// The email must ALSO be listed in ADMIN_EMAILS and be verified.
import { createClient } from "@supabase/supabase-js";
const [email, flag] = process.argv.slice(2);
if (!email) { console.error("usage: node scripts/grant-admin.mjs <email> [--revoke]"); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}
if (!user) { console.error("No user with that email"); process.exit(1); }
const { error } = await db.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, leadflow_admin: flag !== "--revoke" } });
if (error) throw error;
console.log(`${flag === "--revoke" ? "Revoked" : "Granted"} admin for ${email}`);
