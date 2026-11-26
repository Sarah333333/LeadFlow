// Data minimisation: strip data LeadFlow must never hold (payment card numbers, IBANs) from inbound text.

function luhn(digits: string) {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

const CARD = /\b\d(?:[ -]?\d){12,18}\b/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g;

export function redactSensitive(text: string): { text: string; redacted: string[] } {
  const redacted: string[] = [];
  let out = text.replace(CARD, (m) => {
    const d = m.replace(/\D/g, "");
    if (d.length >= 13 && d.length <= 19 && luhn(d)) { redacted.push("payment_card"); return "[card number removed]"; }
    return m;
  });
  out = out.replace(IBAN, () => { redacted.push("iban"); return "[bank details removed]"; });
  return { text: out, redacted };
}
