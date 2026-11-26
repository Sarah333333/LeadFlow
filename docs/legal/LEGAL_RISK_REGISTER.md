# Legal & operational risk register

> Generated from `src/lib/compliance/risk-register.ts` — edit that file, then run `node --experimental-strip-types scripts/gen-risk-register.mjs`.
> **This register is a tracking tool. A complete register does not mean LeadFlow is legally compliant.** Nothing here is legal advice; items marked for legal review require a qualified lawyer.

## Messaging

### MSG-1 — Texting people without valid consent

- **Severity:** high · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** Unsolicited or automated texts can breach electronic-marketing and telemarketing rules (e.g. ePrivacy rules in the EU/UK, TCPA in the US), with per-message damages in some places. Carriers can also block the number.
- **3. Technical protection built:** SMS requires a recorded consent basis (texted first, web-form checkbox with wording/time/page/IP hash, or owner attestation). Database trigger refuses to record any SMS without consent. Append-only consent ledger. Automatic follow-ups only in Auto mode.
- **4. Policy / contract protection:** Terms make the business responsible for lawful consent and messaging; acceptable-use policy bans lists and marketing blasts.
- **5. Needs review by a qualified lawyer:** Whether 'they texted us first' and form consent cover AI replies AND automated follow-ups in each target market; required consent wording; whether follow-ups count as marketing; US A2P 10DLC and TCPA exposure.

### MSG-2 — Messaging after an opt-out

- **Severity:** high · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** Continuing to message after STOP is one of the clearest violations and complaint triggers.
- **3. Technical protection built:** STOP keywords and natural-language opt-outs, AI-detected opt-outs, owner 'do not contact'. Hashed suppression list survives lead deletion. DB trigger blocks SMS to opted-out/suppressed numbers. Re-opt-in only by the person (START).
- **4. Policy / contract protection:** Privacy Policy explains opt-out; Terms forbid circumventing controls.
- **5. Needs review by a qualified lawyer:** Retention period for suppression records; whether opt-out must cover all channels; required confirmation messages per market.

### MSG-3 — Spam, abuse and toll fraud through the platform

- **Severity:** medium · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** A malicious or careless customer could use LeadFlow to send spam, harassing or premium-rate traffic, creating liability and carrier sanctions.
- **3. Technical protection built:** Daily SMS caps per plan, per-lead AI caps (configurable), country allowlist, rate limits, duplicate suppression, bot-loop detection, kill switch.
- **4. Policy / contract protection:** Acceptable-use and suspension clauses.
- **5. Needs review by a qualified lawyer:** Platform liability for customers' messages; notice-and-suspension process.

## AI

### AI-1 — AI makes false statements or promises on a business's behalf

- **Severity:** high · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** Invented prices, availability, warranties or compliance claims could create misrepresentation or consumer-protection claims against the business — and possibly against LeadFlow.
- **3. Technical protection built:** Grounded prompt; deterministic guards block unknown prices, booking/refund/guarantee promises, compliance/certification/safety claims not in business info; Review mode default for new accounts; approval audit trail; per-lead and global off switches.
- **4. Policy / contract protection:** Terms: AI limitations, business responsible for approved/enabled messages, no reliance on scores.
- **5. Needs review by a qualified lawyer:** Liability allocation for AI output; whether disclaimers are enforceable against consumers (they aren't party to our Terms).

### AI-2 — AI disclosure and transparency

- **Severity:** medium · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Some jurisdictions require disclosing automated/bot communications (e.g. California's bot disclosure law; EU AI Act transparency duties for systems interacting with people).
- **3. Technical protection built:** First message always states it's an automated assistant (enforced in code); the AI never claims to be human.
- **4. Policy / contract protection:** Terms and Privacy Policy describe AI use.
- **5. Needs review by a qualified lawyer:** Exact disclosure requirements and wording per market; AI Act classification and timelines.

### AI-3 — Professional / safety advice

- **Severity:** medium · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** Advice about gas, electrical or structural safety could cause harm and liability.
- **3. Technical protection built:** Rules forbid professional and safety advice; guard blocks safety assurances ('it's safe'); danger keywords escalate to a human; emergency-services instruction.
- **4. Policy / contract protection:** Acceptable-use bans using LeadFlow for professional advice.
- **5. Needs review by a qualified lawyer:** Adequacy of these measures for trades with safety implications.

## Privacy

### PRIV-1 — Processor obligations to businesses (no DPA yet)

- **Severity:** high · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Under GDPR, processing personal data for a business requires a written data-processing agreement (Art. 28) with specific terms.
- **3. Technical protection built:** Tenant isolation, export, deletion, retention, sub-processor list, audit log support the obligations.
- **4. Policy / contract protection:** Terms reference a DPA, which still needs to be written.
- **5. Needs review by a qualified lawyer:** Draft the DPA; confirm controller/processor roles (including for scoring and consent records).

### PRIV-2 — Lead transparency (people don't know LeadFlow exists)

- **Severity:** medium · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Leads give data to the business, not to LeadFlow; they must be told how it's processed (including AI).
- **3. Technical protection built:** Consent wording in the form snippet; AI disclosure in the first message; Privacy Policy section for leads.
- **4. Policy / contract protection:** Terms require businesses to provide privacy information to their customers.
- **5. Needs review by a qualified lawyer:** What the business must tell leads; template privacy-notice wording for businesses.

### PRIV-3 — Sensitive data in conversations

- **Severity:** medium · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** People may volunteer health, financial or ID information; holding it raises the risk and obligations.
- **3. Technical protection built:** Card numbers and IBANs are redacted before storage; the AI never asks for sensitive data and tells people not to send it.
- **4. Policy / contract protection:** Acceptable-use bans collecting sensitive data.
- **5. Needs review by a qualified lawyer:** Whether further categories need redaction or special handling.

### PRIV-4 — International transfers

- **Severity:** medium · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Providers may process data outside the EEA/UK.
- **3. Technical protection built:** Supabase/Vercel regions are configurable (choose EU).
- **4. Policy / contract protection:** Privacy Policy discloses transfers.
- **5. Needs review by a qualified lawyer:** Transfer mechanisms per provider; transfer impact assessment.

## Data retention

### RET-1 — Keeping data longer than needed

- **Severity:** medium · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** Storage limitation: data must not be kept longer than necessary.
- **3. Technical protection built:** Per-business retention (default 1 year of inactivity) enforced by an automatic purge; lead and account deletion; notifications purged after 180 days; webhook keys after 30 days.
- **4. Policy / contract protection:** Privacy Policy states retention periods.
- **5. Needs review by a qualified lawyer:** Default periods; backup retention statement; suppression-list retention; statutory retention for billing.

## Security

### SEC-1 — Data breach or cross-tenant exposure

- **Severity:** high · **Status:** Technical controls in place — legal review outstanding
- **1. The risk / 2. Why it matters:** A breach triggers notification duties (72 hours under GDPR), liability and loss of trust.
- **3. Technical protection built:** RLS everywhere, least privilege, httpOnly/Secure cookies, rate limits, signed webhooks, 133 security tests including a red-team suite, backups with tested restore.
- **4. Policy / contract protection:** Incident response in RUNBOOK; breach-notification clause.
- **5. Needs review by a qualified lawyer:** Breach-notification procedure and contractual commitments.

### SEC-2 — No independent penetration test

- **Severity:** medium · **Status:** Open
- **1. The risk / 2. Why it matters:** Our own testing can't replace an independent assessment.
- **3. Technical protection built:** Automated security suite in CI; dependency audit.
- **4. Policy / contract protection:** —
- **5. Needs review by a qualified lawyer:** Whether customer contracts or insurers require a pen test.

## Payments

### PAY-1 — Subscription, refund and auto-renewal rules

- **Severity:** medium · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Auto-renewal, cancellation and price-change rules vary by market; mistakes cause chargebacks and complaints.
- **3. Technical protection built:** Stripe Checkout/Portal; cancel any time; account deletion cancels billing first; plan changes via verified webhooks only.
- **4. Policy / contract protection:** Terms sections 10–11.
- **5. Needs review by a qualified lawyer:** Refund policy; price-change notice; VAT/sales tax; B2B-only positioning.

## Third parties

### TP-1 — Unverified third-party terms

- **Severity:** medium · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** We depend on providers whose terms, data use and regions must be confirmed.
- **3. Technical protection built:** Sub-processor list derived from code; minimal data sent to each.
- **4. Policy / contract protection:** Privacy Policy and Terms reference the list.
- **5. Needs review by a qualified lawyer:** Review each provider's DPA and terms; record the outcome.

## Legal documents

### DOC-1 — Terms of Service are a draft

- **Severity:** high · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Unreviewed terms may be unenforceable or miss mandatory provisions.
- **3. Technical protection built:** Versioned acceptance records; re-acceptance flow when versions change.
- **4. Policy / contract protection:** Draft exists (docs/legal/TERMS_OF_SERVICE.md).
- **5. Needs review by a qualified lawyer:** Full review and localisation.

### DOC-2 — Privacy Policy is a draft

- **Severity:** high · **Status:** Needs legal review
- **1. The risk / 2. Why it matters:** Transparency obligations require an accurate, complete notice.
- **3. Technical protection built:** Policy written from the actual data flows.
- **4. Policy / contract protection:** Draft exists (docs/legal/PRIVACY_POLICY.md).
- **5. Needs review by a qualified lawyer:** Full review; legal bases; rights handling.

## Launch checklist

1. Terms of Service reviewed by a qualified lawyer
2. Privacy Policy reviewed by a qualified lawyer / privacy professional
3. Data-processing arrangements (DPA with customers; DPAs with providers) reviewed
4. Messaging requirements reviewed for each target market (consent, wording, registration, quiet hours)
5. AI risks reviewed (disclosure, liability, AI-specific regulation)
6. Security testing completed (npm run test:security passes on the release build)
7. Independent penetration / security test considered
8. Backup and recovery tested (scripts/backup-restore-drill.sh against staging)
9. Data deletion tested (lead, account, retention purge)
10. Tenant isolation tested
11. Payment and webhook security tested
12. Third-party data flows documented and each provider's terms verified
13. Appropriate business insurance considered (professional indemnity, cyber, public liability)
14. Age restrictions and account requirements reviewed (business users, 18+)
15. Customer support and complaint procedures established (incl. data-subject and opt-out requests)
