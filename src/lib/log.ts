// Structured JSON logging with redaction. Ship stdout to your log drain (Vercel → Axiom/Datadog/Better Stack).
// NEVER log: passwords, API keys, tokens, card data, message bodies. Phones/emails are masked.

type Level = "info" | "warn" | "error" | "security";
type Fields = Record<string, unknown>;

const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|cookie|signature|card|cvc|service[_-]?role/i;
const BODY_KEY = /^(body|text|message|reply|content|prompt|initial_message)$/i;
const SECRET_VALUE = /(sk-[A-Za-z0-9_-]{8,}|sk_(live|test)_[A-Za-z0-9]{6,}|whsec_[A-Za-z0-9]{6,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+|AC[0-9a-f]{32})/g;

export function maskPhone(p: string) {
  return p.length > 4 ? `${p.slice(0, 4)}***${p.slice(-2)}` : "***";
}
export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 1)}***@${d}` : "***";
}

export function redact(value: unknown, key = "", depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (key && SECRET_KEY.test(key)) return "[redacted]";
  if (key && BODY_KEY.test(key)) return typeof value === "string" ? `[${value.length} chars]` : "[redacted]";
  if (typeof value === "string") {
    let v = value.replace(SECRET_VALUE, "[redacted-secret]");
    if (/phone|from|to$/i.test(key)) v = maskPhone(v);
    if (/email/i.test(key)) v = maskEmail(v);
    return v.length > 500 ? v.slice(0, 500) + "…" : v;
  }
  if (value instanceof Error) {
    return { name: value.name, message: String(redact(value.message)), ...(process.env.NODE_ENV !== "production" ? { stack: String(redact(value.stack?.split("\n").slice(0, 4).join(" | ") ?? "")) } : {}) };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, "", depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Fields).map(([k, v]) => [k, redact(v, k, depth + 1)]));
  }
  return value;
}

function write(level: Level, event: string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as Fields) });
  if (level === "error") console.error(line);
  else if (level === "warn" || level === "security") console.warn(line);
  else if (process.env.NODE_ENV !== "test") console.log(line);
}

export const log = {
  info: (event: string, f?: Fields) => write("info", event, f),
  warn: (event: string, f?: Fields) => write("warn", event, f),
  error: (event: string, f?: Fields) => write("error", event, f),
  /** Security-relevant events: auth failures, signature failures, cross-tenant attempts, injection, rate limits. */
  security: (event: string, f?: Fields) => write("security", event, f),
};
