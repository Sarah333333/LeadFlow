# Third-party services — DRAFT

> **DRAFT.** This list describes, from the code, what each external service receives and why. It does **not** state that any provider is compliant with GDPR, CCPA or any other law: that must be checked against each provider's **current** documentation and contracts before launch, and the result recorded in the "Verify" items below. [REVIEW]
> Last reviewed against the code: 2026-11-25

## Supabase (database and authentication)

- **Data:** all stored data — business accounts, login emails and password hashes (managed by Supabase Auth), business profiles, leads, conversations, consent records, audit log, backups.
- **Why:** primary database and user authentication.
- **Controls:** Row Level Security on every table; the browser has no direct database access; service-role key server-only; daily backups with a tested restore drill.
- **Verify:** project region (choose EU for EU customers); encryption at rest; backup and PITR retention; DPA and sub-processor list; transfer mechanism.

## Vercel (hosting) — or your chosen host

- **Data:** all requests pass through it, including page content, form submissions and webhook payloads; runtime logs (we log redacted JSON — no message contents, keys or passwords; phones and emails masked).
- **Why:** runs the application.
- **Verify:** function region; log retention; DPA; transfer mechanism.

## OpenAI (AI replies)

- **Data:** the business's profile (services, prices, FAQs, owner instructions — capped at 12,000 characters), the lead's name, enquiry and known details, and up to the last 30 messages of the conversation. Card numbers and IBANs are removed before storage, so they are never sent.
- **Why:** generate the assistant's reply, score and summary.
- **Controls:** requests are sent with `store: false`; no tools or database access are given to the model; LeadFlow does not use conversations for training.
- **Verify:** current API data-usage, retention and training terms; availability of zero-data-retention; data residency options; DPA; transfer mechanism.

## Twilio (text messages)

- **Data:** recipient and sender phone numbers, message text, delivery status; inbound messages from leads.
- **Why:** send and receive SMS.
- **Controls:** signed webhooks; consent required before texting; STOP handling; country allowlist; daily caps.
- **Verify:** message-log retention settings; A2P 10DLC (US) and sender-registration rules in each target country; DPA; transfer mechanism; acceptable-use policy alignment.

## Stripe (payments)

- **Data:** business email, business name, LeadFlow business ID, subscription and payment status. Card details are entered on Stripe's hosted pages and never reach LeadFlow.
- **Why:** subscriptions and invoicing.
- **Verify:** DPA; role (Stripe may act as an independent controller for some processing); transfer mechanism.

## Resend (email alerts) — optional

- **Data:** the business's alert email address; alert text, which can include a lead's name and an AI summary of the enquiry.
- **Why:** email hot-lead and attention alerts to the business.
- **Verify:** DPA; region; log retention. Consider sending less detail in emails (link only).

## Zapier, Make, website builders (optional, chosen by the business)

- **Data:** whatever the business configures them to send to LeadFlow's intake webhook (lead name, contact details, message, consent fields).
- **Why:** bring leads in from other tools.
- **Note:** these are the business's own processors, not LeadFlow's. The business is responsible for configuring them lawfully, including consent wording.

## Analytics providers

- **None.** LeadFlow currently uses no analytics, advertising or tracking services. Adding one requires updating this list, the Privacy Policy and the cookie notice.
