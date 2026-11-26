# Legal & compliance documents (DRAFTS)

Nothing in this folder is legal advice, and LeadFlow does not claim to be "compliant" with any law because of it.
These documents describe what the product does and list exactly what a qualified lawyer must review before launch.

| File | What it is | Status |
|---|---|---|
| `TERMS_OF_SERVICE.md` | Draft Terms (rendered at `/terms`) | DRAFT — needs lawyer |
| `PRIVACY_POLICY.md` | Draft Privacy Policy (rendered at `/privacy`) | DRAFT — needs lawyer/privacy professional |
| `SUBPROCESSORS.md` | Third-party services and the data each receives (rendered at `/legal/subprocessors`) | DRAFT — provider terms to verify |
| `LEGAL_RISK_REGISTER.md` | Every identified risk: why it matters, technical protection, policy protection, what needs a lawyer (generated) | Living document |
| `LAUNCH_CHECKLIST.md` | Pre-launch checklist with evidence columns | To complete |

When a lawyer approves a document: update its text, bump its version in `src/lib/compliance/legal.ts`
(users will be asked to accept the new version), set `LEGAL_DOCS_ARE_DRAFTS = false` only when **both** Terms and
Privacy Policy are approved, and record the reviewer and date in `src/lib/compliance/risk-register.ts`.
