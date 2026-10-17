-- =====================================================================
-- አሳይመንት: teachers give assignments (instructions + points, usually /10),
-- students see them and their score at once (no approval needed). The
-- assignments of a course count in the semester total through a new
-- weight, w_assignment, set by ትምህርት ክፍል (የትምህርት ዘመን → ሴሚስተር).
-- =====================================================================

-- ---------- the weight ----------
alter table public.semesters add column if not exists w_assignment int not null default 0 check (w_assignment >= 0);
alter table public.semesters drop constraint if exists semesters_check;
alter table public.semesters add constraint semesters_weights_check
  check (w_quiz + w_notebook + w_participation + w_assignment + w_mid + w_final = 100);

-- ---------- the computed column on the mark sheet ----------
alter table public.marks add column if not exists assignment numeric(5,2) check (assignment >= 0);

create or replace function public.guard_marks()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare o public.course_offerings; s public.semesters; g public.makeup_grants;
begin
  if public.is_service_role() then return new; end if;
  if tg_op = 'DELETE' then
    select * into o from public.course_offerings where id = old.offering_id;
    if o.status <> 'draft' then raise exception 'marks_locked' using errcode = 'P0001'; end if;
    return old;
  end if;
  select * into o from public.course_offerings where id = new.offering_id;
  if new.member_id = public.current_member_id() then raise exception 'own_marks' using errcode = 'P0001'; end if;
  select * into s from public.semesters where id = o.semester_id;
  if not exists (select 1 from public.enrollments e where e.year_id = s.year_id and e.member_id = new.member_id and e.class_level = o.class_level) then
    raise exception 'not_in_class' using errcode = 'P0001';
  end if;

  if o.status <> 'draft' then
    -- after submission only a granted make-up final may be entered, once
    select * into g from public.makeup_grants where offering_id = new.offering_id and member_id = new.member_id and used_at is null;
    if not found then raise exception 'marks_locked' using errcode = 'P0001'; end if;
    if tg_op = 'UPDATE' and (new.quiz, new.notebook, new.participation, new.mid, new.assignment) is distinct from (old.quiz, old.notebook, old.participation, old.mid, old.assignment) then
      raise exception 'marks_locked' using errcode = 'P0001';
    end if;
    if new.final is null then raise exception 'marks_locked' using errcode = 'P0001'; end if;
    update public.makeup_grants set used_at = now() where offering_id = new.offering_id and member_id = new.member_id;
    new.makeup := true;
  else
    new.makeup := coalesce(old.makeup, false) and tg_op = 'UPDATE';
  end if;

  if new.final is not null and (tg_op = 'INSERT' or new.final is distinct from old.final)
     and public.final_barred(new.offering_id, new.member_id) then
    raise exception 'low_attendance' using errcode = 'P0001';
  end if;
  if new.quiz > s.w_quiz or new.notebook > s.w_notebook or new.participation > s.w_participation
     or new.mid > s.w_mid or new.final > s.w_final or new.assignment > s.w_assignment + 0.001 then
    raise exception 'over_weight' using errcode = 'P0001';
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;

-- ---------- assignments ----------
create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  title        text not null check (length(btrim(title)) between 2 and 160),
  instructions text check (instructions is null or length(instructions) <= 8000),
  max_points   numeric(5,2) not null default 10 check (max_points > 0 and max_points <= 100),
  due_on       date,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index assignments_offering_idx on public.assignments (offering_id);

create table public.assignment_scores (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  score         numeric(5,2) check (score >= 0),
  note          text check (note is null or length(note) <= 300),
  updated_at    timestamptz not null default now(),
  primary key (assignment_id, member_id)
);

-- the student is in the class of this course
create or replace function public.in_offering_class(p_offering uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.course_offerings o join public.semesters s on s.id = o.semester_id
                 join public.enrollments e on e.year_id = s.year_id and e.class_level = o.class_level and e.member_id = p_member
                 where o.id = p_offering)
$$;
grant execute on function public.in_offering_class(uuid, uuid) to authenticated;

alter table public.assignments enable row level security;
alter table public.assignment_scores enable row level security;
grant select, insert, update, delete on public.assignments, public.assignment_scores to authenticated;

create policy assignments_read on public.assignments for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(offering_id)
         or public.in_offering_class(offering_id, public.current_member_id()));
create policy assignments_write on public.assignments for all to authenticated
  using (public.is_teacher_of(offering_id)) with check (public.is_teacher_of(offering_id));

create policy assignment_scores_read on public.assignment_scores for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or member_id = public.current_member_id()
         or exists (select 1 from public.assignments a where a.id = assignment_id and public.is_teacher_of(a.offering_id)));
create policy assignment_scores_write on public.assignment_scores for all to authenticated
  using (exists (select 1 from public.assignments a where a.id = assignment_id and public.is_teacher_of(a.offering_id)))
  with check (exists (select 1 from public.assignments a where a.id = assignment_id and public.is_teacher_of(a.offering_id))
              and member_id <> public.current_member_id());

-- a course that was sent for approval is locked; scores stay within the points; only the class's students
create or replace function public.guard_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare st public.offering_status;
begin
  if public.is_service_role() then return coalesce(new, old); end if;
  select o.status into st from public.course_offerings o where o.id = coalesce(new.offering_id, old.offering_id);
  if st <> 'draft' then raise exception 'marks_locked' using errcode = 'P0001'; end if;
  return coalesce(new, old);
end $$;
create trigger trg_guard_assignment before insert or update or delete on public.assignments
  for each row execute function public.guard_assignment();

create or replace function public.guard_assignment_score()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare a public.assignments; st public.offering_status;
begin
  if public.is_service_role() then return coalesce(new, old); end if;
  select * into a from public.assignments where id = coalesce(new.assignment_id, old.assignment_id);
  select o.status into st from public.course_offerings o where o.id = a.offering_id;
  if st <> 'draft' then raise exception 'marks_locked' using errcode = 'P0001'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.score > a.max_points then raise exception 'over_weight' using errcode = 'P0001'; end if;
  if not public.in_offering_class(a.offering_id, new.member_id) then raise exception 'not_in_class' using errcode = 'P0001'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_guard_assignment_score before insert or update or delete on public.assignment_scores
  for each row execute function public.guard_assignment_score();

-- marks.assignment = (Σ score ÷ Σ points of the course's assignments) × w_assignment; a missing score counts 0
create or replace function public.recompute_assignment_marks(p_offering uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare o public.course_offerings; w int; pts numeric;
begin
  select * into o from public.course_offerings where id = p_offering;
  if not found or o.status <> 'draft' then return; end if;
  select s.w_assignment into w from public.semesters s where s.id = o.semester_id;
  select sum(a.max_points) into pts from public.assignments a where a.offering_id = p_offering;
  if pts is null then
    update public.marks set assignment = null where offering_id = p_offering and assignment is not null;
    return;
  end if;
  insert into public.marks (offering_id, member_id, assignment)
  select p_offering, e.member_id,
         round(coalesce((select sum(sc.score) from public.assignment_scores sc join public.assignments a on a.id = sc.assignment_id
                         where a.offering_id = p_offering and sc.member_id = e.member_id), 0) / pts * w, 2)
  from public.semesters s
  join public.enrollments e on e.year_id = s.year_id and e.class_level = o.class_level
  where s.id = o.semester_id
    and (exists (select 1 from public.assignment_scores sc join public.assignments a on a.id = sc.assignment_id
                 where a.offering_id = p_offering and sc.member_id = e.member_id)
         or exists (select 1 from public.marks m where m.offering_id = p_offering and m.member_id = e.member_id))
  on conflict (offering_id, member_id) do update set assignment = excluded.assignment
  where public.marks.assignment is distinct from excluded.assignment;
end $$;
revoke all on function public.recompute_assignment_marks(uuid) from public, anon, authenticated;

create or replace function public.after_assignment_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'assignments' then
    perform public.recompute_assignment_marks(coalesce(new.offering_id, old.offering_id));
  else
    perform public.recompute_assignment_marks((select a.offering_id from public.assignments a where a.id = coalesce(new.assignment_id, old.assignment_id)));
  end if;
  return null;
end $$;
create trigger trg_assignments_recompute after insert or update of max_points or delete on public.assignments
  for each row execute function public.after_assignment_change();
create trigger trg_assignment_scores_recompute after insert or update or delete on public.assignment_scores
  for each row execute function public.after_assignment_change();

-- a new weight → open courses of that semester are recomputed
create or replace function public.after_semester_weight()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare o record;
begin
  for o in select id from public.course_offerings where semester_id = new.id and status = 'draft' loop
    perform public.recompute_assignment_marks(o.id);
  end loop;
  return null;
end $$;
create trigger trg_semester_weight_recompute after update of w_assignment on public.semesters
  for each row execute function public.after_semester_weight();

-- ---------- results include the assignments ----------
drop function if exists public.semester_results(uuid, text);
create or replace function public.semester_results(p_semester uuid, p_class text)
returns table (member_id uuid, full_name text, reg_no text, offering_id uuid, course text,
               quiz numeric, notebook numeric, participation numeric, assignment numeric, mid numeric, final numeric,
               total numeric, attended int, sessions int, status public.offering_status,
               average numeric, rank int, class_size int, ready boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare s public.semesters; me uuid := public.current_member_id();
begin
  select * into s from public.semesters where id = p_semester;
  if not found then return; end if;
  if not (public.has_any_dept(array['education', 'audit'])
          or exists (select 1 from public.enrollments e where e.year_id = s.year_id and e.member_id = me and e.class_level = p_class)) then
    raise exception 'not permitted';
  end if;
  return query
  with stu as (
    select e.member_id, m.full_name, m.reg_no from public.enrollments e
    join public.members m on m.id = e.member_id
    where e.year_id = s.year_id and e.class_level = p_class
  ),
  offs as (select o.id, o.name, o.status from public.course_offerings o where o.semester_id = p_semester and o.class_level = p_class),
  cells as (
    select st.member_id, st.full_name, st.reg_no, o.id as offering_id, o.name as course, o.status,
           mk.quiz, mk.notebook, mk.participation, mk.assignment, mk.mid, mk.final,
           coalesce(mk.quiz, 0) + coalesce(mk.notebook, 0) + coalesce(mk.participation, 0) + coalesce(mk.assignment, 0) + coalesce(mk.mid, 0) + coalesce(mk.final, 0) as total,
           (select count(*)::int from public.class_attendance a join public.class_sessions cs on cs.id = a.session_id
             where cs.offering_id = o.id and a.member_id = st.member_id and a.status in ('present', 'half')) as attended,
           (select count(*)::int from public.class_sessions cs where cs.offering_id = o.id) as sessions
    from stu st cross join offs o
    left join public.marks mk on mk.offering_id = o.id and mk.member_id = st.member_id
  ),
  avgs as (
    select c.member_id, round(avg(c.total), 2) as average from cells c group by c.member_id
  ),
  ranked as (
    select a.member_id, a.average, (rank() over (order by a.average desc))::int as rnk from avgs a
  )
  -- staff see everything; a student sees a course's marks once it is approved,
  -- and their average/rank only when the whole semester is approved
  select c.member_id, c.full_name, c.reg_no, c.offering_id, c.course,
         case when st_ok or c.status = 'approved' then c.quiz end,
         case when st_ok or c.status = 'approved' then c.notebook end,
         case when st_ok or c.status = 'approved' then c.participation end,
         case when st_ok or c.status = 'approved' then c.assignment end,
         case when st_ok or c.status = 'approved' then c.mid end,
         case when st_ok or c.status = 'approved' then c.final end,
         case when st_ok or c.status = 'approved' then c.total end,
         c.attended, c.sessions, c.status,
         case when st_ok or all_ok then r.average end,
         case when st_ok or all_ok then r.rnk end,
         (select count(*)::int from stu),
         all_ok
  from cells c join ranked r on r.member_id = c.member_id
  cross join (select public.has_any_dept(array['education', 'audit']) as st_ok,
                     (select count(*) > 0 and bool_and(o.status = 'approved') from offs o) as all_ok) f
  where public.has_any_dept(array['education', 'audit']) or c.member_id = me
  order by r.rnk, c.full_name, c.course;
end $$;
revoke all on function public.semester_results(uuid, text) from public, anon;
grant execute on function public.semester_results(uuid, text) to authenticated;

create or replace function public.year_results(p_year uuid, p_class text)
returns table (member_id uuid, full_name text, reg_no text, sem1_average numeric, sem2_average numeric,
               year_average numeric, failed_courses int, rank int, class_size int,
               auto_decision text, decision text, remark text, ready boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare y public.academic_years; me uuid := public.current_member_id(); st_ok boolean := public.has_any_dept(array['education', 'audit']);
begin
  select * into y from public.academic_years where id = p_year;
  if not found then return; end if;
  if not (st_ok or exists (select 1 from public.enrollments e where e.year_id = p_year and e.member_id = me and e.class_level = p_class)) then
    raise exception 'not permitted';
  end if;
  return query
  with stu as (
    select e.member_id, m.full_name, m.reg_no from public.enrollments e
    join public.members m on m.id = e.member_id
    where e.year_id = p_year and e.class_level = p_class
  ),
  sems as (select s.id, s.no, s.pass_mark from public.semesters s where s.year_id = p_year),
  offs as (
    select o.id, o.status, sm.no, sm.pass_mark from public.course_offerings o join sems sm on sm.id = o.semester_id
    where o.class_level = p_class
  ),
  cells as (
    select st.member_id, o.no, o.pass_mark,
           coalesce(mk.quiz, 0) + coalesce(mk.notebook, 0) + coalesce(mk.participation, 0) + coalesce(mk.assignment, 0) + coalesce(mk.mid, 0) + coalesce(mk.final, 0) as total
    from stu st cross join offs o
    left join public.marks mk on mk.offering_id = o.id and mk.member_id = st.member_id
  ),
  per as (
    select c.member_id,
           round(avg(c.total) filter (where c.no = 1), 2) as s1,
           round(avg(c.total) filter (where c.no = 2), 2) as s2,
           count(*) filter (where c.total < c.pass_mark)::int as failed
    from cells c group by c.member_id
  ),
  yr as (
    select p.member_id, p.s1, p.s2, p.failed,
           round((coalesce(p.s1, 0) + coalesce(p.s2, 0)) / nullif((p.s1 is not null)::int + (p.s2 is not null)::int, 0), 2) as ya
    from per p
  ),
  ranked as (select yr.*, (rank() over (order by yr.ya desc nulls last))::int as rnk from yr),
  flags as (select (select count(*) > 0 and bool_and(o.status = 'approved') from offs o)
                   and (select count(distinct o.no) = 2 from offs o) as all_ok)
  select st.member_id, st.full_name, st.reg_no,
         case when st_ok or f.all_ok then r.s1 end,
         case when st_ok or f.all_ok then r.s2 end,
         case when st_ok or f.all_ok then r.ya end,
         case when st_ok or f.all_ok then r.failed end,
         case when st_ok or f.all_ok then r.rnk end,
         (select count(*)::int from stu),
         case when r.ya >= y.promote_min_average and r.failed <= y.max_failed_courses then 'promoted' else 'repeat' end,
         case when st_ok or f.all_ok then coalesce(d.decision,
           case when r.ya >= y.promote_min_average and r.failed <= y.max_failed_courses then 'promoted' else 'repeat' end) end,
         case when st_ok or f.all_ok then d.remark end,
         f.all_ok
  from stu st join ranked r on r.member_id = st.member_id
  cross join flags f
  left join public.year_decisions d on d.year_id = p_year and d.member_id = st.member_id
  where st_ok or st.member_id = me
  order by r.rnk, st.full_name;
end $$;
revoke all on function public.year_results(uuid, text) from public, anon;
grant execute on function public.year_results(uuid, text) to authenticated;
