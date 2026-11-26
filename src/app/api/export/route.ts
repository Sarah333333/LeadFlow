import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exportBusinessData } from "@/lib/engine";
import { audit } from "@/lib/compliance/records";
import { limit } from "@/lib/security/rate-limit";
import { uuid } from "@/lib/security/validation";
import { log } from "@/lib/log";

/**
 * Data export (portability / access requests). Owner only. GET /api/export or /api/export?lead=<id>.
 * Authenticated by the httpOnly session cookie; the business is resolved through RLS, never from the request.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership } = await supabase.from("business_members").select("business_id, role").eq("user_id", user.id).maybeSingle();
  if (!membership || membership.role !== "owner") {
    log.security("export.denied", { userId: user.id });
    return NextResponse.json({ error: "Only the account owner can export data" }, { status: 403 });
  }
  if (!(await limit("exportPerUser", user.id))) return NextResponse.json({ error: "Too many exports — try again later" }, { status: 429 });

  const leadParam = req.nextUrl.searchParams.get("lead");
  let leadId: string | undefined;
  if (leadParam) {
    const parsed = uuid.safeParse(leadParam);
    if (!parsed.success) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: lead } = await supabase.from("leads").select("id").eq("id", parsed.data).maybeSingle(); // RLS-scoped
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    leadId = lead.id;
  }
  const data = await exportBusinessData(membership.business_id, { leadId });
  await audit(createAdminClient(), { businessId: membership.business_id, actor: "user", userId: user.id,
    action: leadId ? "data.exported_lead" : "data.exported_all", targetType: leadId ? "lead" : "business", targetId: leadId ?? membership.business_id });
  const name = leadId ? `leadflow-lead-${leadId.slice(0, 8)}` : `leadflow-export-${new Date().toISOString().slice(0, 10)}`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
