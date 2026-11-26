# LeadFlow AI — Operations Runbook

## Backups

| Layer | What | How |
|---|---|---|
| Primary | Supabase automated daily backups (7 days on Pro) | Automatic on the Supabase **Pro** plan. Upgrade before the first paying customer. |
| Point-in-time | Restore to any second in the window | Enable the **PITR** add-on once revenue justifies it. |
| Logical | Independent copy you control | Run `scripts/backup-restore-drill.sh` with `DB_URL` weekly (scheduled CI job). Store the dumps **encrypted** off-site (for example S3 with SSE and object lock). |

Dumps contain customer personal data. Keep them encrypted, restrict access, and delete them after 30–90 days.

### Restore procedure

1. **Stop writes.** Pause the cron (`select cron.unschedule('leadflow-follow-ups');`) and put Vercel into maintenance mode, or roll back to a deployment that shows a maintenance page.
2. **Choose the restore point.** Use PITR (Dashboard → Database → Backups) to just before the incident, or the latest daily backup.
3. For a logical restore, create a **new** Supabase project, apply `supabase db push`, then `pg_restore` the `.users` dump followed by the main dump (see the drill script).
4. Verify with the drill's checks: row counts, RLS enabled on every table, policy count. Then run `npm run test:security` against a staging deployment pointed at it.
5. Point the env vars at the restored project, redeploy, and re-enable the cron.
6. Re-send nothing automatically. Review leads with `needs_attention` and any messages left in `queued`.

**Drill:** run the restore drill monthly and record the date and the result. Last local run passed (row counts and 9/9 RLS policies matched).

## Database migrations

- Never edit an applied migration. Always add a new file in `supabase/migrations/`.
- Use the **expand → migrate → contract** pattern: add new columns or tables (nullable or defaulted), deploy code that writes both, backfill, then remove the old ones in a later release.
- Before `supabase db push` to production, take a manual backup (Dashboard → Backups) and test the migration on a staging project or a branch.
- Any migration that touches RLS must be followed by `npm run test:security`.
- Destructive statements (`drop`, `truncate`, type changes) need a written rollback plan in the PR.

## Monitoring & alerts

Logs are JSON on stdout. Connect a Vercel log drain (Axiom, Better Stack or Datadog) and alert on:

| Alert | Query | Threshold |
|---|---|---|
| Possible attack | `level=security` | more than 50 in 5 minutes |
| Cross-tenant attempt | `event=tenancy.lead_access_denied` | any |
| Webhook forgery | `event=webhook.invalid_signature` | more than 5 in 5 minutes |
| AI outage | `event=ai.request_failed` | more than 5 in 5 minutes |
| SMS failures | `event=message.send_failed` | more than 10 in 15 minutes |
| Cron not running | no `cron.run` **and** due follow-ups exist | none for 10 minutes; also an uptime check on `/api/cron/follow-ups` |
| Unhandled errors | `event=request.unhandled_error` | any |
| Cost cap hit | `event=ai.business_daily_cap` | any (contact the customer) |

Add Sentry for stack traces: install `@sentry/nextjs` and call `Sentry.captureRequestError` in `src/instrumentation.ts`.

## Incident response

1. **Contain.** Rotate the affected secret (below), disable the affected integration's env var (the app degrades safely), or pause the cron.
2. **Assess.** Use the logs above to find which businesses were affected and the time window.
3. **Notify.** Under GDPR, a personal-data breach must be reported to the Data Protection Commission (Ireland) within **72 hours**, and affected businesses informed.
4. **Fix and verify.** Patch, add a regression test to `tests/security`, and run the full suite.
5. **Post-mortem.** Write down what happened and why, and add a check so it can't recur.

## Rotating secrets

| Secret | How | Impact |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → roll the JWT secret / API keys | All sessions are signed out |
| `OPENAI_API_KEY` | Create a new key, update Vercel, redeploy, revoke the old key | None |
| `TWILIO_AUTH_TOKEN` | Twilio console → secondary token → promote | Webhook signatures use the new token at once |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Roll in the Stripe dashboard; webhook secrets support an overlap period | None |
| `CRON_SECRET` | Change it in Vercel **and** the pg_cron job | The cron fails until both are updated |
| A business's intake URL | Settings → Lead sources → Generate new URL | The old URL stops working immediately |

Never paste secrets into chat, tickets or logs. Use the hosting provider's secret storage.
