import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { headers } from "next/headers";

/** Constant-time string comparison (secrets, tokens). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Only allow same-site relative paths ("/leads"), never "//evil.com", "/\evil.com" or absolute URLs. */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://x.invalid");
    if (u.origin !== "http://x.invalid") return fallback;
    return u.pathname + u.search;
  } catch { return fallback; }
}

/**
 * Client IP for rate limiting, read from ONE trusted header (TRUSTED_IP_HEADER, default x-forwarded-for).
 * On Vercel, x-forwarded-for is overwritten by the platform so its first entry is the real client.
 * Behind another proxy, set TRUSTED_IP_HEADER to the header it sets and clients can't forge
 * (e.g. cf-connecting-ip on Cloudflare). Red-team fix: we no longer prefer a header a client could send
 * themselves off-platform (x-vercel-forwarded-for) to rotate their apparent IP.
 */
export function ipFrom(h: Headers): string {
  const header = (process.env.TRUSTED_IP_HEADER || "x-forwarded-for").toLowerCase();
  return (h.get(header)?.split(",")[0] ?? "unknown").trim().slice(0, 64) || "unknown";
}
export async function clientIp() {
  return ipFrom(await headers());
}

export class BodyTooLarge extends Error {}

/** Reads a request body with a hard size cap (default 64 KB). */
export async function readBody(req: Request, maxBytes = 64 * 1024): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new BodyTooLarge();
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new BodyTooLarge(); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
