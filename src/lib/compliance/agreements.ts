import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipFrom } from "@/lib/security/http";
import { ipHash } from "./records";
import { LEGAL_VERSIONS, type LegalDocument } from "./legal";

/** Records acceptance of the CURRENT version of each document (append-only), with evidence. */
export async function recordAgreements(userId: string, businessId: string | null, docs: LegalDocument[]) {
  const h = await headers();
  await createAdminClient().from("agreements").insert(docs.map((document) => ({
    user_id: userId, business_id: businessId, document, version: LEGAL_VERSIONS[document],
    ip_hash: ipHash(ipFrom(h)), user_agent: (h.get("user-agent") ?? "").slice(0, 200),
  })));
}

/** Which required documents the user hasn't accepted in their current version. */
export async function missingAgreements(userId: string, required: LegalDocument[] = ["terms", "privacy"]) {
  const { data } = await createAdminClient().from("agreements").select("document, version").eq("user_id", userId);
  return required.filter((d) => !(data ?? []).some((a) => a.document === d && a.version === LEGAL_VERSIONS[d]));
}
