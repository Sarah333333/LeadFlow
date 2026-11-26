# LeadFlow AI

AI lead follow-up for home-service businesses. New enquiries get a personal reply in seconds. The assistant asks qualifying questions, scores each lead hot, warm or cold, follows up when a lead goes quiet, and alerts the owner when someone is ready to book. The owner can take over at any time.

- **Product & architecture plan:** [`docs/PLAN.md`](docs/PLAN.md)
- **Deploying to production:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- **Security, privacy & reliability:** [`docs/SECURITY.md`](docs/SECURITY.md) (controls, tests, remaining risks)
- **Operations (backups, restore, incidents, key rotation):** [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- **Legal drafts & risk register (lawyer review required):** [`docs/legal/`](docs/legal/README.md); internal dashboard at `/internal/risk` (set `ADMIN_EMAILS`)

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, Row Level Security) · OpenAI · Twilio · Stripe · Resend

## Run it locally

Requirements: Node 20+ and Docker (for the local Supabase stack).

```bash
npm install
```

```bash
npx supabase start
```

```bash
cp .env.example .env.local
```

Fill `.env.local` with the URL, anon key and service-role key printed by `supabase start`, and set `CRON_SECRET` to any string. Then:

```bash
npm run dev
```

Open http://localhost:3000, sign up, complete onboarding and add a **test-mode lead**. In test mode you play the customer to see how the assistant responds. No API keys are needed: without `OPENAI_API_KEY` a rule-based demo assistant runs, and it's labelled in the UI.

To trigger due follow-ups locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/follow-ups
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm test` | Unit tests: AI guards, prompt-injection and leak detection, validation, redaction, quiet hours |
| `npm run test:security` | 183 attack, reliability and compliance-control tests, including a red-team suite against a production build (tenant isolation, IDOR, CSRF, XSS, webhooks, rate limits, prompt injection, AI failures, duplicates) |
| `bash scripts/backup-restore-drill.sh` | Dump the database, restore it to a scratch DB, and verify data and RLS |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npx supabase db reset` | Re-create the local DB from `supabase/migrations` |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after a schema change |

## Where things live

```
src/lib/engine/       conversation engine: create lead, inbound, AI turn, follow-ups, takeover
src/lib/ai/           prompt (grounded in business data), OpenAI + demo providers, safety guards
src/lib/messaging/    channel adapters (Twilio SMS, test mode)
src/lib/notify/       owner alerts (in-app, email, SMS)
src/lib/billing/      plans & entitlements (plans.ts is the single source of truth), Stripe
src/app/(app)/        dashboard, leads, lead detail, alerts, settings
src/app/api/          lead intake webhook, Twilio + Stripe webhooks, follow-up cron
supabase/migrations/  schema + RLS policies
```

## MVP status

### ✅ Finished, and tested end to end against a real local Supabase

- [x] **Auth:** sign up, log in, log out, protected routes, email-confirm callback
- [x] **Onboarding:** 4 steps with trade presets (services and FAQ questions), saved per step
- [x] **Multi-tenant security:** RLS on every table, and billing columns that only the server can change (verified with SQL tests)
- [x] **Leads:** add manually (SMS or test mode), filterable and searchable table, mobile card list
- [x] **AI conversation:** instant first reply, grounded answers from business info, one question per message
- [x] **Safety guards:** blocks invented prices, unauthorised promises (bookings, guarantees, refunds) and over-long replies; escalates safety issues and complaints
- [x] **Qualification & scoring:** 0–100 score, hot/warm/cold, AI summary, extracted details; urgency phrases always force HOT
- [x] **Lead page:** conversation, score, summary, details, contact, follow-up history, activity log
- [x] **Owner controls:** take over, pause/resume AI (resume answers any unanswered message), mark won with job value, mark lost, reopen
- [x] **Follow-ups:** per-business schedule, quiet hours, plan-limited step count, atomic cron processing, cancelled when the lead replies, *unresponsive* status after the last step
- [x] **Notifications:** in-app alerts inbox, unread badge, hot-lead and needs-you alerts by email (Resend) and SMS (Twilio)
- [x] **Dashboard:** total/new/hot/warm/cold, conversion rate, response rate, estimated revenue and hot pipeline, average first-reply time, recent conversations, follow-up status, needs-you list
- [x] **SMS (Twilio):** signed inbound webhook, routing by number, new texters become leads, STOP opt-out, delivery receipts, failed sends flagged to the owner
- [x] **Lead intake webhook:** JSON or HTML form, flexible field names (Zapier/Make/Facebook Lead Ads), honeypot spam trap, redirect support
- [x] **Settings:** business profile, assistant (tone, booking link, custom instructions on Pro), follow-ups, alerts, lead sources, billing
- [x] **Stripe:** Checkout, Customer Portal, signed webhook syncing plan and status, plan limits enforced (trial, lead limit, inactive subscription)
- [x] **Marketing:** landing page and pricing page
- [x] **Tests:** 70 unit tests, 183 automated security, red-team, reliability and compliance-control tests, and browser end-to-end runs of every flow above
- [x] **Security hardening:** least-privilege RLS, webhook idempotency, rate limits and AI cost caps, prompt-injection defences, safe AI failure handling, redacted logging, security headers, and a backup/restore drill (see `docs/SECURITY.md`)

### ⚠️ Built, but needs your accounts to test live

- [ ] **OpenAI:** the real model has not been run yet (no key here). Add `OPENAI_API_KEY` and run the "John" scenario in test mode.
- [ ] **Twilio:** signatures and routing are tested; real delivery needs an account, a number and A2P 10DLC registration (US).
- [ ] **Stripe:** webhook handling is tested with signed events; create the 3 products/prices and run one real test-mode checkout.
- [ ] **Resend:** verify your sending domain.

### 🔜 Next to build (in priority order)

1. **Missed-call text-back** (Twilio Voice): the #1 lead source for trades
2. **Admin tool to assign a dedicated SMS number** per business (today it's set in the DB)
3. **Edit lead details** and add notes manually
4. **Team members UI** (the `business_members` table already supports it) for the Pro plan
5. **Native Facebook Lead Ads integration** (Zapier works today)
6. **Weekly email digest** to owners showing ROI ("LeadFlow replied to 23 leads, 4 won, €2,600")
7. **WhatsApp and email** conversation channels
8. **Real-time updates** with Supabase Realtime (the lead page polls every 8 seconds today)
9. **Error monitoring** (Sentry) and an AI conversation quality review screen
