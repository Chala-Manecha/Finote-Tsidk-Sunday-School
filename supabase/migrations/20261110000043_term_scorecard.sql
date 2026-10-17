-- =====================================================================
-- የአመራር ቡድን: each team's results side by side (members, attendance,
-- money, property, jobs, events) and the team's own tags.
-- =====================================================================
alter table public.leadership_terms add column if not exists tags text[] not null default '{}';

create or replace function public.term_scorecard()
returns table (term_id uuid, new_members int, departures int, sessions int, attendance_pct numeric,
               events int, income numeric, donations numeric, spent numeric,
               property_added numeric, property_lost numeric, property_maintained int,
               duties_done int, duties_missed int, feedback int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or public.has_any_dept(array['office', 'audit'])) then raise exception 'not permitted'; end if;
  return query
  select t.id,
    (select count(*)::int from public.members m where m.term_id = t.id),
    (select count(*)::int from public.member_departures d where d.term_id = t.id and d.status = 'approved'),
    (select count(*)::int from public.attendance_sessions s where s.term_id = t.id),
    (select round(100.0 * avg(case a.status when 'present' then 1 when 'half' then 0.5 else 0 end), 1)
       from public.attendance a join public.attendance_sessions s on s.id = a.session_id where s.term_id = t.id),
    (select count(*)::int from public.events e where e.term_id = t.id and e.status = 'approved'),
    (select coalesce(sum(x.amount), 0) from public.earnings x where x.term_id = t.id and x.status = 'approved'),
    (select coalesce(sum(x.amount), 0) from public.donations x where x.term_id = t.id and x.status = 'verified'),
    (select coalesce(sum(r.amount), 0) from public.money_requests r where r.term_id = t.id and r.status = 'paid'),
    (select coalesce(sum(p.value), 0) from public.property_log p where p.term_id = t.id and p.kind = 'added'),
    (select coalesce(sum(p.value), 0) from public.property_log p where p.term_id = t.id and p.kind = 'lost'),
    (select count(*)::int from public.property_log p where p.term_id = t.id and p.kind = 'maintained'),
    (select count(*)::int from public.duty_assignments j where j.term_id = t.id and j.status = 'done'),
    (select count(*)::int from public.duty_assignments j where j.term_id = t.id and j.status = 'missed'),
    (select count(*)::int from public.feedback f where f.term_id = t.id)
  from public.leadership_terms t;
end $$;
revoke all on function public.term_scorecard() from public, anon;
grant execute on function public.term_scorecard() to authenticated;
