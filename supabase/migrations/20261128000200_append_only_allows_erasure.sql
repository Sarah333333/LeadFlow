-- Fix: the append-only trigger also blocked the ON DELETE SET NULL that runs when a lead (or user) is deleted,
-- so erasing a lead with consent history failed. Records stay immutable; the ONLY permitted change is
-- unlinking a deleted lead/user (pseudonymisation), with every other column unchanged.
create or replace function public.forbid_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'consent_events' and new.lead_id is null
     and (to_jsonb(new) - 'lead_id') = (to_jsonb(old) - 'lead_id') then
    return new;
  end if;
  if tg_table_name = 'audit_log' and new.actor_user_id is null
     and (to_jsonb(new) - 'actor_user_id') = (to_jsonb(old) - 'actor_user_id') then
    return new;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
