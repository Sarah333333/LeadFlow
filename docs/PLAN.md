# LeadFlow AI — Product & Technical Plan

## 1. Analysis of the idea

**The problem is real.** In home services, the first business to answer a lead usually gets the job.
Owners are on a roof or under a sink when the lead comes in, and they reply hours later or not at all.
"Speed to lead" plus consistent follow-up is the clearest ROI story you can sell to a tradesperson:
*"You paid €40 for that lead and never replied. We reply in 30 seconds."*

**The market is crowded.** GoHighLevel, Podium, Hatch, Housecall Pro / Jobber add-ons,
ServiceTitan, LeadTruffle and many agencies already sell versions of this. You will not win on features.
You can win on:

- **Price and simplicity:** set up in 10 minutes with no agency, no CRM migration, and no 40-tab settings page.
- **Trade-specific qualification:** the AI knows what a roofer needs to ask (leak size, roof type, urgency) out of the box.
- **Trust:** the AI never invents prices or promises, and the owner can take over in one tap.

## 2. Biggest risks and weaknesses

| # | Risk | Why it matters | Mitigation (built into the MVP) |
|---|------|----------------|------------------|
| 1 | **Getting leads into the system** | If owners have to type leads in by hand, they'll stop within a week. Manual entry is a demo feature, not a product. | Each business gets a **lead intake webhook**. Website forms, Zapier, Make, Facebook Lead Ads (via Zapier) and Typeform can post to it. Manual add stays for the demo. |
| 2 | **SMS cost vs. a $29 price** | US SMS costs about $0.01 per segment, but Ireland/UK is about €0.07–0.10. With 100 leads × ~8 messages, a Starter account in Ireland can cost more in SMS than it pays. | Plan limits live in one config file. **Recommendation:** in the EU, raise Starter to about $39 or cap messages per lead. Cap the follow-up count per plan. |
| 3 | **SMS compliance** | In the US, A2P 10DLC registration takes days to weeks and is mandatory, and TCPA fines are large. In the EU, GDPR and ePrivacy apply. | Reply only to leads that contacted the business. Honour STOP/UNSUBSCRIBE automatically. Avoid quiet hours. Register 10DLC early, before the first paying US customer. |
| 4 | **AI hallucination / liability** | One invented price or "we'll be there at 3pm" destroys trust. | The prompt is grounded only in business data. Output is structured JSON. A **server-side price guard** rejects replies with prices that aren't in the business's data. The AI hands off to a human when unsure. Keyword safety nets cover urgency and opt-outs. |
| 5 | **Owner doesn't look at dashboards** | Tradespeople live on their phone, not in a web app. | **Hot-lead alerts go to the owner's phone/email**, and the alert itself is the product. The dashboard is secondary. |
| 6 | **Proving ROI → churn** | If the owner can't see "LeadFlow made me €X", they cancel in month 3. | Won/lost tracking, job value per lead, and an estimated-revenue tile from day one. |
| 7 | **Phone calls** | Many home-service leads call rather than fill in forms. | Out of MVP scope. **Missed-call text-back** (Twilio) is the #1 feature for v2. |
| 8 | **Follow-up reliability** | Follow-ups that silently don't fire are worse than none. | Follow-ups are DB rows with explicit status. They are processed by an idempotent cron endpoint with atomic claiming, so a follow-up is never double-sent. |
| 9 | **Pricing gating hurts the core value** | As written, Starter has no automated follow-ups or notifications, but those *are* the product. | **Recommendation (implemented, editable):** every plan gets qualification, hot alerts and at least 1 follow-up. Plans differ by lead volume, follow-up depth, SMS alerts, custom AI instructions and seats. |

## 3. Improved MVP

**Added (small effort, large impact):**
1. **Lead intake webhook + copy-paste form snippet:** real leads flow in automatically.
2. **Test mode ("simulator"):** the owner (or you, in a sales demo) can play the lead and chat with the AI in the browser. No phone number setup is needed. This is how you'll sell the product.
3. **STOP / opt-out handling and quiet hours** for follow-ups.
4. **Price & promise guard** on every AI reply.
5. **Job value per lead** for revenue and ROI tracking.
6. **Free 14-day trial without a card.** This lowers friction for the first customers.

**Removed / deferred:** team members UI, advanced analytics, a native Facebook/Instagram integration
(use the webhook via Zapier), WhatsApp, calendar booking integrations (use the booking link),
missed-call text-back, email-channel conversations, a multi-business agency mode.

## 4. What we build first (in order)

1. Database schema + RLS (security first; everything depends on it)
2. Auth (sign up / log in / log out)
3. Onboarding wizard (the AI is useless without business info)
4. Leads: add manually + lead table
5. AI conversation engine + test-mode chat
6. Qualification + scoring + hot-lead detection
7. Lead detail page (summary, details, take over, pause, won/lost)
8. Notifications (in-app + SMS/email to owner)
9. Follow-up scheduler + cron endpoint
10. Dashboard stats
11. Twilio SMS (outbound + inbound webhook)
12. Lead intake webhook
13. Settings
14. Stripe subscriptions + plan limits
15. Landing + pricing page

## 5. Final tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15 (App Router) + TypeScript** | One codebase for UI, API routes and webhooks. Huge ecosystem. Deploys to Vercel in one click. |
| Styling | **Tailwind CSS v4** + small hand-built components | No component-library lock-in, and it's easy to keep the UI distinctive. |
| DB + Auth | **Supabase** (Postgres + Auth + Row Level Security) | Real Postgres. Auth is included. RLS enforces tenant isolation in the database itself, so a bug in our code can't leak one business's leads to another. |
| AI | **OpenAI** (`gpt-4.1-mini` by default, set via `OPENAI_MODEL`) with JSON-schema structured output | Cheap (fractions of a cent per turn), fast, and structured output gives reliable score/summary fields. The provider sits behind an interface so it can be swapped later. |
| SMS | **Twilio** | The most reliable SMS provider with the best docs. It also supports voice (missed-call text-back) later. |
| Payments | **Stripe Checkout + Customer Portal + webhooks** | No billing UI to build. Plan changes and cancellations are handled by Stripe. |
| Email alerts | **Resend** (optional) | One HTTP call, a generous free tier. In-app alerts still work without it. |
| Cron | `/api/cron/follow-ups`, triggered every minute by **Supabase pg_cron** or Vercel Cron | Both are free or cheap. The endpoint is idempotent, so the trigger doesn't matter. |
| Hosting | **Vercel** | Zero-config Next.js hosting. |

No stack changes from your preference. Everything you proposed is the right call for this product.

## 6. Database schema

See `supabase/migrations/` for the exact SQL. Tables:

- **businesses**: the tenant. Profile (name, description, services with price ranges, areas, hours,
  FAQs, contact, booking link, tone, timezone, average job value), AI settings (custom instructions,
  follow-up delays), notification settings, intake key, SMS number, and billing (plan, Stripe IDs, status, trial end).
- **business_members**: (business_id, user_id, role). All access control goes through this table,
  so adding team members later needs no schema change.
- **leads**: contact info, source, channel (`sms` | `test`), service, location, score (0–100),
  temperature (`hot` | `warm` | `cold`), status (`new` → `contacted` → `engaged` → `qualified` → `won` / `lost` / `unresponsive` / `opted_out`),
  AI summary, extracted details (JSON), `ai_paused`, `needs_attention`, follow-up step, next follow-up time,
  last-message preview, and job value.
- **messages**: direction, sender (`lead` / `ai` / `owner` / `system`), channel, body, delivery status, provider ID.
- **follow_ups**: one row per scheduled nudge, with `pending` / `processing` / `sent` / `cancelled` / `skipped`. This is the follow-up history.
- **lead_events**: an activity timeline (created, score changed, AI paused, owner took over, marked won…).
- **notifications**: in-app alerts (hot lead, needs attention, limit reached).

## 7. Application architecture

```
src/
  app/
    (marketing)/          landing page, pricing
    (auth)/               login, signup
    onboarding/           setup wizard
    (app)/                authenticated shell (sidebar)
      dashboard/          stats + recent conversations + follow-up status
      leads/              lead table, new lead, lead detail
      notifications/
      settings/           business, ai, follow-ups, notifications, intake, billing
    api/
      leads/intake/[key]  public lead webhook (Zapier, forms)
      webhooks/twilio     inbound SMS
      webhooks/stripe     subscription sync
      cron/follow-ups     due follow-up processor
  lib/
    supabase/             browser, server (user session, RLS), admin (service role)
    engine/               THE CORE: startConversation, handleInbound, processDueFollowUps
    ai/                   prompt builder, OpenAI provider, demo provider, guards
    messaging/            channel interface → twilio | test
    notify/               in-app + SMS + email alerts
    billing/              plans & entitlements (one file), stripe helpers
```

**Key design decisions**

- **All lead logic lives in `lib/engine`, not in API routes or pages.** Manual add, the intake webhook, Twilio and cron all
  call the same functions. Adding WhatsApp or email later means adding one channel adapter.
- **There are two Supabase clients.** The UI uses the user's session, so RLS applies. Webhooks and cron use the service role,
  because there's no user session, and every query there is explicitly scoped by `business_id`.
- **Webhooks reply fast and work later.** Twilio gets an instant 200 response. AI generation runs in `after()` so a slow AI call never
  causes Twilio retries or duplicate replies.
- **Demo AI provider.** With no `OPENAI_API_KEY`, a rule-based provider runs so the app is fully testable and demoable.
  It's labelled clearly in the UI.

## 8. Page structure

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/pricing` | Plans |
| `/signup`, `/login` | Auth |
| `/onboarding` | 4-step setup: Business → Services & prices → Hours, areas & FAQs → AI tone & contact |
| `/dashboard` | KPI tiles, recent conversations, upcoming follow-ups |
| `/leads` | Filterable lead table |
| `/leads/new` | Add lead manually (SMS or test mode) |
| `/leads/[id]` | Conversation, AI summary, details, follow-up history, take over / pause / won / lost |
| `/notifications` | Alert inbox |
| `/settings` | Business profile |
| `/settings/ai` | Tone, custom instructions (Pro), AI on by default |
| `/settings/follow-ups` | Follow-up schedule |
| `/settings/notifications` | Alert phone / email |
| `/settings/intake` | Webhook URL + form snippet |
| `/settings/billing` | Plan, usage, upgrade / manage |
