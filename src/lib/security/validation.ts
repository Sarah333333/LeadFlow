import { z } from "zod";

export const uuid = z.string().uuid();

/** Control chars (except \t \n \r), zero-width chars and bidi overrides — used to hide or spoof text. */
export const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
export const stripInvisible = (s: string) => s.replace(INVISIBLE, "");
/** Strip invisible/control characters and trim. */
export const clean = (s: string) => stripInvisible(s).trim();

export const text = (max: number) => z.string().max(max * 4).transform(clean).pipe(z.string().max(max));
export const optionalText = (max: number) => text(max).optional().default("");

/** http(s) URLs only — never javascript:, data:, etc. */
export const httpUrl = z.string().transform(clean).pipe(
  z.string().max(500).refine((v) => {
    if (!v) return true;
    try { const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); return ["http:", "https:"].includes(u.protocol) && u.hostname.includes("."); }
    catch { return false; }
  }, "Enter a valid web address"),
);

export const phone = z.string().transform(clean).pipe(
  z.string().max(32).refine((v) => !v || /^[+()\d\s.-]{6,32}$/.test(v), "Enter a valid phone number"),
);
export const email = z.string().transform(clean).pipe(z.string().max(254).email("Enter a valid email").or(z.literal("")));

export function isValidTimeZone(tz: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}
