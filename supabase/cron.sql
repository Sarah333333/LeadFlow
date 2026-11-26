-- Alternative to Vercel Cron (free): call the follow-up processor every minute from Supabase.
-- Run once in the Supabase SQL editor after deploying. Replace the URL and secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'leadflow-follow-ups',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-APP.vercel.app/api/cron/follow-ups',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
-- To remove: select cron.unschedule('leadflow-follow-ups');
