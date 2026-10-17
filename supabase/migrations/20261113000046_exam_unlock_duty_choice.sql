-- =====================================================================
-- Round 37:
--  * online exams: after ትምህርት ክፍል approves, the teacher opens the exam
--    (“ፈተና ጀምር” becomes clickable for the students only then);
--  * የአባላት ምደባ: a member's own choice is seen by every department, which
--    can allocate it (a given job linked to the choice); choosing a job
--    signs the member up for “በተለያዩ አገልግሎቶች”.
-- =====================================================================

-- ---------- exams: the teacher's go-ahead ----------
alter table public.online_exams add column if not exists unlocked_at timestamptz;

create or replace function public.guard_online_exam()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare teacher boolean := public.is_teacher_of(old.offering_id); edu boolean := public.has_dept('education');
begin
  if public.is_service_role() then return new; end if;
  if new.offering_id <> old.offering_id then raise exception 'exam course is fixed'; end if;
  if (new.component, new.title, new.instructions, new.duration_min, new.opens_at, new.closes_at)
     is distinct from (old.component, old.title, old.instructions, old.duration_min, old.opens_at, old.closes_at) then
    if not (teacher and old.status in ('draft', 'rejected')) then raise exception 'exam_locked' using errcode = 'P0001'; end if;
  end if;
  if new.status <> old.status then
    if teacher and old.status in ('draft', 'rejected') and new.status = 'submitted' then
      if not exists (select 1 from public.exam_questions q where q.exam_id = old.id) then
        raise exception 'exam_empty' using errcode = 'P0001';
      end if;
      new.submitted_at := now(); new.review_note := null;
    elsif teacher and old.status = 'submitted' and new.status = 'draft' then
      null;
    elsif edu and old.status = 'submitted' and new.status in ('approved', 'rejected') then
      new.approved_by := case when new.status = 'approved' then auth.uid() end;
      new.approved_at := case when new.status = 'approved' then now() end;
    elsif edu and old.status = 'approved' and new.status = 'draft' then
      if exists (select 1 from public.exam_attempts a where a.exam_id = old.id) then
        raise exception 'exam_started' using errcode = 'P0001';
      end if;
      new.approved_by := null; new.approved_at := null;
    else
      raise exception 'exam_status' using errcode = 'P0001';
    end if;
    if new.status <> 'approved' then new.unlocked_at := null; end if;
  end if;
  if new.review_note is distinct from old.review_note and not edu and new.status = old.status then
    raise exception 'exam_status' using errcode = 'P0001';
  end if;
  if new.pushed_at is distinct from old.pushed_at and not (teacher and new.status = 'approved') then
    raise exception 'exam_status' using errcode = 'P0001';
  end if;
  -- only the teacher opens / closes an approved exam for the students
  if new.unlocked_at is distinct from old.unlocked_at and new.status = old.status
     and not (teacher and new.status = 'approved') then
    raise exception 'exam_unlock' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop function public.my_exams();
create or replace function public.my_exams()
returns table (id uuid, title text, component text, course text, class_level text, opens_at timestamptz, closes_at timestamptz,
               duration_min int, questions int, total_points numeric, attempt_id uuid, deadline timestamptz,
               submitted_at timestamptz, score numeric, released boolean, unlocked boolean)
language sql stable security definer set search_path = ''
as $$
  select x.id, x.title, x.component, o.name, o.class_level, x.opens_at, x.closes_at, x.duration_min,
         (select count(*)::int from public.exam_questions q where q.exam_id = x.id),
         (select coalesce(sum(q.points), 0) from public.exam_questions q where q.exam_id = x.id),
         a.id, a.deadline, a.submitted_at,
         case when x.pushed_at is not null then a.score end, x.pushed_at is not null,
         x.unlocked_at is not null
  from public.online_exams x
  join public.course_offerings o on o.id = x.offering_id
  join public.semesters s on s.id = o.semester_id
  join public.academic_years y on y.id = s.year_id and y.is_active
  left join public.exam_attempts a on a.exam_id = x.id and a.member_id = public.current_member_id()
  where x.status = 'approved' and public.current_member_id() is not null
    and public.exam_eligible(x.id, public.current_member_id())
  order by x.opens_at
$$;
revoke all on function public.my_exams() from public, anon;
grant execute on function public.my_exams() to authenticated;

-- Start (or resume): only once the teacher has opened it, and before it closes.
create or replace function public.start_exam(p_exam uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare me uuid := public.current_member_id(); x public.online_exams; a public.exam_attempts; v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  select * into x from public.online_exams where id = p_exam;
  if x.id is null or not public.exam_eligible(p_exam, me) then raise exception 'exam_not_allowed' using errcode = 'P0001'; end if;
  select * into a from public.exam_attempts where exam_id = p_exam and member_id = me;
  if a.id is not null then
    if a.submitted_at is null and now() > a.deadline then perform public.exam_finish(a.id, true); end if;
    return a.id;
  end if;
  if x.unlocked_at is null then raise exception 'exam_not_open' using errcode = 'P0001'; end if;
  if now() >= x.closes_at then raise exception 'exam_closed' using errcode = 'P0001'; end if;
  insert into public.exam_attempts (exam_id, member_id, deadline)
  values (p_exam, me, least(now() + make_interval(mins => x.duration_min), x.closes_at))
  returning id into v;
  return v;
end $$;
revoke all on function public.start_exam(uuid) from public, anon;
grant execute on function public.start_exam(uuid) to authenticated;

-- ---------- duties: a department allocates a member's choice ----------
alter table public.duty_assignments
  add column if not exists from_choice uuid references public.duty_assignments (id) on delete set null;
create index if not exists duty_from_choice on public.duty_assignments (from_choice) where from_choice is not null;

-- choosing a job = taking part in “በተለያዩ አገልግሎቶች”
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
  insert into public.member_programs (member_id, program, status) values (me, 'duty', 'active')
  on conflict (member_id, program) do update set status = 'active';
  insert into public.duty_assignments (member_id, dept, duty, duty_date, occasion, source, accepted_at)
  values (me, null, btrim(p_duty), p_date, btrim(p_occasion), 'chosen', now())
  returning id into v;
  return v;
end $$;
revoke all on function public.choose_duty(text, text, date) from public, anon;
grant execute on function public.choose_duty(text, text, date) to authenticated;

-- the member sees which department took up their choice
drop function public.my_duties();
create or replace function public.my_duties()
returns table (id uuid, dept text, duty text, duty_date date, occasion text, status text, source text, accepted_at timestamptz,
               allocated_dept text, from_choice uuid)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.dept, d.duty, d.duty_date, d.occasion, d.status, d.source, d.accepted_at,
         (select g.dept from public.duty_assignments g where g.from_choice = d.id order by g.assigned_at desc limit 1),
         d.from_choice
  from public.duty_assignments d
  where d.member_id = public.current_member_id()
  order by d.duty_date desc
  limit 80;
$$;
revoke all on function public.my_duties() from public, anon;
grant execute on function public.my_duties() to authenticated;

-- participation: a choice that a department allocated counts once (as the given job)
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
      and not (d.source = 'chosen' and exists (select 1 from public.duty_assignments g where g.from_choice = d.id))
      and (p_member is null or d.member_id = p_member)
      and (p_from is null or d.duty_date >= p_from) and (p_to is null or d.duty_date <= p_to)
    group by d.member_id
  ) x
  group by x.member_id, x.area;
end $$;
revoke all on function public.participation(uuid, date, date) from public, anon;
grant execute on function public.participation(uuid, date, date) to authenticated;

-- ---------- results go to ትምህርት ክፍል only when every student has every mark (0 or more) ----------
create or replace function public.guard_offering()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare s public.semesters;
begin
  if public.is_service_role() then return new; end if;
  if new.status = old.status then
    if (new.name, new.class_level, new.semester_id, new.book_path, new.book_name, new.days, new.time_text)
       is distinct from (old.name, old.class_level, old.semester_id, old.book_path, old.book_name, old.days, old.time_text)
       and not public.has_dept('education') then
      raise exception 'only ትምህርት ክፍል edits courses';
    end if;
    new.submitted_at := old.submitted_at; new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    return new;
  end if;
  if old.status = 'draft' and new.status = 'submitted' then
    if not (public.is_teacher_of(old.id) or public.has_dept('education')) then raise exception 'only the teacher submits'; end if;
    select * into s from public.semesters where id = old.semester_id;
    if exists (
      select 1 from public.enrollments e
      left join public.marks m on m.offering_id = old.id and m.member_id = e.member_id
      where e.year_id = s.year_id and e.class_level = old.class_level
        and not exists (select 1 from public.offering_teachers t where t.offering_id = old.id and t.member_id = e.member_id)
        and ( (s.w_quiz > 0 and m.quiz is null) or (s.w_notebook > 0 and m.notebook is null)
           or (s.w_participation > 0 and m.participation is null) or (s.w_mid > 0 and m.mid is null) )
    ) then
      raise exception 'marks_missing' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.enrollments e
      left join public.marks m on m.offering_id = old.id and m.member_id = e.member_id
      where e.year_id = s.year_id and e.class_level = old.class_level and m.final is null
        and not exists (select 1 from public.offering_teachers t where t.offering_id = old.id and t.member_id = e.member_id)
        and not public.final_barred(old.id, e.member_id)
        and not exists (select 1 from public.makeup_grants g where g.offering_id = old.id and g.member_id = e.member_id and g.used_at is null)
    ) then
      raise exception 'finals_missing' using errcode = 'P0001';
    end if;
    new.submitted_at := now();
  elsif old.status = 'submitted' and new.status = 'approved' then
    if not public.has_dept('education') then raise exception 'only ትምህርት ክፍል approves'; end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  elsif new.status = 'draft' and old.status in ('submitted', 'approved') then
    if not public.has_dept('education') then raise exception 'only ትምህርት ክፍል unlocks'; end if;
    if not exists (select 1 from public.offering_unlocks u where u.offering_id = old.id and u.created_at > now() - interval '1 minute') then
      raise exception 'unlock_reason_required' using errcode = 'P0001';
    end if;
    new.approved_by := null; new.approved_at := null; new.submitted_at := null;
  else
    raise exception 'invalid status change % → %', old.status, new.status;
  end if;
  return new;
end $$;
