# Privacy Policy — DRAFT

> **DRAFT — NOT LEGAL ADVICE — NOT YET IN FORCE.** This draft describes how the LeadFlow product actually handles data. It must be reviewed by a qualified lawyer or privacy professional before publication. Items marked [REVIEW] need specific input. We do not claim certification or compliance with any specific law or standard.
> Version: 2026-11-draft-1 · Last updated: [date of publication]

## 1. Who we are

[LEGAL ENTITY NAME], [ADDRESS] ("LeadFlow", "we") provides lead follow-up software to businesses. Contact: [PRIVACY CONTACT EMAIL]. [REVIEW: whether a Data Protection Officer or EU/UK representative is required]

## 2. Two different roles

- **Business customers' account data** (the people who sign up and use LeadFlow): we decide how and why this is used, so we act as the **controller**.
- **Our customers' customers** (people who contact a business that uses LeadFlow — "leads"): the **business** decides why their data is processed and is the **controller**; LeadFlow processes it **on the business's behalf** as a **processor**, under a data-processing agreement. If you are a lead and want to exercise your rights, please contact the business you enquired with; we will help them respond. [REVIEW: role analysis; DPA]

## 3. What we collect

**From business users:** name and email address, password (handled by our authentication provider; we never see or store it in plain text), business profile information you enter (services, prices, areas, opening hours, FAQs, contact details, booking link, tone, instructions), alert phone number and email, subscription and billing status (card details are handled by our payment provider and never reach our servers), records of terms you accepted (date, version, a one-way hash of your IP address, browser type), and an activity log of important account actions.

**About leads, on behalf of businesses:** name, phone number, email address (if provided), the service they asked about, location they mention, the content of their messages and the replies sent to them, their messaging consent and opt-out history (including the wording they agreed to, the time, the page, and a one-way hash of their IP address when a web form is used), and automatically generated information: a lead score, temperature, summary and extracted details.

**We try not to collect sensitive data.** The assistant is instructed not to ask for payment card numbers, bank details, passwords, ID numbers or health information. Card numbers and bank account numbers (IBANs) that people type into messages are automatically removed before storage. Businesses must not use LeadFlow to collect such data.

**Technical data:** security logs (for example failed logins, rate-limit events) with IP addresses, phone numbers and emails masked or hashed where possible. We do not log passwords, API keys or message contents.

## 4. Why we use it (purposes and legal bases)

We use data to: provide the Service (accounts, conversations, AI replies, messaging, alerts); bill subscriptions; keep the Service secure and prevent abuse (rate limits, fraud and spam prevention, security logs); demonstrate messaging consent and honour opt-outs; communicate with business users about their account; and comply with legal obligations. [REVIEW: map each purpose to its legal basis — e.g. performance of contract, legitimate interests, legal obligation, consent — and list them here]

We do **not** sell personal data, use it for advertising, or use conversations to train AI models.

## 5. AI processing

When the assistant replies, we send the following to our AI provider: the business's profile information (services, prices, FAQs, instructions), the lead's name, enquiry and recent conversation (up to the last 30 messages). We ask the provider not to store these requests for its own purposes (we send `store: false`), and we do not use them for training. The assistant produces a suggested reply, a score and a summary; in Review mode a person approves every message before it is sent. Lead scoring is used to prioritise follow-up by the business and does not produce legal or similarly significant effects on individuals. [REVIEW: automated decision-making analysis; AI-regulation transparency duties; verify the provider's current data-usage and retention terms]

## 6. Where data is stored and who processes it

Data is stored with our database and hosting providers and processed by the third parties listed on our [Third-party services page](/legal/subprocessors), each only for the purpose described there. Some providers may process data outside your country, including outside the EEA/UK. Where this happens, we will rely on an appropriate transfer mechanism. [REVIEW: confirm regions selected and transfer mechanisms for each provider]

## 7. Analytics and cookies

LeadFlow currently uses **no analytics or advertising trackers**. We use only strictly necessary cookies: an authentication session cookie (httpOnly, secure) that keeps you logged in, and short-lived cookies used during login and email confirmation. If we add analytics in future we will update this policy and, where required, ask for consent first. [REVIEW: cookie notice requirements]

## 8. How long we keep data

- **Lead conversations:** each business chooses a retention period (90 days to 3 years of inactivity, or until deleted). After that period they are deleted automatically.
- **Opt-out records:** kept in pseudonymised form (a one-way hash of the phone number) for as long as the business account exists, so that people who opted out are not messaged again. [REVIEW: retention justification]
- **Business account data:** for as long as the account exists; deleted when the account is deleted, except where we must keep limited records (for example billing records) by law. [REVIEW: statutory retention periods]
- **Backups:** deleted data may persist in encrypted backups for up to [X] days. [REVIEW: confirm with database provider settings]
- **Security logs:** [X] days. [REVIEW]

## 9. Deletion and export

Businesses can delete an individual lead and its conversation, export all customer data or a single lead's data, and delete their whole account at any time from the dashboard. These tools help businesses respond to requests from their customers.

## 10. Your rights

Depending on where you live, you may have rights to access, correct, delete, restrict or object to processing of your personal data, to data portability, and to withdraw consent. You can also stop text messages at any time by replying STOP. To exercise your rights, contact [PRIVACY CONTACT EMAIL] (business users) or the business you contacted (leads). You may also complain to your data-protection authority (in Ireland, the Data Protection Commission). [REVIEW: jurisdiction-specific rights, e.g. US state laws; response timelines; identity verification]

## 11. Security

We use encryption in transit (HTTPS/TLS), strict separation between businesses' data enforced in the database, role-based access, rate limiting, signed webhooks, monitoring of security events, and regular backups with tested restore procedures. Data at rest is encrypted by our infrastructure providers according to their documentation [REVIEW: verify and describe]. No system is perfectly secure; we will notify affected customers and authorities of personal-data breaches where the law requires. [REVIEW: breach-notification obligations]

## 12. Children

LeadFlow is for businesses and is not directed at children. Business users must be 18 or over.

## 13. Changes

We will post changes here and notify business users of material changes in advance.

## 14. Contact

[LEGAL ENTITY NAME] · [ADDRESS] · [PRIVACY CONTACT EMAIL]
