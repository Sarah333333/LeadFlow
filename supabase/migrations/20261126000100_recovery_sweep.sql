-- Recovery sweep: conversations left unanswered by a crashed or timed-out request.
create or replace function public.leads_needing_ai(p_limit integer default 20)
returns table (id uuid, ai_retry_count smallint, needs_first_reply boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.ai_retry_count, (l.last_outbound_at is null) as needs_first_reply
  from public.leads l
  where l.ai_paused = false
    and l.status in ('new', 'contacted', 'engaged', 'qualified')
    and l.ai_retry_count < 3
    and (l.ai_lock_until is null or l.ai_lock_until < now())
    and (
      (l.last_outbound_at is null and l.created_at between now() - interval '24 hours' and now() - interval '2 minutes')
      or (l.last_inbound_at > coalesce(l.last_outbound_at, '-infinity'::timestamptz)
          and l.last_inbound_at between now() - interval '24 hours' and now() - interval '2 minutes')
    )
  order by coalesce(l.last_inbound_at, l.created_at)
  limit greatest(1, least(p_limit, 100));
$$;
revoke execute on function public.leads_needing_ai(integer) from public, anon, authenticated;
grant execute on function public.leads_needing_ai(integer) to service_role;
