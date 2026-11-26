/** Normalise to E.164 (+353871234567). Returns null for anything that isn't a plausible phone number. */
export function normalizePhone(raw: string | null | undefined, defaultCountry = "353"): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, "");
  if (!p) return null;
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) p = p.startsWith("0") ? `+${defaultCountry}${p.slice(1)}` : `+${p}`;
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}
