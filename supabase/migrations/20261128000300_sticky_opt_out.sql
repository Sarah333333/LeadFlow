-- Race-condition fix (found by the compliance test suite): a request holding a stale copy of a lead could
-- overwrite status 'opted_out' (e.g. with 'engaged' or 'qualified') when a STOP arrived at the same moment.
-- Texts were still blocked (consent is checked separately), but the opt-out state must never be lost.
-- Rule: an opted-out lead stays opted out unless SMS consent has been explicitly re-granted (person texted START).
create or replace function public.keep_opt_out() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'opted_out' and new.status is distinct from 'opted_out' and new.sms_consent <> 'granted' then
    new.status := 'opted_out';
  end if;
  if old.sms_consent = 'revoked' and new.sms_consent = 'granted'
     and coalesce(new.sms_consent_source, '') not in ('keyword_start') then
    new.sms_consent := 'revoked';     -- only the person (START) can undo their own opt-out
    new.sms_consent_source := old.sms_consent_source;
    new.sms_consent_at := old.sms_consent_at;
  end if;
  if old.do_not_contact and not new.do_not_contact then
    new.do_not_contact := true;       -- do-not-contact is permanent
  end if;
  return new;
end $$;
create trigger leads_keep_opt_out before update on public.leads for each row execute function public.keep_opt_out();
revoke execute on function public.keep_opt_out() from public, anon, authenticated;
