-- =====================================================================
-- Round 20: ጠባይ (conduct) is given by the class's teachers, not by the
-- department; a teacher's assignment keeps the date it was made.
-- =====================================================================

-- when a teacher was given the course
alter table public.offering_teachers add column if not exists assigned_at timestamptz not null default now();

-- the caller teaches a course of this student's class in that semester
create or replace function public.teaches_class(p_semester uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.course_offerings o
    join public.semesters s on s.id = o.semester_id
    join public.enrollments e on e.year_id = s.year_id and e.member_id = p_member and e.class_level = o.class_level
    join public.offering_teachers t on t.offering_id = o.id and t.member_id = public.current_member_id()
    where o.semester_id = p_semester)
$$;
grant execute on function public.teaches_class(uuid, uuid) to authenticated;

drop policy if exists conduct_read on public.semester_conduct;
drop policy if exists conduct_write on public.semester_conduct;
create policy conduct_read on public.semester_conduct for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or member_id = public.current_member_id()
         or public.teaches_class(semester_id, member_id));
create policy conduct_insert on public.semester_conduct for insert to authenticated
  with check (public.teaches_class(semester_id, member_id) and member_id <> public.current_member_id());
create policy conduct_update on public.semester_conduct for update to authenticated
  using (public.teaches_class(semester_id, member_id))
  with check (public.teaches_class(semester_id, member_id) and member_id <> public.current_member_id());
