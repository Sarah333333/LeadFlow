-- Make every privilege explicit instead of relying on Supabase's platform default grants.
-- (Found by testing the combined schema on a fresh database: without those defaults, users could read
--  nothing and the service role could do nothing. Explicit grants make the schema self-contained and auditable.)

grant usage on schema public to anon, authenticated, service_role;

-- Server role: full access (it is only ever used server-side, after explicit authorization checks).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Logged-in users: READ ONLY on customer data (RLS limits rows to their own business).
grant select on public.businesses, public.business_members, public.leads, public.messages, public.follow_ups,
  public.lead_events, public.notifications, public.consent_events, public.suppression_list, public.audit_log,
  public.agreements to authenticated;
-- …plus exactly one write: marking their own alerts as read.
grant update (read_at) on public.notifications to authenticated;
grant execute on function public.create_business(text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- Least privilege: privileges no app role needs.
revoke references, trigger, truncate on all tables in schema public from anon, authenticated;
revoke all on public.webhook_events, public.rate_limits from anon, authenticated;
revoke all on all tables in schema public from anon;

-- Internal helper used only by the businesses validation trigger (server writes only).
revoke execute on function public.is_valid_timezone(text) from authenticated;
