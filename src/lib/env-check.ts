// Startup configuration check. In production, a misconfiguration stops the server from starting instead of
// running in a half-secure state. Never prints secret VALUES — only variable names.

export function checkEnvironment(env: NodeJS.ProcessEnv = process.env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const prod = env.NODE_ENV === "production";
  const need = (k: string) => { if (!env[k]) errors.push(`${k} is required`); };
  ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL", "CRON_SECRET"].forEach(need);

  // Secrets must never be exposed through NEXT_PUBLIC_* (those are inlined into browser JavaScript).
  for (const k of Object.keys(env)) {
    if (k.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE|PRIVATE|TOKEN|PASSWORD|API_KEY/i.test(k)) errors.push(`${k}: secrets must not use the NEXT_PUBLIC_ prefix`);
  }
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is set to the service-role key");
  }
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try { // the public key must be an anon-role key
      const payload = JSON.parse(Buffer.from(env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split(".")[1] ?? "", "base64url").toString());
      if (payload.role && payload.role !== "anon") errors.push(`NEXT_PUBLIC_SUPABASE_ANON_KEY has role "${payload.role}" (must be anon)`);
    } catch { /* new-style publishable keys aren't JWTs */ }
  }
  if (env.CRON_SECRET && env.CRON_SECRET.length < 32) (prod ? errors : warnings).push("CRON_SECRET should be at least 32 random characters");
  if (prod) {
    if (env.ALLOW_DEMO_AI === "true") errors.push("ALLOW_DEMO_AI must not be true in production");
    if (env.NEXT_PUBLIC_APP_URL && !env.NEXT_PUBLIC_APP_URL.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(env.NEXT_PUBLIC_APP_URL)) errors.push("NEXT_PUBLIC_APP_URL must be https in production");
    if (!env.OPENAI_API_KEY) warnings.push("OPENAI_API_KEY not set — the assistant will send holding replies only");
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) errors.push("STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set");
    if (env.STRIPE_SECRET_KEY?.startsWith("sk_test_") && /^https:\/\//.test(env.NEXT_PUBLIC_APP_URL ?? "")) warnings.push("Stripe is in TEST mode");
    if (env.TWILIO_ACCOUNT_SID && !env.TWILIO_AUTH_TOKEN) errors.push("TWILIO_AUTH_TOKEN is required when TWILIO_ACCOUNT_SID is set");
    if (!env.ADMIN_EMAILS) warnings.push("ADMIN_EMAILS not set — internal dashboard disabled");
  }
  for (const k of ["OPENAI_API_KEY", "STRIPE_SECRET_KEY", "TWILIO_AUTH_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[k] && /^(changeme|your[-_]|xxx|test|placeholder)/i.test(env[k]!) && prod) errors.push(`${k} looks like a placeholder`);
  }
  return { errors, warnings };
}
