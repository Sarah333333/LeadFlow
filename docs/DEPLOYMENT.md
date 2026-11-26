# Deploying LeadFlow AI

Plan on about an hour. Do the steps in order.

## 1. Supabase (database + auth)

1. Create a project at supabase.com (pick the EU region for Irish/UK customers, for GDPR).
2. Link the project and push the schema:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

```bash
npx supabase db push
```

3. Under **Authentication → URL configuration**, set the Site URL to your app URL and add `https://YOUR-APP/auth/callback` to the redirect URLs.
4. Under **Authentication → Providers → Email**, keep "Confirm email" **on**. Under **Authentication → Policies / Security**, set:
   - Minimum password length **10**, and turn on **leaked password protection**
   - **CAPTCHA** (Cloudflare Turnstile) for sign-up and sign-in
   - Review the default **auth rate limits**
   - JWT expiry 3600s, with refresh-token rotation on (the default)
   - Plan to enable **TOTP MFA** for owners
5. Copy the project URL, the anon key and the service-role key.

## 2. Vercel (hosting)

1. Import the repository into Vercel.
2. Add every variable from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to your production URL.
3. Deploy.

## 3. Follow-up cron (every minute)

**Option A (free): Supabase pg_cron.** Edit the URL and secret in `supabase/cron.sql`, then run it in the Supabase SQL editor.

**Option B: Vercel Cron.** This needs the Vercel Pro plan, because the Hobby plan only allows daily crons. Add a `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/follow-ups", "schedule": "* * * * *" }] }
```

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.

## 4. OpenAI

Create an API key and set `OPENAI_API_KEY`. `OPENAI_MODEL` defaults to `gpt-4.1-mini`, which is fast and costs a fraction of a cent per message. Any model that supports JSON-schema structured outputs works.

## 5. Twilio (SMS)

1. Buy a number in the country you serve (for example an Irish mobile number).
2. **US only:** register for A2P 10DLC (brand + campaign) before sending. It can take 1–3 weeks, so start early.
3. Under the number's **Messaging → A message comes in** setting, choose Webhook, `POST https://YOUR-APP/api/webhooks/twilio`.
4. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER`.
5. For a dedicated number per business, set `businesses.sms_number` (E.164) for that business. Inbound texts are routed by the number they were sent to.

`NEXT_PUBLIC_APP_URL` must exactly match the public URL Twilio calls, because it's used to verify Twilio's signature.

## 6. Stripe (subscriptions)

1. Create 3 products with monthly prices: Starter $29, Growth $59, Pro $99. Put the price IDs in `STRIPE_PRICE_*`.
2. Create a webhook endpoint at `https://YOUR-APP/api/webhooks/stripe` with these events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Under **Settings → Billing → Customer portal**, enable plan switching between the 3 prices, plus cancellation.
4. To test locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 7. Resend (owner email alerts)

Verify your domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.

## Production security gate: do all of these before every production release

1. **Run the full test suite.** Run `npm run lint`, `npm run typecheck`, `npm test`, then `npm run test:security` (it builds the production bundle).
2. **Security review.** Check the diff against the questions at the top of `docs/SECURITY.md`. For any new table: RLS enabled, explicit policies, least-privilege grants, and a tenant-isolation test.
3. **Check environment variables.** Every variable in `.env.example` must be set in Vercel. `ALLOW_DEMO_AI` must be unset or `false`. `CRON_SECRET` must be at least 32 random characters. No secret may use a `NEXT_PUBLIC_` name. `NEXT_PUBLIC_APP_URL` must exactly match the public URL, because Twilio signatures depend on it.
4. **Verify RLS on production** (read-only):

```sql
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r';
```

   Every table must show `t`.
5. **Two-business test on staging.** Create two accounts and confirm neither can see the other's leads, pages or alerts. `tests/security/tenant-isolation.test.ts` and `app-security.test.ts` automate this.
6. **Failed API calls.** Covered by the mock-AI failure modes in `ai-messaging.test.ts`. On staging, also set a wrong `OPENAI_API_KEY` once and confirm the lead gets the holding reply and the owner is alerted.
7. **Duplicate webhooks.** Covered by `webhooks.test.ts` (Twilio ×3, Stripe replay and out-of-order). On staging, resend a Stripe event from the dashboard.
8. **Rate limits.** Covered by `webhooks.test.ts`. Confirm in the logs that `rate_limit.exceeded` appears.
9. **Prompt injection.** Covered by `ai-messaging.test.ts`. On staging with the **real** model, try the attacks listed in that file plus your own creative ones, and check that the replies don't leak.
10. **Backup and recovery.** Run `scripts/backup-restore-drill.sh` against staging and confirm Supabase backups/PITR are enabled.

Also enable:
- Twilio **Geo Permissions** (only your countries), **SMS Pumping Protection**, and an account usage trigger, for example an email alert at $50/day.
- OpenAI **usage limits** (a monthly budget) on the project key.
- Stripe Radar defaults.
- GitHub **Dependabot** and secret scanning.

## Launch checklist

- [ ] Sign up with a fresh email, finish onboarding, add a test lead and run the "John" scenario
- [ ] Text your Twilio number from your phone: a lead appears and the AI replies
- [ ] Reply "STOP": the lead is marked opted out and gets no further messages
- [ ] Complete a Stripe test-mode checkout: the plan updates on the Billing page
- [ ] Add `/api/cron/follow-ups` to uptime monitoring (it should return 200 with the secret)
- [ ] Publish a privacy policy and terms (you process customers' personal data)
