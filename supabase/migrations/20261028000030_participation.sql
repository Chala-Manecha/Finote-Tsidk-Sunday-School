-- =====================================================================
-- Round 13: confirmed duties, participation %, HR bands, fixed schedules,
-- ወረብ ጥናት events, and member-dashboard RPCs.
-- =====================================================================

-- ---------- 1. Duties: the department confirms the member did the job ----------
alter table public.duty_assignments
  add column status       text check (status in ('done', 'missed')),   -- null = not yet confirmed
  add column confirmed_by uuid references auth.users (id) on delete set null,
  add column confirmed_at timestamptz;

create or replace function public.stamp_duty_confirm()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.confirmed_by := case when new.status is null then null else auth.uid() end;
    new.confirmed_at := case when new.status is null then null else now() end;
  end if;
  return new;
end $$;
create trigger trg_duty_confirm before update on public.duty_assignments
  for each row execute function public.stamp_duty_confirm();

-- ---------- 2. HR decides what counts as very good / good / poor ----------
create table public.hr_settings (
  id          boolean primary key default true check (id),
  very_good   smallint not null default 85,
  good        smallint not null default 65,
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  check (good between 0 and 100 and very_good between 0 and 100 and good < very_good)
);
insert into public.hr_settings default values;
alter table public.hr_settings enable row level security;
grant select on public.hr_settings to authenticated;
grant update on public.hr_settings to authenticated;
create policy hr_settings_read on public.hr_settings for select to authenticated using (true);
create policy hr_settings_write on public.hr_settings for update to authenticated
  using (public.has_dept('hr')) with check (public.has_dept('hr'));
create trigger trg_hr_settings_updated before update on public.hr_settings
  for each row execute function public.set_updated_at();

-- ---------- 3. Fixed (weekly) schedules — e.g. መዝሙር ጥናት every Saturday ----------
create table public.fixed_schedules (
  id          uuid primary key default gen_random_uuid(),
  dept        text not null references public.departments (code),
  kind        text not null default 'mezmur' check (kind in ('mezmur', 'wereb', 'other')),
  title       text not null check (length(title) between 1 and 160),
  day_text    text not null check (length(day_text) between 1 and 80),
  time_text   text check (time_text is null or length(time_text) <= 80),
  place       text check (place is null or length(place) <= 120),
  note        text check (note is null or length(note) <= 400),
  sort        int not null default 0,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.fixed_schedules enable row level security;
grant select on public.fixed_schedules to anon, authenticated;
grant insert, update, delete on public.fixed_schedules to authenticated;
create policy fixed_schedules_read on public.fixed_schedules for select using (true);
create policy fixed_schedules_write on public.fixed_schedules for all to authenticated
  using (public.has_dept(dept)) with check (public.has_dept(dept));
create trigger trg_fixed_schedules_creator before insert on public.fixed_schedules
  for each row execute function public.stamp_creator();

-- ---------- 4. Events: a kind (ወረብ ጥናት) and an optional place ----------
alter table public.events
  add column kind  text check (kind in ('wereb')),
  add column place text check (place is null or length(place) <= 120);

-- ---------- 5. Participation per member and area ----------
-- area: meeting | mezmur | wereb | abnet | course (student) | teaching | duty
-- total = counted sessions (duty: confirmed ones), attended = present + ½·half, pending = unconfirmed duties.
-- p_member null = everybody (ሰው ሃብት / ጽሕፈት ቤት / ኦዲት only).
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
    where (p_member is null or d.member_id = p_member)
      and (p_from is null or d.duty_date >= p_from) and (p_to is null or d.duty_date <= p_to)
    group by d.member_id
  ) x
  group by x.member_id, x.area;
end $$;
revoke all on function public.participation(uuid, date, date) from public, anon;
grant execute on function public.participation(uuid, date, date) to authenticated;

-- ---------- 6. One member's absences (detail page + the member's own dashboard) ----------
create or replace function public.member_absences(p_member uuid, p_limit int default 200)
returns table (on_date date, area text, label text, status text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.has_any_dept(array['hr', 'office', 'audit', 'education']) or p_member = public.current_member_id()) then
    raise exception 'not allowed';
  end if;
  return query
  select * from (
    select s.session_date, s.session_type::text, coalesce(s.title, ''), a.status::text
    from public.attendance a join public.attendance_sessions s on s.id = a.session_id
    where a.member_id = p_member and a.status in ('absent', 'half')
    union all
    select cs.session_date, 'course', o.name, ca.status::text
    from public.class_attendance ca
    join public.class_sessions cs on cs.id = ca.session_id
    join public.course_offerings o on o.id = cs.offering_id
    where ca.member_id = p_member and ca.status in ('absent', 'half')
    union all
    select t.att_date, 'teaching', o.name, case t.status when 'late' then 'half' else 'absent' end
    from public.teacher_attendance t join public.course_offerings o on o.id = t.offering_id
    where t.member_id = p_member and t.status in ('absent', 'late')
  ) z
  order by 1 desc
  limit greatest(coalesce(p_limit, 200), 1);
end $$;
revoke all on function public.member_absences(uuid, int) from public, anon;
grant execute on function public.member_absences(uuid, int) to authenticated;

-- ---------- 7. The member's own duties ----------
create or replace function public.my_duties()
returns table (id uuid, dept text, duty text, duty_date date, occasion text, status text)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.dept, d.duty, d.duty_date, d.occasion, d.status
  from public.duty_assignments d
  where d.member_id = public.current_member_id()
  order by d.duty_date desc
  limit 60;
$$;
revoke all on function public.my_duties() from public, anon;
grant execute on function public.my_duties() to authenticated;
