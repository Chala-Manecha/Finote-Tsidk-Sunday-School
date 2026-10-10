-- ትምህርት ክፍል: one view of class attendance across all courses, and attendance of the teachers themselves.

create type public.teacher_att_status as enum ('present', 'late', 'absent', 'excused');

create table public.teacher_attendance (
  id           uuid primary key default gen_random_uuid(),
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,   -- the teacher
  att_date     date not null,
  status       public.teacher_att_status not null,
  note         text,
  recorded_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (offering_id, member_id, att_date)
);
create index teacher_attendance_date_idx on public.teacher_attendance (att_date);

alter table public.teacher_attendance enable row level security;
grant select, insert, update, delete on public.teacher_attendance to authenticated;
create policy teacher_attendance_read on public.teacher_attendance for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or member_id = public.current_member_id());
create policy teacher_attendance_write on public.teacher_attendance for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

/** Per student per course: sessions held and sessions attended (present or half) in one semester + class. */
create or replace function public.class_attendance_summary(p_semester uuid, p_class text)
returns table (member_id uuid, offering_id uuid, attended int, sessions int)
language sql stable security definer set search_path = ''
as $$
  select e.member_id, o.id,
         count(a.session_id) filter (where a.status in ('present', 'half'))::int,
         count(cs.id)::int
  from public.course_offerings o
  join public.semesters s on s.id = o.semester_id
  join public.enrollments e on e.year_id = s.year_id and e.class_level = o.class_level
  left join public.class_sessions cs on cs.offering_id = o.id
  left join public.class_attendance a on a.session_id = cs.id and a.member_id = e.member_id
  where o.semester_id = p_semester and o.class_level = p_class
    and public.has_any_dept(array['education', 'audit'])
  group by e.member_id, o.id
$$;
revoke all on function public.class_attendance_summary(uuid, text) from public, anon;
grant execute on function public.class_attendance_summary(uuid, text) to authenticated;
