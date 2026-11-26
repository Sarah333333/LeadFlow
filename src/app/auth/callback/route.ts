import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/http";
import { log } from "@/lib/log";

// Email confirmation landing: exchanges the one-time PKCE code for a session cookie.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next")); // never an open redirect
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      log.security("auth.callback_failed", { code: error.code });
      return NextResponse.redirect(new URL("/login", url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
