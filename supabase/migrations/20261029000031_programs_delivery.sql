-- =====================================================================
-- Round 14 (a): what each member chose to take part in, online / physical
-- delivery (with the meeting link), and meetings requested as ቀጠሮ.
-- =====================================================================

-- ---------- 1. Programs a member chose (ኮርስ, አብነት, መዝሙር, የተለያዩ አገልግሎቶች) ----------
-- chosen   = the member asked to take part; the department has not added them yet
-- active   = the department added them → they are on its attendance list
-- declined = the member chose not to (shown on the leaving certificate)
-- no row   = never asked (members registered before this existed)
create table public.member_programs (
  member_id   uuid not null references public.members (id) on delete cascade,
  program     text not null check (program in ('course', 'abnet', 'mezmur', 'duty')),
  status      text not null check (status in ('chosen', 'active', 'declined')),
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (member_id, program)
);
create index member_programs_program_idx on public.member_programs (program, status);

-- The department that adds members to a program.
create or replace function public.program_dept(p text)
returns text language sql immutable set search_path = ''
as $$ select case p when 'course' then 'education' when 'abnet' then 'education' when 'mezmur' then 'mezmur' when 'duty' then 'hr' end $$;

alter table public.member_programs enable row level security;
grant select, insert, update, delete on public.member_programs to authenticated;
create policy member_programs_read on public.member_programs for select to authenticated
  using (public.is_staff() or member_id = public.current_member_id());
-- ሰው ሃብት / ጽሕፈት ቤት edit the choices; the owning department only moves chosen ↔ active.
create policy member_programs_insert on public.member_programs for insert to authenticated
  with check (public.has_any_dept(array['hr', 'office']));
create policy member_programs_update on public.member_programs for update to authenticated
  using (public.has_any_dept(array['hr', 'office'])
         or (public.has_dept(public.program_dept(program)) and status in ('chosen', 'active')))
  with check (public.has_any_dept(array['hr', 'office'])
              or (public.has_dept(public.program_dept(program)) and status in ('chosen', 'active')));
create policy member_programs_delete on public.member_programs for delete to authenticated
  using (public.has_any_dept(array['hr', 'office']));

create or replace function public.stamp_program_decision()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.decided_by := auth.uid(); new.decided_at := now();
  end if;
  return new;
end $$;
create trigger trg_member_programs_stamp before insert or update on public.member_programs
  for each row execute function public.stamp_program_decision();

-- HR saves the member's choices: ticked → chosen (kept active if already added), unticked → declined.
create or replace function public.set_member_programs(p_member uuid, p_chosen text[])
returns void language plpgsql security invoker set search_path = ''
as $$
declare p text;
begin
  foreach p in array array['course', 'abnet', 'mezmur', 'duty'] loop
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
revoke all on function public.set_member_programs(uuid, text[]) from public, anon;
grant execute on function public.set_member_programs(uuid, text[]) to authenticated;

-- Self-registration keeps the choices until HR approves.
alter table public.member_applications add column programs text[];

-- Existing members: whoever already takes part is added (nobody is marked as declined).
insert into public.member_programs (member_id, program, status)
select distinct e.member_id, 'course', 'active' from public.enrollments e
on conflict do nothing;
insert into public.member_programs (member_id, program, status)
select distinct a.member_id, 'abnet', 'active'
from public.attendance a join public.attendance_sessions s on s.id = a.session_id
where s.session_type = 'abnet' and a.status <> 'absent'
on conflict do nothing;
insert into public.member_programs (member_id, program, status)
select distinct x.member_id, 'mezmur', 'active' from (
  select d.member_id from public.member_departments d where d.dept = 'mezmur'
  union
  select a.member_id from public.attendance a join public.attendance_sessions s on s.id = a.session_id
  where s.session_type in ('mezmur', 'wereb') and a.status <> 'absent'
) x
on conflict do nothing;
insert into public.member_programs (member_id, program, status)
select distinct d.member_id, 'duty', 'active' from public.duty_assignments d
on conflict do nothing;

-- Attendance sheets list only the members who take part: መዝሙር/ወረብ → mezmur, አብነት → abnet; ስብሰባ → everybody.
create or replace function public.create_attendance_session(
  p_type     public.session_type,
  p_date     date,
  p_time     time,
  p_statuses jsonb default '{}'::jsonb,
  p_notes    text default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.attendance_sessions (session_type, session_date, session_time, notes)
  values (p_type, p_date, p_time, p_notes)
  returning id into v_id;

  insert into public.attendance (session_id, member_id, status)
  select v_id, m.id,
         coalesce((p_statuses ->> m.id::text)::public.attendance_status, 'absent')
  from public.members m
  where m.is_active
    and (p_type in ('meeting', 'course')
         or public.in_program(m.id, case p_type when 'abnet' then 'abnet' else 'mezmur' end));

  return v_id;
end $$;

create or replace function public.in_program(p_member uuid, p_program text)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.member_programs where member_id = p_member and program = p_program and status = 'active') $$;
grant execute on function public.in_program(uuid, text) to authenticated;

-- Self-enrolling in the year = choosing ኮርስ (unless the member declined it).
create or replace function public.enroll_self()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare y uuid; me uuid := public.current_member_id(); v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  if exists (select 1 from public.member_programs where member_id = me and program = 'course' and status = 'declined') then
    raise exception 'course_declined' using errcode = 'P0001';
  end if;
  select id into y from public.academic_years where is_active;
  if y is null then raise exception 'no_active_year' using errcode = 'P0001'; end if;
  insert into public.member_programs (member_id, program, status) values (me, 'course', 'chosen')
  on conflict (member_id, program) do nothing;
  insert into public.enrollments (year_id, member_id, self_registered) values (y, me, true)
  on conflict (year_id, member_id) do nothing
  returning id into v;
  return v;
end $$;

-- ---------- 2. Online or at the church: mode, platform and link ----------
do $$
declare t text;
begin
  foreach t in array array['events', 'fixed_schedules', 'abnet_sessions', 'course_offerings', 'attendance_sessions'] loop
    execute format($f$
      alter table public.%I
        add column mode     text not null default 'physical' check (mode in ('physical', 'online')),
        add column platform text check (platform in ('meet', 'telegram', 'zoom', 'other')),
        add column link     text check (link is null or (length(link) <= 500 and link ~* '^https?://')),
        add constraint %I check (mode = 'physical' or platform is not null)
    $f$, t, t || '_online_platform');
  end loop;
end $$;

-- The link is for members and staff only: the public (anon) role reads every column except it.
revoke select on public.events from anon;
grant select (id, title, event_date, event_time, dept, status, created_at, decided_at, kind, place, mode, platform) on public.events to anon;
revoke select on public.fixed_schedules from anon;
grant select (id, dept, kind, title, day_text, time_text, place, note, sort, created_at, mode, platform) on public.fixed_schedules to anon;
revoke select on public.abnet_sessions from anon;
grant select (id, subjects, days, times, teacher, created_at, subject, audio_path, file_path, day_text, time_text, mode, platform)
  on public.abnet_sessions to anon;

-- ---------- 3. ቀጠሮ kinds: ስብሰባ (ሰው ሃብት), ኮርስ / አብነት (ትምህርት ክፍል), ወረብ ጥናት (መዝሙር ክፍል) ----------
alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check check (kind in ('wereb', 'meeting', 'course', 'abnet'));
