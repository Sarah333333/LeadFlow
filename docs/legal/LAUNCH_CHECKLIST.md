# Launch checklist — legal & operational

> Fill in **evidence** (who, when, link/document) for every item. A fully ticked list means these steps were done — **not** that LeadFlow is legally compliant.

| # | Item | Owner | Done on | Evidence |
|---|---|---|---|---|
| 1 | Terms of Service reviewed by a qualified lawyer | | | |
| 2 | Privacy Policy reviewed by a qualified lawyer / privacy professional | | | |
| 3 | Data-processing arrangements reviewed (customer DPA drafted; each provider's DPA/terms checked — see SUBPROCESSORS.md "Verify") | | | |
| 4 | Messaging requirements reviewed for each target market (consent basis & wording, automated follow-ups, quiet hours, sender registration e.g. US A2P 10DLC) | | | |
| 5 | AI risks reviewed (disclosure wording, liability for AI output, AI-specific regulation) | | | |
| 6 | Security testing completed: `npm run lint && npm run typecheck && npm test && npm run test:security` pass on the release build | | | |
| 7 | Independent penetration / security test considered (decision recorded) | | | |
| 8 | Backup & recovery tested: `scripts/backup-restore-drill.sh` against staging; Supabase backups/PITR enabled | | | |
| 9 | Data deletion tested: delete lead, delete account (billing cancelled first), retention purge | | | |
| 10 | Tenant isolation tested (`tests/security/tenant-isolation.test.ts`, `app-security.test.ts`, `redteam.test.ts`) | | | |
| 11 | Payment & webhook security tested (`webhooks.test.ts`; Stripe dashboard resend test on staging) | | | |
| 12 | Third-party data flows documented (`SUBPROCESSORS.md`) and verified against each provider's current documentation | | | |
| 13 | Appropriate business insurance considered (professional indemnity / E&O, cyber, public liability) | | | |
| 14 | Age restrictions & account requirements reviewed (18+, business use only, B2B positioning) | | | |
| 15 | Customer support & complaint procedures established (support contact, opt-out and data-subject request handling, response times, escalation) | | | |
