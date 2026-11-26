// Deterministic safety nets that run regardless of which AI provider is used.

const URGENCY = /\b(asap|a\.s\.a\.p|urgent(ly)?|emergency|right away|immediately|today|tonight|getting worse|flood(ing|ed)?|burst|no (heat|heating|power|hot water)|sparking|as soon as possible|need (someone|somebody) (now|quick|fast))\b/i;
const OPT_OUT = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|remove me|opt ?out)\s*[.!]?\s*$/i;
const NOT_INTERESTED = /\b(not interested|no longer need|found someone|already (sorted|booked|hired)|no thanks)\b/i;
const DANGER = /\b(gas (leak|smell)|smell (of )?gas|fire|smoke|electrocut|injur|lawyer|solicitor|sue|complaint)\b/i;

export const detectUrgency = (t: string) => URGENCY.test(t);
export const detectOptOut = (t: string) => OPT_OUT.test(t);
export const detectNotInterested = (t: string) => NOT_INTERESTED.test(t);
export const detectDanger = (t: string) => DANGER.test(t);

const MONEY = /(?:[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?(?:euro|eur|dollars?|usd|pounds?|gbp)\b)/gi;
const digits = (s: string) => s.replace(/[^\d]/g, "");

/** Returns true if the reply mentions a monetary amount that does not appear in the business info. */
export function mentionsUnknownPrice(reply: string, knowledge: string): boolean {
  const amounts = reply.match(MONEY) ?? [];
  const known = new Set((knowledge.match(/\d[\d,.]*/g) ?? []).map(digits));
  return amounts.some((a) => !known.has(digits(a)));
}

const PROMISES = /\b(i('ve| have) (booked|scheduled|reserved)|you('re| are) (booked|confirmed)|we('ll| will) be there (at|on|by)|guarantee(d)?|full refund|we('ll| will) refund)\b/i;

export function makesUnauthorisedPromise(reply: string, knowledge: string): boolean {
  const m = reply.match(PROMISES);
  if (!m) return false;
  // Allow "guarantee"/"refund" only if the business wrote about it themselves.
  const word = m[0].toLowerCase();
  if (word.includes("guarantee")) return !/guarantee/i.test(knowledge);
  if (word.includes("refund")) return !/refund/i.test(knowledge);
  return true;
}

// Compliance / certification / safety-assurance claims. Allowed only when the business itself stated the fact.
const CLAIMS: { re: RegExp; allowIf: RegExp | null }[] = [ // allowIf null = never allowed
  { re: /\b(fully )?compliant\b|\bcompliance\b/i, allowIf: /complian/i },
  { re: /\b(up to|meets?|meeting) (the )?(building |safety |electrical |gas )?(code|codes|regulations|standards)\b/i, allowIf: /(code|regulation|standard)/i },
  { re: /\b(certified|accredited|registered|approved installer)\b/i, allowIf: /(certif|accredit|registered|approved)/i },
  { re: /\blicen[cs]ed\b/i, allowIf: /licen[cs]/i },
  { re: /\binsured\b/i, allowIf: /insur/i },
  { re: /\b(it'?s|it is|that'?s|completely|perfectly) safe\b|\bno (risk|danger)\b|\bnothing to worry about\b/i, allowIf: null },
  { re: /\b(legal(ly)? (advice|right)|you (can|should) sue|medical advice|tax advice|financial advice)\b/i, allowIf: null },
];

/** Returns the claim type if the reply asserts compliance/certification/safety not supported by the business info. */
export function makesUnverifiedClaim(reply: string, knowledge: string): string | null {
  for (const c of CLAIMS) if (c.re.test(reply) && !(c.allowIf && c.allowIf.test(knowledge))) return c.re.source.slice(0, 40);
  return null;
}

export function temperatureFromScore(score: number): "hot" | "warm" | "cold" {
  if (score >= 80) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}
