"use server";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, safeRedirectPath } from "@/lib/security/http";
import { limit } from "@/lib/security/rate-limit";
import { log, maskEmail } from "@/lib/log";
import { recordAgreements } from "@/lib/compliance/agreements";

export type AuthState = { error?: string; message?: string } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(1).max(72), // bcrypt only uses the first 72 bytes — reject longer rather than silently truncate
});
const emailHash = (e: string) => createHash("sha256").update(e).digest("hex").slice(0, 16);

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (!(await limit("signupPerIp", ip))) return { error: "Too many sign-up attempts. Please try again later." };
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and a password of at most 72 characters." };
  if (parsed.data.password.length < 10) return { error: "Use a password of at least 10 characters." };
  if (form.get("accept_terms") !== "on") return { error: "Please confirm you agree to the Terms and Privacy Policy and are 18+ using LeadFlow for a business." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { emailRedirectTo: `${env.appUrl}/auth/callback?next=/onboarding` },
  });
  if (error) {
    log.warn("auth.signup_failed", { ip, email: maskEmail(parsed.data.email), code: error.code });
    // Weak/breached password messages are safe and useful; everything else is generic (no account enumeration).
    return { error: error.code === "weak_password" ? error.message : "We couldn't create that account. Please try again or log in." };
  }
  log.info("auth.signup", { userId: data.user?.id });
  if (data.user) await recordAgreements(data.user.id, null, ["terms", "privacy"]);
  if (!data.session) return { message: "Check your inbox to confirm your email, then log in." };
  redirect("/onboarding");
}

export async function logIn(_: AuthState, form: FormData): Promise<AuthState> {
  const ip = await clientIp();
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Incorrect email or password." };
  if (!(await limit("loginPerIp", ip)) || !(await limit("loginPerEmail", emailHash(parsed.data.email)))) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    log.security("auth.login_failed", { ip, email: maskEmail(parsed.data.email), code: error.code });
    return { error: "Incorrect email or password." };
  }
  redirect(safeRedirectPath(String(form.get("next") ?? "")));
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
