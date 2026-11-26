-- PL/pgSQL does not short-circuit AND, so referencing NEW.actor_user_id on consent_events (or NEW.lead_id on
-- audit_log) raised "record has no field". Use per-table branches.
create or replace function public.forbid_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'consent_events' then
    if (to_jsonb(new) ->> 'lead_id') is null and (to_jsonb(new) - 'lead_id') = (to_jsonb(old) - 'lead_id') then return new; end if;
  elsif tg_table_name = 'audit_log' then
    if (to_jsonb(new) ->> 'actor_user_id') is null and (to_jsonb(new) - 'actor_user_id') = (to_jsonb(old) - 'actor_user_id') then return new; end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
