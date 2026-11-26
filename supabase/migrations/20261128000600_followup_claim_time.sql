-- Reliability: record WHEN a follow-up was claimed, so a claim left behind by a killed function
-- (e.g. platform timeout mid-run) can be detected and released instead of staying "processing" forever.
alter table public.follow_ups add column if not exists claimed_at timestamptz;
create index if not exists follow_ups_processing on public.follow_ups (status, claimed_at) where status = 'processing';
