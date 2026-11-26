import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/** Supabase client acting as the logged-in user. Row Level Security applies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Red-team fix: the session is only ever read on the server, so JavaScript never needs it → httpOnly.
      // Secure in production (allowed off only for local http:// test builds).
      cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production" && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.NEXT_PUBLIC_APP_URL ?? ""), sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: cookies are refreshed by middleware instead.
          }
        },
      },
    },
  );
}
