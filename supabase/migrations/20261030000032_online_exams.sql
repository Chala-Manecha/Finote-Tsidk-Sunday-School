-- =====================================================================
-- Round 14 (b): online exams. A teacher prepares a quiz / mid / final for
-- one of their courses; ትምህርት ክፍል approves it; the class's students sit
-- it in a time window with a per-student countdown; choice / true-false /
-- blank / matching are marked automatically, the teacher can adjust any
-- question, then sends the result to the course mark sheet.
-- Students never read the questions table: the paper comes through
-- exam_paper() without answers, and answers go in through the RPCs below.
-- =====================================================================

create table public.online_exams (
  id            uuid primary key default gen_random_uuid(),
  offering_id   uuid not null references public.course_offerings (id) on delete cascade,
  component     text not null check (component in ('quiz', 'mid', 'final')),
  title         text not null check (length(btrim(title)) between 2 and 160),
  instructions  text check (instructions is null or length(instructions) <= 2000),
  duration_min  int not null check (duration_min between 1 and 300),
  opens_at      timestamptz not null,
  closes_at     timestamptz not null,
  status        text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  review_note   text check (review_note is null or length(review_note) <= 500),
  submitted_at  timestamptz,
  approved_by   uuid references auth.users (id) on delete set null,
  approved_at   timestamptz,
  pushed_at     timestamptz,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index online_exams_offering_idx on public.online_exams (offering_id);
create index online_exams_status_idx on public.online_exams (status, opens_at);
create trigger trg_online_exams_updated before update on public.online_exams
  for each row execute function public.set_updated_at();

create table public.exam_questions (
  id        uuid primary key default gen_random_uuid(),
  exam_id   uuid not null references public.online_exams (id) on delete cascade,
  sort      int not null default 0,
  kind      text not null check (kind in ('choice', 'tf', 'blank', 'match')),
  prompt    text not null check (length(btrim(prompt)) between 1 and 2000),
  points    numeric(6,2) not null check (points > 0 and points <= 100),
  -- choice: ["A", "B", …]                         answer: index of the right option
  -- tf:     []                                     answer: true | false
  -- blank:  []                                     answer: ["accepted", "also accepted", …]
  -- match:  {"left": [...], "right": [...]}        answer: [right index for each left]
  options   jsonb not null default '[]'::jsonb,
  answer    jsonb not null,
  created_at timestamptz not null default now()
);
create index exam_questions_exam_idx on public.exam_questions (exam_id, sort);

create table public.exam_attempts (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.online_exams (id) on delete cascade,
  member_id       uuid not null references public.members (id) on delete cascade,
  started_at      timestamptz not null default now(),
  deadline        timestamptz not null,
  submitted_at    timestamptz,
  auto_submitted  boolean not null default false,
  answers         jsonb not null default '{}'::jsonb,   -- {question id: answer}
  flags           jsonb not null default '[]'::jsonb,   -- [question id] the student marked to review
  left_count      int not null default 0,               -- times the student left the exam tab
  auto_points     jsonb,                                -- {question id: points} (computed)
  manual_points   jsonb not null default '{}'::jsonb,   -- {question id: points} (teacher's correction)
  score           numeric(7,2),
  unique (exam_id, member_id)
);
create index exam_attempts_member_idx on public.exam_attempts (member_id);

-- ---------- who may do what ----------
create or replace function public.exam_offering(p_exam uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select offering_id from public.online_exams where id = p_exam $$;
grant execute on function public.exam_offering(uuid) to authenticated;

create or replace function public.exam_editable(p_exam uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.online_exams e
                 where e.id = p_exam and e.status in ('draft', 'rejected') and public.is_teacher_of(e.offering_id))
$$;
grant execute on function public.exam_editable(uuid) to authenticated;

alter table public.online_exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
grant select, insert, update, delete on public.online_exams, public.exam_questions to authenticated;
grant select, update on public.exam_attempts to authenticated;

create policy online_exams_read on public.online_exams for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(offering_id));
create policy online_exams_insert on public.online_exams for insert to authenticated
  with check (public.is_teacher_of(offering_id) and status = 'draft');
create policy online_exams_update on public.online_exams for update to authenticated
  using (public.has_dept('education') or public.is_teacher_of(offering_id))
  with check (public.has_dept('education') or public.is_teacher_of(offering_id));
create policy online_exams_delete on public.online_exams for delete to authenticated
  using (public.is_teacher_of(offering_id) and status in ('draft', 'rejected')
         and not exists (select 1 from public.exam_attempts a where a.exam_id = online_exams.id));

create policy exam_questions_read on public.exam_questions for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(public.exam_offering(exam_id)));
create policy exam_questions_write on public.exam_questions for all to authenticated
  using (public.exam_editable(exam_id)) with check (public.exam_editable(exam_id));

create policy exam_attempts_read on public.exam_attempts for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(public.exam_offering(exam_id)));
create policy exam_attempts_mark on public.exam_attempts for update to authenticated
  using (public.is_teacher_of(public.exam_offering(exam_id)))
  with check (public.is_teacher_of(public.exam_offering(exam_id)));

-- Status flow: teacher draft/rejected → submitted (or takes it back to draft);
-- ትምህርት ክፍል submitted → approved / rejected, approved → draft only while nobody has started.
-- Content can change only while draft / rejected.
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
  end if;
  if new.review_note is distinct from old.review_note and not edu and new.status = old.status then
    raise exception 'exam_status' using errcode = 'P0001';
  end if;
  if new.pushed_at is distinct from old.pushed_at and not (teacher and new.status = 'approved') then
    raise exception 'exam_status' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_guard_online_exam before update on public.online_exams
  for each row execute function public.guard_online_exam();

-- ---------- marking ----------
create or replace function public.exam_norm(t text)
returns text language sql immutable set search_path = ''
as $$ select lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g')) $$;

create or replace function public.exam_question_points(q public.exam_questions, given jsonb)
returns numeric language plpgsql immutable set search_path = ''
as $$
declare n int; ok int := 0; i int;
begin
  if given is null or given = 'null'::jsonb then return 0; end if;
  if q.kind in ('choice', 'tf') then
    return case when given = q.answer then q.points else 0 end;
  elsif q.kind = 'blank' then
    return case when exists (select 1 from jsonb_array_elements_text(q.answer) a
                             where public.exam_norm(a) = public.exam_norm(given #>> '{}') and public.exam_norm(a) <> '')
                then q.points else 0 end;
  elsif q.kind = 'match' then
    n := jsonb_array_length(q.answer);
    if n = 0 or jsonb_typeof(given) <> 'array' then return 0; end if;
    for i in 0 .. n - 1 loop
      if given -> i = q.answer -> i then ok := ok + 1; end if;
    end loop;
    return round(q.points * ok / n, 2);
  end if;
  return 0;
end $$;

-- score = Σ (teacher's points if set, else automatic points)
-- (security invoker on purpose: current_user tells a teacher's direct update from the RPCs below)
create or replace function public.exam_attempt_score()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- Students change their attempt only through the RPCs below; teachers only correct points.
  if current_user = 'authenticated'
     and (new.answers, new.flags, new.left_count, new.submitted_at, new.deadline, new.auto_points, new.member_id, new.exam_id)
         is distinct from (old.answers, old.flags, old.left_count, old.submitted_at, old.deadline, old.auto_points, old.member_id, old.exam_id) then
    raise exception 'only points can be corrected';
  end if;
  if new.submitted_at is not null and new.auto_points is not null then
    select round(sum(case when new.manual_points ? q.id::text then least(greatest((new.manual_points ->> q.id::text)::numeric, 0), q.points)
                          else coalesce((new.auto_points ->> q.id::text)::numeric, 0) end), 2)
      into new.score
    from public.exam_questions q where q.exam_id = new.exam_id;
  end if;
  return new;
end $$;
create trigger trg_exam_attempt_score before update on public.exam_attempts
  for each row execute function public.exam_attempt_score();

create or replace function public.exam_finish(p_attempt uuid, p_auto boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt for update;
  if a.submitted_at is not null then return; end if;
  update public.exam_attempts set
    submitted_at = least(now(), a.deadline),
    auto_submitted = p_auto,
    auto_points = (select coalesce(jsonb_object_agg(q.id::text, public.exam_question_points(q, a.answers -> q.id::text)), '{}'::jsonb)
                   from public.exam_questions q where q.exam_id = a.exam_id)
  where id = p_attempt;
end $$;
revoke all on function public.exam_finish(uuid, boolean) from public, anon, authenticated;

-- ---------- who may sit it ----------
create or replace function public.exam_eligible(p_exam uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.online_exams x
    join public.course_offerings o on o.id = x.offering_id
    join public.semesters s on s.id = o.semester_id
    join public.enrollments e on e.year_id = s.year_id and e.member_id = p_member and e.class_level = o.class_level
    where x.id = p_exam and x.status = 'approved'
      and not exists (select 1 from public.offering_teachers t where t.offering_id = o.id and t.member_id = p_member)
      and not (x.component = 'final' and public.final_barred(o.id, p_member)))
$$;
revoke all on function public.exam_eligible(uuid, uuid) from public, anon;
grant execute on function public.exam_eligible(uuid, uuid) to authenticated;

-- The signed-in student's exams (current year): open, upcoming and done.
create or replace function public.my_exams()
returns table (id uuid, title text, component text, course text, class_level text, opens_at timestamptz, closes_at timestamptz,
               duration_min int, questions int, total_points numeric, attempt_id uuid, deadline timestamptz,
               submitted_at timestamptz, score numeric, released boolean)
language sql stable security definer set search_path = ''
as $$
  select x.id, x.title, x.component, o.name, o.class_level, x.opens_at, x.closes_at, x.duration_min,
         (select count(*)::int from public.exam_questions q where q.exam_id = x.id),
         (select coalesce(sum(q.points), 0) from public.exam_questions q where q.exam_id = x.id),
         a.id, a.deadline, a.submitted_at,
         case when x.pushed_at is not null then a.score end, x.pushed_at is not null
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

-- Start (or resume) — the clock is the student's own: duration from the first start, never past closing time.
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
  if now() < x.opens_at then raise exception 'exam_not_open' using errcode = 'P0001'; end if;
  if now() >= x.closes_at then raise exception 'exam_closed' using errcode = 'P0001'; end if;
  insert into public.exam_attempts (exam_id, member_id, deadline)
  values (p_exam, me, least(now() + make_interval(mins => x.duration_min), x.closes_at))
  returning id into v;
  return v;
end $$;
revoke all on function public.start_exam(uuid) from public, anon;
grant execute on function public.start_exam(uuid) to authenticated;

-- The paper without answers; questions (and choices / matching options) in a per-student order.
create or replace function public.exam_paper(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.exam_attempts; x public.online_exams; o public.course_offerings;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if a.id is null or a.member_id is distinct from public.current_member_id() then raise exception 'exam_not_allowed' using errcode = 'P0001'; end if;
  if a.submitted_at is null and now() > a.deadline then perform public.exam_finish(a.id, true); select * into a from public.exam_attempts where id = p_attempt; end if;
  select * into x from public.online_exams where id = a.exam_id;
  select * into o from public.course_offerings where id = x.offering_id;
  return jsonb_build_object(
    'attempt', a.id, 'title', x.title, 'component', x.component, 'course', o.name, 'instructions', x.instructions,
    'duration_min', x.duration_min, 'deadline', a.deadline, 'now', now(), 'submitted', a.submitted_at is not null,
    'answers', a.answers, 'flags', a.flags,
    'questions', case when a.submitted_at is not null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'points', q.points,
        'options', case q.kind
          when 'choice' then (select jsonb_agg(jsonb_build_object('i', t.i - 1, 't', t.v) order by md5(a.id::text || q.id::text || t.i))
                              from jsonb_array_elements_text(q.options) with ordinality t(v, i))
          when 'match' then jsonb_build_object(
            'left', q.options -> 'left',
            'right', (select jsonb_agg(jsonb_build_object('i', t.i - 1, 't', t.v) order by md5(a.id::text || 'r' || q.id::text || t.i))
                      from jsonb_array_elements_text(q.options -> 'right') with ordinality t(v, i)))
          else '[]'::jsonb end
      ) order by md5(a.id::text || q.id::text)), '[]'::jsonb)
      from public.exam_questions q where q.exam_id = a.exam_id) end);
end $$;
revoke all on function public.exam_paper(uuid) from public, anon;
grant execute on function public.exam_paper(uuid) to authenticated;

-- Saved as the student goes (and once more on submit). A short grace covers the network.
create or replace function public.save_exam_answers(p_attempt uuid, p_answers jsonb, p_flags jsonb, p_left int default null)
returns timestamptz language plpgsql security definer set search_path = ''
as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt for update;
  if a.id is null or a.member_id is distinct from public.current_member_id() then raise exception 'exam_not_allowed' using errcode = 'P0001'; end if;
  if a.submitted_at is not null then raise exception 'exam_submitted' using errcode = 'P0001'; end if;
  if now() > a.deadline + interval '20 seconds' then
    perform public.exam_finish(a.id, true);
    raise exception 'exam_time_up' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' or pg_column_size(p_answers) > 200000 then
    raise exception 'bad answers';
  end if;
  update public.exam_attempts set
    answers = coalesce(p_answers, answers),
    flags = case when jsonb_typeof(p_flags) = 'array' then p_flags else flags end,
    left_count = greatest(left_count, coalesce(p_left, 0))
  where id = p_attempt;
  return a.deadline;
end $$;
revoke all on function public.save_exam_answers(uuid, jsonb, jsonb, int) from public, anon;
grant execute on function public.save_exam_answers(uuid, jsonb, jsonb, int) to authenticated;

create or replace function public.submit_exam(p_attempt uuid, p_answers jsonb, p_flags jsonb, p_left int, p_auto boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if a.id is null or a.member_id is distinct from public.current_member_id() then raise exception 'exam_not_allowed' using errcode = 'P0001'; end if;
  if a.submitted_at is not null then return; end if;
  if now() <= a.deadline + interval '20 seconds' and p_answers is not null then
    perform public.save_exam_answers(p_attempt, p_answers, p_flags, p_left);
  end if;
  perform public.exam_finish(p_attempt, coalesce(p_auto, false) or now() > a.deadline);
end $$;
revoke all on function public.submit_exam(uuid, jsonb, jsonb, int, boolean) from public, anon;
grant execute on function public.submit_exam(uuid, jsonb, jsonb, int, boolean) to authenticated;

-- Teacher / ትምህርት ክፍል: submit every attempt whose time is up (students who closed the page).
create or replace function public.close_expired_attempts(p_exam uuid)
returns int language plpgsql security definer set search_path = ''
as $$
declare r record; n int := 0;
begin
  if not (public.is_teacher_of(public.exam_offering(p_exam)) or public.has_dept('education')) then raise exception 'not allowed'; end if;
  for r in select id from public.exam_attempts where exam_id = p_exam and submitted_at is null and now() > deadline + interval '20 seconds' loop
    perform public.exam_finish(r.id, true); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.close_expired_attempts(uuid) from public, anon;
grant execute on function public.close_expired_attempts(uuid) to authenticated;

-- The student's own marked paper, once the teacher has sent the result.
create or replace function public.my_exam_review(p_exam uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare a public.exam_attempts; x public.online_exams;
begin
  select * into x from public.online_exams where id = p_exam;
  select * into a from public.exam_attempts where exam_id = p_exam and member_id = public.current_member_id();
  if a.id is null or x.pushed_at is null or a.submitted_at is null then return null; end if;
  return jsonb_build_object('title', x.title, 'score', a.score,
    'total', (select sum(points) from public.exam_questions where exam_id = p_exam),
    'questions', (select jsonb_agg(jsonb_build_object('prompt', q.prompt, 'kind', q.kind, 'points', q.points,
        'options', q.options, 'answer', q.answer, 'given', a.answers -> q.id::text,
        'got', case when a.manual_points ? q.id::text then (a.manual_points ->> q.id::text)::numeric
                    else coalesce((a.auto_points ->> q.id::text)::numeric, 0) end) order by q.sort, q.created_at)
      from public.exam_questions q where q.exam_id = p_exam));
end $$;
revoke all on function public.my_exam_review(uuid) from public, anon;
grant execute on function public.my_exam_review(uuid) to authenticated;
