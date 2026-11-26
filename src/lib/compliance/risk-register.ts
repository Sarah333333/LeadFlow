// Internal legal & operational risk register (shown at /internal/risk to LeadFlow operators).
// IMPORTANT: a completed checklist does NOT mean LeadFlow is compliant. Status values deliberately have
// no "compliant" state — the best possible status is "reviewed by counsel", with who and when.

export type RiskArea = "Privacy" | "Security" | "Messaging" | "AI" | "Payments" | "Third parties" | "Data retention" | "Legal documents";
export type RiskStatus =
  | "open"                    // known, not yet addressed
  | "technical_controls"      // product controls built; legal review still outstanding
  | "needs_legal_review"      // needs a lawyer/privacy professional before launch
  | "reviewed_by_counsel";    // reviewed — record reviewer and date

export interface Risk {
  id: string; area: RiskArea; title: string; severity: "high" | "medium" | "low";
  why: string; technical: string; policy: string; lawyer: string;
  status: RiskStatus; reviewedBy?: string; reviewedOn?: string;
}

export const RISKS: Risk[] = [
  { id: "MSG-1", area: "Messaging", severity: "high", title: "Texting people without valid consent",
    why: "Unsolicited or automated texts can breach electronic-marketing and telemarketing rules (e.g. ePrivacy rules in the EU/UK, TCPA in the US), with per-message damages in some places. Carriers can also block the number.",
    technical: "SMS requires a recorded consent basis (texted first, web-form checkbox with wording/time/page/IP hash, or owner attestation). Database trigger refuses to record any SMS without consent. Append-only consent ledger. Automatic follow-ups only in Auto mode.",
    policy: "Terms make the business responsible for lawful consent and messaging; acceptable-use policy bans lists and marketing blasts.",
    lawyer: "Whether 'they texted us first' and form consent cover AI replies AND automated follow-ups in each target market; required consent wording; whether follow-ups count as marketing; US A2P 10DLC and TCPA exposure.",
    status: "technical_controls" },
  { id: "MSG-2", area: "Messaging", severity: "high", title: "Messaging after an opt-out",
    why: "Continuing to message after STOP is one of the clearest violations and complaint triggers.",
    technical: "STOP keywords and natural-language opt-outs, AI-detected opt-outs, owner 'do not contact'. Hashed suppression list survives lead deletion. DB trigger blocks SMS to opted-out/suppressed numbers. Re-opt-in only by the person (START).",
    policy: "Privacy Policy explains opt-out; Terms forbid circumventing controls.",
    lawyer: "Retention period for suppression records; whether opt-out must cover all channels; required confirmation messages per market.",
    status: "technical_controls" },
  { id: "MSG-3", area: "Messaging", severity: "medium", title: "Spam, abuse and toll fraud through the platform",
    why: "A malicious or careless customer could use LeadFlow to send spam, harassing or premium-rate traffic, creating liability and carrier sanctions.",
    technical: "Daily SMS caps per plan, per-lead AI caps (configurable), country allowlist, rate limits, duplicate suppression, bot-loop detection, kill switch.",
    policy: "Acceptable-use and suspension clauses.",
    lawyer: "Platform liability for customers' messages; notice-and-suspension process.", status: "technical_controls" },
  { id: "AI-1", area: "AI", severity: "high", title: "AI makes false statements or promises on a business's behalf",
    why: "Invented prices, availability, warranties or compliance claims could create misrepresentation or consumer-protection claims against the business — and possibly against LeadFlow.",
    technical: "Grounded prompt; deterministic guards block unknown prices, booking/refund/guarantee promises, compliance/certification/safety claims not in business info; Review mode default for new accounts; approval audit trail; per-lead and global off switches.",
    policy: "Terms: AI limitations, business responsible for approved/enabled messages, no reliance on scores.",
    lawyer: "Liability allocation for AI output; whether disclaimers are enforceable against consumers (they aren't party to our Terms).",
    status: "technical_controls" },
  { id: "AI-2", area: "AI", severity: "medium", title: "AI disclosure and transparency",
    why: "Some jurisdictions require disclosing automated/bot communications (e.g. California's bot disclosure law; EU AI Act transparency duties for systems interacting with people).",
    technical: "First message always states it's an automated assistant (enforced in code); the AI never claims to be human.",
    policy: "Terms and Privacy Policy describe AI use.", lawyer: "Exact disclosure requirements and wording per market; AI Act classification and timelines.",
    status: "needs_legal_review" },
  { id: "AI-3", area: "AI", severity: "medium", title: "Professional / safety advice",
    why: "Advice about gas, electrical or structural safety could cause harm and liability.",
    technical: "Rules forbid professional and safety advice; guard blocks safety assurances ('it's safe'); danger keywords escalate to a human; emergency-services instruction.",
    policy: "Acceptable-use bans using LeadFlow for professional advice.", lawyer: "Adequacy of these measures for trades with safety implications.",
    status: "technical_controls" },
  { id: "PRIV-1", area: "Privacy", severity: "high", title: "Processor obligations to businesses (no DPA yet)",
    why: "Under GDPR, processing personal data for a business requires a written data-processing agreement (Art. 28) with specific terms.",
    technical: "Tenant isolation, export, deletion, retention, sub-processor list, audit log support the obligations.",
    policy: "Terms reference a DPA, which still needs to be written.", lawyer: "Draft the DPA; confirm controller/processor roles (including for scoring and consent records).",
    status: "needs_legal_review" },
  { id: "PRIV-2", area: "Privacy", severity: "medium", title: "Lead transparency (people don't know LeadFlow exists)",
    why: "Leads give data to the business, not to LeadFlow; they must be told how it's processed (including AI).",
    technical: "Consent wording in the form snippet; AI disclosure in the first message; Privacy Policy section for leads.",
    policy: "Terms require businesses to provide privacy information to their customers.", lawyer: "What the business must tell leads; template privacy-notice wording for businesses.",
    status: "needs_legal_review" },
  { id: "PRIV-3", area: "Privacy", severity: "medium", title: "Sensitive data in conversations",
    why: "People may volunteer health, financial or ID information; holding it raises the risk and obligations.",
    technical: "Card numbers and IBANs are redacted before storage; the AI never asks for sensitive data and tells people not to send it.",
    policy: "Acceptable-use bans collecting sensitive data.", lawyer: "Whether further categories need redaction or special handling.",
    status: "technical_controls" },
  { id: "PRIV-4", area: "Privacy", severity: "medium", title: "International transfers",
    why: "Providers may process data outside the EEA/UK.",
    technical: "Supabase/Vercel regions are configurable (choose EU).", policy: "Privacy Policy discloses transfers.",
    lawyer: "Transfer mechanisms per provider; transfer impact assessment.", status: "needs_legal_review" },
  { id: "RET-1", area: "Data retention", severity: "medium", title: "Keeping data longer than needed",
    why: "Storage limitation: data must not be kept longer than necessary.",
    technical: "Per-business retention (default 1 year of inactivity) enforced by an automatic purge; lead and account deletion; notifications purged after 180 days; webhook keys after 30 days.",
    policy: "Privacy Policy states retention periods.", lawyer: "Default periods; backup retention statement; suppression-list retention; statutory retention for billing.",
    status: "technical_controls" },
  { id: "SEC-1", area: "Security", severity: "high", title: "Data breach or cross-tenant exposure",
    why: "A breach triggers notification duties (72 hours under GDPR), liability and loss of trust.",
    technical: "RLS everywhere, least privilege, httpOnly/Secure cookies, rate limits, signed webhooks, 133 security tests including a red-team suite, backups with tested restore.",
    policy: "Incident response in RUNBOOK; breach-notification clause.", lawyer: "Breach-notification procedure and contractual commitments.",
    status: "technical_controls" },
  { id: "SEC-2", area: "Security", severity: "medium", title: "No independent penetration test",
    why: "Our own testing can't replace an independent assessment.", technical: "Automated security suite in CI; dependency audit.",
    policy: "—", lawyer: "Whether customer contracts or insurers require a pen test.", status: "open" },
  { id: "PAY-1", area: "Payments", severity: "medium", title: "Subscription, refund and auto-renewal rules",
    why: "Auto-renewal, cancellation and price-change rules vary by market; mistakes cause chargebacks and complaints.",
    technical: "Stripe Checkout/Portal; cancel any time; account deletion cancels billing first; plan changes via verified webhooks only.",
    policy: "Terms sections 10–11.", lawyer: "Refund policy; price-change notice; VAT/sales tax; B2B-only positioning.",
    status: "needs_legal_review" },
  { id: "TP-1", area: "Third parties", severity: "medium", title: "Unverified third-party terms",
    why: "We depend on providers whose terms, data use and regions must be confirmed.",
    technical: "Sub-processor list derived from code; minimal data sent to each.",
    policy: "Privacy Policy and Terms reference the list.", lawyer: "Review each provider's DPA and terms; record the outcome.",
    status: "needs_legal_review" },
  { id: "DOC-1", area: "Legal documents", severity: "high", title: "Terms of Service are a draft",
    why: "Unreviewed terms may be unenforceable or miss mandatory provisions.", technical: "Versioned acceptance records; re-acceptance flow when versions change.",
    policy: "Draft exists (docs/legal/TERMS_OF_SERVICE.md).", lawyer: "Full review and localisation.", status: "needs_legal_review" },
  { id: "DOC-2", area: "Legal documents", severity: "high", title: "Privacy Policy is a draft",
    why: "Transparency obligations require an accurate, complete notice.", technical: "Policy written from the actual data flows.",
    policy: "Draft exists (docs/legal/PRIVACY_POLICY.md).", lawyer: "Full review; legal bases; rights handling.", status: "needs_legal_review" },
];

export const STATUS_LABEL: Record<RiskStatus, string> = {
  open: "Open", technical_controls: "Technical controls in place — legal review outstanding",
  needs_legal_review: "Needs legal review", reviewed_by_counsel: "Reviewed by counsel",
};

export const LAUNCH_CHECKLIST = [
  "Terms of Service reviewed by a qualified lawyer",
  "Privacy Policy reviewed by a qualified lawyer / privacy professional",
  "Data-processing arrangements (DPA with customers; DPAs with providers) reviewed",
  "Messaging requirements reviewed for each target market (consent, wording, registration, quiet hours)",
  "AI risks reviewed (disclosure, liability, AI-specific regulation)",
  "Security testing completed (npm run test:security passes on the release build)",
  "Independent penetration / security test considered",
  "Backup and recovery tested (scripts/backup-restore-drill.sh against staging)",
  "Data deletion tested (lead, account, retention purge)",
  "Tenant isolation tested",
  "Payment and webhook security tested",
  "Third-party data flows documented and each provider's terms verified",
  "Appropriate business insurance considered (professional indemnity, cyber, public liability)",
  "Age restrictions and account requirements reviewed (business users, 18+)",
  "Customer support and complaint procedures established (incl. data-subject and opt-out requests)",
];
