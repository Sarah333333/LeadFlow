-- Read-only posture check for the internal risk dashboard (service role only).
create or replace function public.security_posture()
returns table (tables_total integer, tables_without_rls text[], legacy_consent_leads integer,
               auto_mode_without_ack integer, last_retention_purge timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'),
    (select coalesce(array_agg(c.relname::text), '{}') from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
    (select count(*)::int from public.leads where sms_consent_source = 'legacy_pre_consent_tracking'),
    (select count(*)::int from public.businesses where ai_mode = 'auto' and ai_mode_acknowledged_at is null),
    (select max(created_at) from public.audit_log where action = 'retention.purged');
$$;
revoke execute on function public.security_posture() from public, anon, authenticated;
grant execute on function public.security_posture() to service_role;
