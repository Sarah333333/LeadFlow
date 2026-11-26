-- Security & reliability hardening.
-- Additive only (new columns/tables/policies) — safe to apply to a live database.

-- ─────────────── 1. Least privilege: browser roles get read access only ───────────────
-- All writes to leads/messages/follow-ups/events go through the server (service role) after
-- an explicit authorization check. The browser can never forge a message or edit a score.

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

drop policy if exists "members all leads" on public.leads;
drop policy if exists "members all messages" on public.messages;
create policy "members read leads" on public.leads for select to authenticated using (public.is_member(business_id));
create policy "members read messages" on public.messages for select to authenticated using (public.is_member(business_id));

revoke insert, update, delete, truncate on public.leads, public.messages, public.follow_ups, public.lead_events,
  public.business_members from authenticated;
revoke insert, delete, truncate on public.notifications, public.businesses from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Make every policy explicit about the role it applies to.
alter policy "members read business" on public.businesses to authenticated;
alter policy "members update business" on public.businesses to authenticated;
alter policy "read own memberships" on public.business_members to authenticated;
alter policy "members read follow_ups" on public.follow_ups to authenticated;
alter policy "members read events" on public.lead_events to authenticated;
alter policy "members read notifications" on public.notifications to authenticated;
alter policy "members update notifications" on public.notifications to authenticated;

-- ─────────────── 2. Reliability columns ───────────────
alter table public.leads
  add column if not exists ai_lock_until timestamptz,          -- per-lead mutex: one AI turn at a time
  add column if not exists ai_rerun boolean not null default false, -- a message arrived while locked
  add column if not exists last_outbound_at timestamptz,
  add column if not exists ai_retry_count smallint not null default 0;

alter table public.follow_ups add column if not exists attempts smallint not null default 0;
alter table public.businesses add column if not exists stripe_event_at timestamptz; -- ignore out-of-order Stripe events

-- One stored inbound message per provider message ID → Twilio retries can't create duplicates.
create unique index if not exists messages_provider_id_unique
  on public.messages (provider_message_id) where provider_message_id is not null;
create index if not exists messages_business_sender_created on public.messages (business_id, sender, created_at);
create index if not exists leads_sweep on public.leads (status, ai_paused, last_inbound_at);

-- ─────────────── 3. Webhook idempotency ───────────────
create table if not exists public.webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  status text not null default 'processing',      -- processing | done | failed
  primary key (provider, event_id)
);
alter table public.webhook_events enable row level security;  -- no policies: service role only
revoke all on public.webhook_events from anon, authenticated;

-- ─────────────── 4. Rate limiting (fixed window, stored in Postgres) ───────────────
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;     -- no policies: service role only
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, ws, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  return c <= p_limit;
end $$;

-- ─────────────── 5. Per-lead AI lock (prevents duplicate / concurrent replies) ───────────────
create or replace function public.claim_lead_turn(p_lead uuid, p_seconds integer default 90)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update public.leads set ai_lock_until = now() + make_interval(secs => p_seconds), ai_rerun = false
   where id = p_lead and (ai_lock_until is null or ai_lock_until < now())
  returning true into ok;
  if ok is null then
    update public.leads set ai_rerun = true where id = p_lead;   -- tell the holder to run again
    return false;
  end if;
  return true;
end $$;

-- Releases the lock; returns true if another message arrived meanwhile (caller should run once more).
create or replace function public.release_lead_turn(p_lead uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare again boolean;
begin
  select ai_rerun into again from public.leads where id = p_lead for update;
  update public.leads set ai_lock_until = null, ai_rerun = false where id = p_lead;
  return coalesce(again, false);
end $$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.claim_lead_turn(uuid, integer) from public, anon, authenticated;
revoke execute on function public.release_lead_turn(uuid) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.claim_lead_turn(uuid, integer) to service_role;
grant execute on function public.release_lead_turn(uuid) to service_role;

-- Internal helpers are not part of the public API.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;
