-- Red-team fixes.
-- Finding: authenticated users could write business settings straight through the REST API, bypassing all
-- server-side validation (e.g. a 200 KB description sent to the AI on every turn, javascript: links, bad time zones).
-- Fix 1: no direct writes at all — settings are written by the server after validation (service role).
-- Fix 2: database constraints as defense in depth, so even a server bug can't store invalid data.
-- Constraints are added NOT VALID (safe on a live table: enforced for new writes without a full-table lock);
-- validate them later with ALTER TABLE ... VALIDATE CONSTRAINT once existing rows are checked.

revoke update on public.businesses from authenticated;
drop policy if exists "members update business" on public.businesses;

create or replace function public.is_valid_timezone(tz text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create or replace function public.validate_business() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'invalid timezone' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists businesses_validate on public.businesses;
create trigger businesses_validate before insert or update of timezone on public.businesses
  for each row execute function public.validate_business();

alter table public.businesses
  add constraint biz_name_len check (char_length(name) between 2 and 100) not valid,
  add constraint biz_description_len check (char_length(description) <= 1500) not valid,
  add constraint biz_custom_len check (char_length(custom_instructions) <= 2000) not valid,
  add constraint biz_tone check (tone in ('friendly', 'professional', 'casual')) not valid,
  add constraint biz_currency check (currency in ('EUR', 'GBP', 'USD', 'CAD', 'AUD')) not valid,
  add constraint biz_services_shape check (jsonb_typeof(services) = 'array' and jsonb_array_length(services) <= 40 and octet_length(services::text) <= 20000) not valid,
  add constraint biz_faqs_shape check (jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 40 and octet_length(faqs::text) <= 60000) not valid,
  add constraint biz_hours_shape check (jsonb_typeof(opening_hours) = 'object' and octet_length(opening_hours::text) <= 2000) not valid,
  add constraint biz_areas_len check (cardinality(service_areas) <= 60) not valid,
  add constraint biz_urls check (
    (website is null or (website ~* '^https?://' and char_length(website) <= 500)) and
    (booking_link is null or (booking_link ~* '^https?://' and char_length(booking_link) <= 500))) not valid,
  add constraint biz_phones check (
    (notify_phone is null or notify_phone ~ '^\+[1-9][0-9]{6,14}$') and
    (sms_number is null or sms_number ~ '^\+[1-9][0-9]{6,14}$')) not valid,
  add constraint biz_followups check (
    cardinality(follow_up_delays_hours) <= 8 and 1 <= all(follow_up_delays_hours) and 720 >= all(follow_up_delays_hours)) not valid,
  add constraint biz_quiet_hours check (quiet_hours_start between 0 and 23 and quiet_hours_end between 0 and 23) not valid,
  add constraint biz_job_value check (average_job_value between 0 and 1000000) not valid;

alter table public.leads
  add constraint lead_name_len check (char_length(name) between 1 and 100) not valid,
  add constraint lead_text_len check (
    char_length(coalesce(initial_message, '')) <= 2000 and char_length(coalesce(service_requested, '')) <= 120 and
    char_length(coalesce(location, '')) <= 120 and char_length(coalesce(ai_summary, '')) <= 1000) not valid,
  add constraint lead_details_size check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 8000) not valid;

alter table public.messages add constraint msg_body_len check (char_length(body) <= 5000) not valid;

-- create_business: bound the name (it's callable by any signed-in user).
create or replace function public.create_business(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 100 then
    raise exception 'invalid business name' using errcode = '22023';
  end if;
  select business_id into bid from public.business_members where user_id = auth.uid() limit 1;
  if bid is not null then return bid; end if;
  insert into public.businesses (name, notify_email)
    values (trim(p_name), (select email from auth.users where id = auth.uid()))
    returning id into bid;
  insert into public.business_members (business_id, user_id, role) values (bid, auth.uid(), 'owner');
  return bid;
end $$;
revoke execute on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;
revoke execute on function public.is_valid_timezone(text) from public, anon;
revoke execute on function public.validate_business() from public, anon, authenticated;
