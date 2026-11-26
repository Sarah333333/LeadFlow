-- Privacy-by-design, messaging consent, AI controls, audit trail.
-- Additive. Existing businesses keep their current behaviour (ai_mode = 'auto'); NEW businesses start in 'review'.

-- ─────────────── Business-level controls ───────────────
alter table public.businesses
  add column if not exists ai_mode text not null default 'review',
  add column if not exists ai_mode_acknowledged_at timestamptz,
  add column if not exists ai_mode_acknowledged_by uuid references auth.users(id) on delete set null,
  add column if not exists retention_days integer default 365,
  add column if not exists max_ai_messages_per_lead_per_day smallint not null default 10;
update public.businesses set ai_mode = 'auto' where ai_mode = 'review' and created_at < now(); -- preserve existing behaviour
alter table public.businesses
  add constraint biz_ai_mode check (ai_mode in ('auto', 'review', 'off')),
  add constraint biz_retention check (retention_days is null or retention_days between 30 and 3650),
  add constraint biz_lead_msg_cap check (max_ai_messages_per_lead_per_day between 1 and 25);

-- ─────────────── Per-lead consent (per channel) ───────────────
alter table public.leads
  add column if not exists sms_consent text not null default 'none',
  add column if not exists sms_consent_at timestamptz,
  add column if not exists sms_consent_source text,
  add column if not exists do_not_contact boolean not null default false;
alter table public.leads add constraint lead_sms_consent check (sms_consent in ('none', 'granted', 'revoked'));
-- Pre-existing SMS leads: mark as legacy so they are visible for review (no consent evidence exists for them).
update public.leads set sms_consent = 'granted', sms_consent_source = 'legacy_pre_consent_tracking', sms_consent_at = created_at
  where channel = 'sms' and status <> 'opted_out';
update public.leads set sms_consent = 'revoked', sms_consent_source = 'keyword_stop' where status = 'opted_out';

-- Append-only consent ledger: the record that demonstrates what each person agreed to, when, and how.
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,   -- proof survives lead deletion (pseudonymised)
  phone_hash text,                                               -- sha256(business_id:phone), no raw number
  channel text not null check (channel in ('sms', 'email')),
  action text not null check (action in ('granted', 'revoked', 'reinstated')),
  basis text not null check (basis in ('inbound_message', 'web_form_checkbox', 'owner_attestation', 'keyword_stop',
                                        'keyword_start', 'ai_detected_opt_out', 'owner_marked_do_not_contact', 'api')),
  evidence jsonb not null default '{}'::jsonb,                   -- consent wording, form URL, actor user id, ip hash
  created_at timestamptz not null default now()
);
create index on public.consent_events (business_id, created_at desc);
create index on public.consent_events (lead_id);

-- Suppression list: numbers that must never be messaged again, kept even after a lead is deleted.
create table public.suppression_list (
  business_id uuid not null references public.businesses(id) on delete cascade,
  phone_hash text not null,
  channel text not null default 'sms',
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (business_id, phone_hash, channel)
);

-- Audit trail of important automated and human actions.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'ai', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (business_id, created_at desc);

-- Acceptance of legal documents (versioned).
create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  document text not null check (document in ('terms', 'privacy', 'business_responsibilities')),
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);
create index on public.agreements (user_id, document);

-- Append-only: ledger and audit rows can be deleted (retention/erasure/account deletion) but never edited.
create or replace function public.forbid_update() returns trigger language plpgsql set search_path = '' as $$
begin raise exception '% is append-only', tg_table_name using errcode = '42501'; end $$;
create trigger consent_events_append_only before update on public.consent_events for each row execute function public.forbid_update();
create trigger audit_log_append_only before update on public.audit_log for each row execute function public.forbid_update();
create trigger agreements_append_only before update on public.agreements for each row execute function public.forbid_update();

-- ─────────────── Messages: review workflow & provenance ───────────────
alter table public.messages
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists original_body text;            -- AI draft text if the owner edited it before sending
alter table public.messages add constraint msg_status check (status in ('draft', 'discarded', 'queued', 'sent', 'delivered', 'failed', 'received'));

-- DATABASE-LEVEL GUARANTEE: no outbound SMS can be recorded (and therefore sent — we record before sending)
-- for a lead without SMS consent, marked do-not-contact, opted out, or on the suppression list.
create or replace function public.enforce_sms_consent() returns trigger language plpgsql security definer set search_path = '' as $$
declare l record;
begin
  if new.direction = 'outbound' and new.channel = 'sms' and new.status in ('queued', 'sent', 'delivered') then
    select status, sms_consent, do_not_contact, phone, business_id into l from public.leads where id = new.lead_id;
    if l.status = 'opted_out' or l.do_not_contact or l.sms_consent <> 'granted' then
      raise exception 'sms blocked: no consent or opted out' using errcode = '42501';
    end if;
    if l.phone is not null and exists (select 1 from public.suppression_list s where s.business_id = l.business_id
        and s.channel = 'sms' and s.phone_hash = encode(extensions.digest(l.business_id::text || ':' || l.phone, 'sha256'), 'hex')) then
      raise exception 'sms blocked: number is suppressed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger messages_enforce_sms_consent before insert or update of status on public.messages
  for each row execute function public.enforce_sms_consent();

-- ─────────────── Retention ───────────────
-- Deletes leads (and by cascade their messages, follow-ups, events, alerts) older than each business's retention period.
-- Consent/suppression records are kept (pseudonymised) so opt-outs keep being honoured — see docs/legal/LEGAL_RISK_REGISTER.md.
create or replace function public.purge_expired_data()
returns table (business_id uuid, leads_deleted integer)
language plpgsql security definer set search_path = '' as $$
declare b record; n integer;
begin
  for b in select id, retention_days from public.businesses where retention_days is not null loop
    delete from public.leads l where l.business_id = b.id
      and coalesce(l.last_message_at, l.created_at) < now() - make_interval(days => b.retention_days);
    get diagnostics n = row_count;
    if n > 0 then
      insert into public.audit_log (business_id, actor_type, action, details)
        values (b.id, 'system', 'retention.purged', jsonb_build_object('leads_deleted', n, 'retention_days', b.retention_days));
      business_id := b.id; leads_deleted := n; return next;
    end if;
  end loop;
  delete from public.notifications where created_at < now() - interval '180 days';
end $$;

-- ─────────────── RLS: members can READ their own business's records; all writes are server-side ───────────────
alter table public.consent_events enable row level security;
alter table public.suppression_list enable row level security;
alter table public.audit_log enable row level security;
alter table public.agreements enable row level security;
create policy "members read consent" on public.consent_events for select to authenticated using (public.is_member(business_id));
create policy "members read suppression" on public.suppression_list for select to authenticated using (public.is_member(business_id));
create policy "members read audit" on public.audit_log for select to authenticated using (public.is_member(business_id));
create policy "read own agreements" on public.agreements for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on public.consent_events, public.suppression_list, public.audit_log, public.agreements from authenticated, anon;

revoke execute on function public.purge_expired_data() from public, anon, authenticated;
revoke execute on function public.enforce_sms_consent() from public, anon, authenticated;
revoke execute on function public.forbid_update() from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
