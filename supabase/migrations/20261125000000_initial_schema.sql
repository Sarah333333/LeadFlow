-- LeadFlow AI — initial schema
-- Tenancy model: every row belongs to a business; users access a business via business_members.

create extension if not exists pgcrypto;

-- ───────────────────────────── businesses ─────────────────────────────
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- profile (used by the AI)
  name text not null,
  industry text not null default 'home_services',
  description text not null default '',
  services jsonb not null default '[]'::jsonb,        -- [{name, price_range, description}]
  service_areas text[] not null default '{}',
  opening_hours jsonb not null default '{}'::jsonb,    -- {mon:{open:"08:00",close:"18:00",closed:false},...}
  faqs jsonb not null default '[]'::jsonb,             -- [{question, answer}]
  contact_phone text,
  contact_email text,
  website text,
  booking_link text,
  tone text not null default 'friendly',               -- friendly | professional | casual
  timezone text not null default 'Europe/Dublin',
  currency text not null default 'EUR',
  average_job_value numeric(10,2) not null default 0,

  -- AI behaviour
  ai_enabled_by_default boolean not null default true,
  custom_instructions text not null default '',        -- Pro plan
  follow_up_delays_hours integer[] not null default '{4,24,72}',
  quiet_hours_start smallint not null default 20,       -- no follow-ups from 20:00…
  quiet_hours_end smallint not null default 8,          -- …until 08:00 (business timezone)

  -- notifications
  notify_email text,
  notify_phone text,
  notify_on_hot boolean not null default true,
  notify_on_attention boolean not null default true,

  -- channels
  intake_key text not null unique default encode(gen_random_bytes(18), 'hex'),
  sms_number text unique,                              -- Twilio number assigned to this business (E.164)

  -- billing
  plan text not null default 'trial',                  -- trial | starter | growth | pro
  subscription_status text not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_end timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  onboarding_completed boolean not null default false
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',                  -- owner | member
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_members (user_id);

-- ───────────────────────────── leads ─────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  phone text,
  email text,
  source text not null default 'manual',               -- manual | website | facebook | instagram | google | referral | webhook | sms | other
  channel text not null default 'test',                -- sms | test
  service_requested text,
  location text,
  initial_message text,

  score smallint not null default 0 check (score between 0 and 100),
  temperature text not null default 'cold' check (temperature in ('hot','warm','cold')),
  status text not null default 'new'
    check (status in ('new','contacted','engaged','qualified','won','lost','unresponsive','opted_out')),
  ai_summary text,
  details jsonb not null default '{}'::jsonb,          -- AI-extracted facts {label: value}
  ai_paused boolean not null default false,
  needs_attention boolean not null default false,
  attention_reason text,
  estimated_value numeric(10,2),

  follow_up_step smallint not null default 0,
  next_follow_up_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  last_inbound_at timestamptz,
  first_response_at timestamptz,
  closed_at timestamptz
);
create index on public.leads (business_id, created_at desc);
create index on public.leads (business_id, phone);
create index on public.leads (business_id, temperature);

-- ───────────────────────────── messages ─────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  direction text not null check (direction in ('inbound','outbound')),
  sender text not null check (sender in ('lead','ai','owner','system')),
  channel text not null default 'test',
  body text not null,
  status text not null default 'sent',                 -- queued | sent | delivered | failed | received
  provider_message_id text,
  error text,
  is_follow_up boolean not null default false
);
create index on public.messages (lead_id, created_at);

-- ───────────────────────────── follow-ups ─────────────────────────────
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  step smallint not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','cancelled','skipped','failed')),
  processed_at timestamptz,
  message_id uuid references public.messages(id) on delete set null,
  note text
);
create index on public.follow_ups (status, scheduled_for);
create index on public.follow_ups (lead_id, created_at);

-- ───────────────────────────── lead events ─────────────────────────────
create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null,
  data jsonb not null default '{}'::jsonb
);
create index on public.lead_events (lead_id, created_at);

-- ───────────────────────────── notifications ─────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null,                                  -- hot_lead | needs_attention | limit_reached | lead_won
  title text not null,
  body text not null default '',
  read_at timestamptz
);
create index on public.notifications (business_id, created_at desc);

-- ───────────────────────────── updated_at triggers ─────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger businesses_touch before update on public.businesses for each row execute function public.touch_updated_at();
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

-- ───────────────────────────── row level security ─────────────────────────────
create or replace function public.is_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = bid and user_id = auth.uid());
$$;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.follow_ups enable row level security;
alter table public.lead_events enable row level security;
alter table public.notifications enable row level security;

create policy "members read business" on public.businesses for select using (public.is_member(id));
-- Billing columns are changed only by the server (service role) via Stripe webhooks:
create policy "members update business" on public.businesses for update using (public.is_member(id)) with check (public.is_member(id));
revoke insert, update, delete on public.businesses from authenticated, anon;
grant update (name, industry, description, services, service_areas, opening_hours, faqs, contact_phone,
  contact_email, website, booking_link, tone, timezone, currency, average_job_value, ai_enabled_by_default,
  custom_instructions, follow_up_delays_hours, quiet_hours_start, quiet_hours_end, notify_email, notify_phone,
  notify_on_hot, notify_on_attention, onboarding_completed)
  on public.businesses to authenticated;

create policy "read own memberships" on public.business_members for select using (user_id = auth.uid());

create policy "members all leads" on public.leads for all using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy "members all messages" on public.messages for all using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy "members read follow_ups" on public.follow_ups for select using (public.is_member(business_id));
create policy "members read events" on public.lead_events for select using (public.is_member(business_id));
create policy "members read notifications" on public.notifications for select using (public.is_member(business_id));
create policy "members update notifications" on public.notifications for update using (public.is_member(business_id));

-- Creating a business + owner membership atomically (called from onboarding).
create or replace function public.create_business(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select business_id into bid from public.business_members where user_id = auth.uid() limit 1;
  if bid is not null then return bid; end if;
  insert into public.businesses (name, notify_email)
    values (p_name, (select email from auth.users where id = auth.uid()))
    returning id into bid;
  insert into public.business_members (business_id, user_id, role) values (bid, auth.uid(), 'owner');
  return bid;
end $$;
revoke execute on function public.create_business(text) from anon;
