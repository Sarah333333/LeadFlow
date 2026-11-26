// Generates docs/legal/LEGAL_RISK_REGISTER.md from src/lib/compliance/risk-register.ts (single source of truth).
// Run: node --experimental-strip-types scripts/gen-risk-register.mjs
import { writeFileSync } from "node:fs";
const { RISKS, STATUS_LABEL, LAUNCH_CHECKLIST } = await import("../src/lib/compliance/risk-register.ts");

const out = [
  "# Legal & operational risk register",
  "",
  "> Generated from `src/lib/compliance/risk-register.ts` — edit that file, then run `node --experimental-strip-types scripts/gen-risk-register.mjs`.",
  "> **This register is a tracking tool. A complete register does not mean LeadFlow is legally compliant.** Nothing here is legal advice; items marked for legal review require a qualified lawyer.",
  "",
];
for (const area of [...new Set(RISKS.map((r) => r.area))]) {
  out.push(`## ${area}`, "");
  for (const r of RISKS.filter((x) => x.area === area)) {
    out.push(`### ${r.id} — ${r.title}`, "",
      `- **Severity:** ${r.severity} · **Status:** ${STATUS_LABEL[r.status]}${r.reviewedBy ? ` (${r.reviewedBy}, ${r.reviewedOn})` : ""}`,
      `- **1. The risk / 2. Why it matters:** ${r.why}`,
      `- **3. Technical protection built:** ${r.technical}`,
      `- **4. Policy / contract protection:** ${r.policy}`,
      `- **5. Needs review by a qualified lawyer:** ${r.lawyer}`, "");
  }
}
out.push("## Launch checklist", "", ...LAUNCH_CHECKLIST.map((c, i) => `${i + 1}. ${c}`), "");
writeFileSync(new URL("../docs/legal/LEGAL_RISK_REGISTER.md", import.meta.url), out.join("\n"));
console.log(`wrote ${RISKS.length} risks`);
