import { NextResponse, type NextRequest } from "next/server";
import { cleanupHousekeeping, processDueFollowUps, sweepStalledConversations } from "@/lib/engine";
import { env } from "@/lib/env";
import { ipFrom, safeEqual } from "@/lib/security/http";
import { log } from "@/lib/log";

// Triggered every minute by Supabase pg_cron or Vercel Cron (see docs/DEPLOYMENT.md).
// Idempotent and safe to run concurrently: follow-ups are claimed atomically and AI turns hold a per-lead lock.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!env.cronSecret || env.cronSecret.length < 16 || !safeEqual(req.headers.get("authorization"), `Bearer ${env.cronSecret}`)) {
    log.security("cron.unauthorized", { ip: ipFrom(req.headers) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const followUps = await processDueFollowUps();
    const recovered = await sweepStalledConversations();
    if (new Date().getUTCMinutes() === 0) await cleanupHousekeeping();
    if (followUps.length || recovered.length) log.info("cron.run", { followUps: followUps.length, recovered: recovered.length });
    return NextResponse.json({ processed: followUps.length, results: followUps, recovered });
  } catch (e) {
    log.error("cron.failed", { error: e });
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
export const POST = GET;
