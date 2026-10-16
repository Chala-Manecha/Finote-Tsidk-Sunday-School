-- =====================================================================
-- Round 17: የአባላት ስራ ምደባ — a job is either given by a department
-- (the member must accept it before the day, otherwise it expires; once
-- accepted it cannot be taken back) or chosen by the member themself
-- from their dashboard (cannot be changed once sent).
-- =====================================================================

alter table public.duty_assignments
  add column source      text not null default 'given' check (source in ('given', 'chosen')),
  add column accepted_at timestamptz;
alter table public.duty_assignments alter column dept drop not null;
-- jobs given before this change count as accepted
update public.duty_assignments set accepted_at = assigned_at where accepted_at is null;

-- a chosen job has no assigning department; ሰው ሃብት / የውስጥ ግንኙነት follow them up
create policy duty_chosen_manage on public.duty_assignments for update to authenticated
  using (dept is null and public.has_any_dept(array['hr', 'internal_comm']))
  with check (dept is null and public.has_any_dept(array['hr', 'internal_comm']));

create or replace function public.addis_today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Africa/Addis_Ababa')::date $$;
grant execute on function public.addis_today() to anon, authenticated;

-- Staff cannot accept for the member, change who chose it, or confirm a job that was never accepted.
create or replace function public.guard_duty()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if new.accepted_at is distinct from old.accepted_at or new.source <> old.source or new.member_id <> old.member_id then
      raise exception 'duty_locked' using errcode = 'P0001';
    end if;
    if old.accepted_at is not null and (new.duty, new.duty_date, new.occasion) is distinct from (old.duty, old.duty_date, old.occasion) then
      raise exception 'duty_locked' using errcode = 'P0001';
    end if;
    if new.status is not null and new.accepted_at is null then
      raise exception 'duty_not_accepted' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_duty before update on public.duty_assignments
  for each row execute function public.guard_duty();

-- An accepted job stays (it counts on the member's record).
drop policy duty_write on public.duty_assignments;
create policy duty_insert on public.duty_assignments for insert to authenticated
  with check (public.has_dept(dept) and source = 'given' and accepted_at is null);
create policy duty_update on public.duty_assignments for update to authenticated
  using (public.has_dept(dept)) with check (public.has_dept(dept));
create policy duty_delete on public.duty_assignments for delete to authenticated
  using (public.has_dept(dept) and accepted_at is null);

-- ---------- the member's side ----------
create or replace function public.accept_duty(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare d public.duty_assignments;
begin
  select * into d from public.duty_assignments where id = p_id for update;
  if d.id is null or d.member_id is distinct from public.current_member_id() then raise exception 'not allowed'; end if;
  if d.accepted_at is not null then return; end if;
  if d.duty_date < public.addis_today() then raise exception 'duty_expired' using errcode = 'P0001'; end if;
  update public.duty_assignments set accepted_at = now() where id = p_id;
end $$;
revoke all on function public.accept_duty(uuid) from public, anon;
grant execute on function public.accept_duty(uuid) to authenticated;

create or replace function public.choose_duty(p_duty text, p_occasion text, p_date date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare me uuid := public.current_member_id(); v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  if coalesce(length(btrim(p_duty)), 0) not between 1 and 80 or coalesce(length(btrim(p_occasion)), 0) not between 1 and 80 then
    raise exception 'duty_fields' using errcode = 'P0001';
  end if;
  if p_date is null or p_date < public.addis_today() then raise exception 'duty_date' using errcode = 'P0001'; end if;
  insert into public.duty_assignments (member_id, dept, duty, duty_date, occasion, source, accepted_at)
  values (me, null, btrim(p_duty), p_date, btrim(p_occasion), 'chosen', now())
  returning id into v;
  return v;
end $$;
revoke all on function public.choose_duty(text, text, date) from public, anon;
grant execute on function public.choose_duty(text, text, date) to authenticated;

drop function public.my_duties();
create or replace function public.my_duties()
returns table (id uuid, dept text, duty text, duty_date date, occasion text, status text, source text, accepted_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.dept, d.duty, d.duty_date, d.occasion, d.status, d.source, d.accepted_at
  from public.duty_assignments d
  where d.member_id = public.current_member_id()
  order by d.duty_date desc
  limit 80;
$$;
revoke all on function public.my_duties() from public, anon;
grant execute on function public.my_duties() to authenticated;

-- ---------- participation counts only jobs the member took on ----------
create or replace function public.participation(p_member uuid default null, p_from date default null, p_to date default null)
returns table (member_id uuid, area text, total int, attended numeric, pending int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_member is null then
    if not public.has_any_dept(array['hr', 'office', 'audit']) then raise exception 'not allowed'; end if;
  elsif not (public.is_staff() or p_member = public.current_member_id()) then
    raise exception 'not allowed';
  end if;

  return query
  select x.member_id, x.area, sum(x.total)::int, sum(x.attended)::numeric, sum(x.pending)::int
  from (
    select a.member_id, s.session_type::text as area, count(*) as total,
           sum(case a.status when 'present' then 1 when 'half' then 0.5 else 0 end) as attended, 0 as pending
    from public.attendance a
    join public.attendance_sessions s on s.id = a.session_id
    where (p_member is null or a.member_id = p_member)
      and (p_from is null or s.session_date >= p_from) and (p_to is null or s.session_date <= p_to)
    group by a.member_id, s.session_type
    union all
    select ca.member_id, 'course', count(*),
           sum(case ca.status when 'present' then 1 when 'half' then 0.5 else 0 end), 0
    from public.class_attendance ca
    join public.class_sessions cs on cs.id = ca.session_id
    where (p_member is null or ca.member_id = p_member)
      and (p_from is null or cs.session_date >= p_from) and (p_to is null or cs.session_date <= p_to)
    group by ca.member_id
    union all
    select t.member_id, 'teaching', count(*) filter (where t.status <> 'excused'),
           sum(case t.status when 'present' then 1 when 'late' then 0.5 else 0 end), 0
    from public.teacher_attendance t
    where (p_member is null or t.member_id = p_member)
      and (p_from is null or t.att_date >= p_from) and (p_to is null or t.att_date <= p_to)
    group by t.member_id
    union all
    select d.member_id, 'duty', count(*) filter (where d.status is not null),
           count(*) filter (where d.status = 'done'), count(*) filter (where d.status is null)
    from public.duty_assignments d
    where d.accepted_at is not null
      and (p_member is null or d.member_id = p_member)
      and (p_from is null or d.duty_date >= p_from) and (p_to is null or d.duty_date <= p_to)
    group by d.member_id
  ) x
  group by x.member_id, x.area;
end $$;

-- ---------- programs: የተለያዩ አገልግሎቶች is now chosen job by job, not as a program ----------
create or replace function public.set_member_programs(p_member uuid, p_chosen text[])
returns void language plpgsql security invoker set search_path = ''
as $$
declare p text;
begin
  foreach p in array array['course', 'abnet', 'mezmur'] loop
    if p = any (coalesce(p_chosen, '{}')) then
      insert into public.member_programs (member_id, program, status) values (p_member, p, 'chosen')
      on conflict (member_id, program) do update
        set status = case when public.member_programs.status = 'active' then 'active' else 'chosen' end;
    else
      insert into public.member_programs (member_id, program, status) values (p_member, p, 'declined')
      on conflict (member_id, program) do update set status = 'declined';
    end if;
  end loop;
end $$;
delete from public.member_programs where program = 'duty';
