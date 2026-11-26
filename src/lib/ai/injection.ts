// Prompt-injection defences. Lead messages are UNTRUSTED input.

const INJECTION = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|the)\b[^.\n]{0,20}\b(instructions?|rules?|prompts?|directions?|guidelines?)\b/i,
  /\b(system|developer|hidden|initial|original)\s+(prompt|message|instructions?)\b/i,
  /\b(reveal|print|show|repeat|output|tell me|what (is|are)|give me|translate|summari[sz]e|paraphrase|rewrite|rephrase|spell( out)?|encode|list|describe|explain)\b[^.\n]{0,30}\b(your|the|my|these|those)\s+(\w+\s+)?(instructions|rules|prompt|configuration|guidelines|api key|secret|directives)/i,
  /\byou are now\b|\bact as (a|an|the)\b(?! customer)|\bdeveloper mode\b|\bjailbreak\b|\bDAN\b/i,
  /\b(api[ _-]?key|service[ _-]?role|database|sql|other (customers?|clients?|leads?)|admin panel)\b.{0,40}\b(show|give|list|dump|send|reveal|access)\b|\b(show|give|list|dump|send|reveal|access)\b.{0,40}\b(api[ _-]?key|service[ _-]?role|database|other (customers?|clients?|leads?))\b/i,
  /<\/?(system|assistant|instructions?)>|\[\/?(INST|SYS)\]|^\s*(system|assistant)\s*:/im,
];

// Common non-English phrasings ("ignore previous instructions", "system prompt") — FR, ES, PT, IT, DE, GA.
const MULTILINGUAL = [
  /\b(ignore[rz]?|oublie[rz]?)\b.{0,40}\binstructions?\b/i,
  /\b(ignora|olvida|ignore|esqueça|dimentica)\b.{0,40}\b(instrucciones|instruções|istruzioni|reglas|regras|regole)\b/i,
  /\b(ignoriere|vergiss)\b.{0,40}\b(anweisungen|regeln)\b/i,
  /\b(prompt (syst[eè]me|del sistema|do sistema|di sistema)|systemprompt|system-prompt)\b/i,
  /\bdéan neamhaird\b/i,
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "l" };

/**
 * Canonical form for detection only (the stored message is unchanged): Unicode-compatibility folding
 * (fullwidth → ASCII), invisible characters removed, leetspeak mapped, and spaced-out letters joined
 * ("i g n o r e" → "ignore").
 */
export function normalizeForDetection(text: string): string {
  let t = text.normalize("NFKC").replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD]/g, (c) => (c === "\n" ? "\n" : ""));
  t = t.replace(/[013457@$!|]/g, (c, i, str) => (/[a-z]/i.test(str[i - 1] ?? "") || /[a-z]/i.test(str[i + 1] ?? "") ? LEET[c] : c));
  t = t.replace(/\b(?:[a-z] ){3,}[a-z]\b/gi, (m) => m.replace(/ /g, ""));
  return t;
}

export function detectPromptInjection(text: string): boolean {
  const variants = [text, normalizeForDetection(text)];
  return variants.some((v) => INJECTION.some((r) => r.test(v)) || MULTILINGUAL.some((r) => r.test(v)));
}

/** Remove markers a lead could use to impersonate the business owner or our system notes. */
export function neutralizeImpersonation(text: string): string {
  return text.replace(/\[\s*(sent by the business owner|automated system note|system|owner|assistant)[^\]]{0,80}\]/gi, "")
    .replace(/<\/?\s*(lead_data|system|assistant|instructions?)\b[^>]*>/gi, "");
}

/** Owner-facing AI text (summary, details, hand-off reason) must not carry links — a lead could plant phishing. */
export function stripLinks(text: string): string {
  return text
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "[link removed]")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/gi, "[link removed]");
}

const MARKERS = /\b(STRICT RULES|BUSINESS INFORMATION|LEAD RECORD|ADDITIONAL INSTRUCTIONS|UNTRUSTED|system prompt|my (instructions|rules|prompt)|I (was|am|have been) (instructed|told|programmed) to)\b/i;
const SECRETS = /(sk-[A-Za-z0-9_-]{8,}|sk_(live|test)_|whsec_|eyJ[A-Za-z0-9_-]{10,}\.|AC[0-9a-f]{32}|SUPABASE|SERVICE_ROLE|OPENAI_API_KEY)/;

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9€$£ ]+/g, " ").split(/\s+/).filter(Boolean);
function shingles(s: string, n: number) {
  const w = words(s), out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/**
 * True if a reply leaks internal material: prompt markers, secret-looking strings, or any
 * 7-word run copied from internal text (system rules / owner's private custom instructions).
 * Public business information (prices, FAQs) is intentionally NOT treated as internal.
 */
export function leaksInternals(reply: string, internalTexts: string[]): boolean {
  if (MARKERS.test(reply) || SECRETS.test(reply)) return true;
  const r = shingles(reply, 7);
  return internalTexts.some((t) => [...shingles(t, 7)].some((s) => r.has(s)));
}
