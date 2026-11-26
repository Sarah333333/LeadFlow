import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

/**
 * Fixed-window rate limit backed by Postgres (works across serverless instances, no extra infra).
 * Fails OPEN on a DB error so an outage of the limiter doesn't take the product down — the
 * per-business daily AI caps in the engine still bound cost in that case.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) {
    log.error("rate_limit.error", { key, error: error.message });
    return true;
  }
  if (data === false) log.security("rate_limit.exceeded", { key: key.replace(/:[^:]*@[^:]*/, ":[email]"), limit, windowSeconds });
  return data !== false;
}

/** All limits in one place. */
export const LIMITS = {
  loginPerIp: [20, 600], loginPerEmail: [8, 600], signupPerIp: [5, 3600],
  intakePerKey: [30, 60], intakePerKeyDaily: [500, 86400], intakePerIp: [6, 60],
  smsInboundPerSender: [15, 600],
  simulatePerUser: [20, 600], ownerSendPerUser: [30, 60], checkoutPerBusiness: [10, 3600],
  mutationPerUser: [60, 60], exportPerUser: [10, 3600],
  ownerSmsPerBusiness: [20, 86400],
  // Platform-wide circuit breaker: total AI turns across ALL free-trial accounts per day (mass-signup abuse).
  trialAiGlobal: [3000, 86400], ownerEmailPerBusiness: [100, 86400],
} as const satisfies Record<string, readonly [number, number]>;

export async function limit(name: keyof typeof LIMITS, id: string) {
  const [n, w] = LIMITS[name];
  return rateLimit(`${name}:${id}`, n, w);
}
