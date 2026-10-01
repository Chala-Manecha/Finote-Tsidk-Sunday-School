-- =====================================================================
-- Education: academic years, semesters, classes (ሕፃናት, 1ኛ–12ኛ),
-- courses with teachers and reference books, marks, class attendance,
-- approval, conduct, transcripts — plus member (student/teacher) logins.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Member logins (registration ID + PIN). The Supabase password is derived
-- from the PIN with the private key, so the PIN alone can't be tried
-- against the auth API; attempts are counted and lock at 5.
-- ---------------------------------------------------------------------
create table public.member_accounts (
  member_id        uuid primary key references public.members (id) on delete cascade,
  user_id          uuid not null unique references auth.users (id) on delete cascade,
  failed_attempts  int not null default 0,
  locked_at        timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.member_accounts enable row level security;
grant select on public.member_accounts to authenticated;
grant all on public.member_accounts to service_role;
create policy member_accounts_read on public.member_accounts for select to authenticated
  using (user_id = (select auth.uid()) or public.has_dept('education'));

/** The member behind the signed-in member login (null for staff/anon/locked). */
create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select a.member_id from public.member_accounts a
  join public.members m on m.id = a.member_id
  where a.user_id = (select auth.uid()) and a.locked_at is null and m.is_active
$$;
grant execute on function public.current_member_id() to authenticated, anon;

/** Server-only: the auth password for a member login. */
create or replace function public.member_password(p_reg_key text, p_pin text)
returns text language plpgsql stable security definer
set search_path = extensions, public, pg_temp
as $$
begin
  if not public.is_service_role() then raise exception 'server only'; end if;
  return encode(hmac('member|' || upper(p_reg_key) || '|' || p_pin, (select key from private.app_secret), 'sha256'), 'hex');
end $$;
revoke all on function public.member_password(text, text) from public, anon, authenticated;
grant execute on function public.member_password(text, text) to service_role;

/** Server-only: does this registration ID + phone belong to an active member? Returns id + name. */
create or replace function public.member_identify(p_reg text, p_phone text)
returns table (member_id uuid, full_name text, reg_key text, has_account boolean)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.full_name, m.reg_key, exists (select 1 from public.member_accounts a where a.member_id = m.id)
  from public.members m
  where public.is_service_role()
    and m.is_active
    and m.reg_key = public.code_key(p_reg)
    and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
    and right(regexp_replace(coalesce(m.phone, ''), '\D', '', 'g'), 9) = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
$$;
revoke all on function public.member_identify(text, text) from public, anon, authenticated;
grant execute on function public.member_identify(text, text) to service_role;

-- ---------------------------------------------------------------------
-- Academic years and semesters (ትምህርት ክፍል)
-- ---------------------------------------------------------------------
create table public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  ec_year    int not null unique check (ec_year between 2000 and 2100),
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index academic_years_one_active on public.academic_years (is_active) where is_active;

create table public.semesters (
  id               uuid primary key default gen_random_uuid(),
  year_id          uuid not null references public.academic_years (id) on delete cascade,
  no               smallint not null check (no in (1, 2)),
  starts_on        date,
  ends_on          date,
  w_quiz           int not null default 10 check (w_quiz >= 0),
  w_notebook       int not null default 10 check (w_notebook >= 0),
  w_participation  int not null default 10 check (w_participation >= 0),
  w_mid            int not null default 30 check (w_mid >= 0),
  w_final          int not null default 40 check (w_final >= 0),
  pass_mark        int not null default 50 check (pass_mark between 0 and 100),
  is_active        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (year_id, no),
  check (w_quiz + w_notebook + w_participation + w_mid + w_final = 100)
);
create unique index semesters_one_active on public.semesters (is_active) where is_active;

-- Classes: 'kids' = ሕፃናት ክፍል, '1'…'12'
create or replace function public.is_class_level(c text)
returns boolean language sql immutable set search_path = ''
as $$ select c in ('kids', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12') $$;

-- One row per member per academic year (self-registration or added by ትምህርት ክፍል)
create table public.enrollments (
  id            uuid primary key default gen_random_uuid(),
  year_id       uuid not null references public.academic_years (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  class_level   text check (class_level is null or public.is_class_level(class_level)),
  self_registered boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (year_id, member_id)
);
create index enrollments_class_idx on public.enrollments (year_id, class_level);

-- Courses per semester per class, with the reference book (private)
create type public.offering_status as enum ('draft', 'submitted', 'approved');
create table public.course_offerings (
  id            uuid primary key default gen_random_uuid(),
  semester_id   uuid not null references public.semesters (id) on delete cascade,
  class_level   text not null check (public.is_class_level(class_level)),
  name          text not null check (length(btrim(name)) > 1),
  book_path     text,
  book_name     text,
  status        public.offering_status not null default 'draft',
  submitted_at  timestamptz,
  approved_by   uuid references auth.users (id) on delete set null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (semester_id, class_level, name)
);

create table public.offering_teachers (
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete restrict,
  primary key (offering_id, member_id)
);

create table public.offering_unlocks (
  id           uuid primary key default gen_random_uuid(),
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  from_status  public.offering_status not null,
  reason       text not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create or replace function public.is_teacher_of(p_offering uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.offering_teachers t
                     where t.offering_id = p_offering and t.member_id = public.current_member_id()) $$;
grant execute on function public.is_teacher_of(uuid) to authenticated;

-- Marks: points out of each component's weight
create table public.marks (
  offering_id    uuid not null references public.course_offerings (id) on delete cascade,
  member_id      uuid not null references public.members (id) on delete cascade,
  quiz           numeric(5,2) check (quiz >= 0),
  notebook       numeric(5,2) check (notebook >= 0),
  participation  numeric(5,2) check (participation >= 0),
  mid            numeric(5,2) check (mid >= 0),
  final          numeric(5,2) check (final >= 0),
  updated_by     uuid references auth.users (id) on delete set null,
  updated_at     timestamptz not null default now(),
  primary key (offering_id, member_id)
);

-- Class attendance taken by the teacher, per course
create table public.class_sessions (
  id           uuid primary key default gen_random_uuid(),
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  session_date date not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (offering_id, session_date)
);
create table public.class_attendance (
  session_id  uuid not null references public.class_sessions (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  status      public.attendance_status not null,
  primary key (session_id, member_id)
);

-- Conduct / remarks per student per semester (ትምህርት ክፍል)
create table public.semester_conduct (
  semester_id  uuid not null references public.semesters (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  conduct      text check (conduct in ('A', 'B', 'C', 'D')),
  remark       text,
  primary key (semester_id, member_id)
);

-- Transcripts issued (code + print count)
create table public.transcripts (
  id           uuid primary key default gen_random_uuid(),
  semester_id  uuid not null references public.semesters (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  code_key     text not null unique,
  print_count  int not null default 0,
  issued_by    uuid references auth.users (id) on delete set null,
  issued_at    timestamptz not null default now(),
  unique (semester_id, member_id)
);
alter table public.transcripts add column code text generated always as (public.fmt_code('ፍጽ-ት-', code_key)) stored;

-- ---------------------------------------------------------------------
-- Integrity rules
-- ---------------------------------------------------------------------
-- A teacher can't be enrolled in the class they teach (same year).
create or replace function public.guard_offering_teacher()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.course_offerings o
    join public.semesters s on s.id = o.semester_id
    join public.enrollments e on e.year_id = s.year_id and e.class_level = o.class_level
    where o.id = new.offering_id and e.member_id = new.member_id
  ) then
    raise exception 'teacher_in_own_class' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_guard_offering_teacher before insert or update on public.offering_teachers
  for each row execute function public.guard_offering_teacher();

create or replace function public.guard_enrollment_class()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.class_level is not null and exists (
    select 1 from public.offering_teachers t
    join public.course_offerings o on o.id = t.offering_id
    join public.semesters s on s.id = o.semester_id
    where t.member_id = new.member_id and s.year_id = new.year_id and o.class_level = new.class_level
  ) then
    raise exception 'teacher_in_own_class' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_guard_enrollment_class before insert or update of class_level on public.enrollments
  for each row execute function public.guard_enrollment_class();

-- Marks: only in draft, never your own, within the weights, student must be in the class
create or replace function public.guard_marks()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare o public.course_offerings; s public.semesters;
begin
  if public.is_service_role() then return new; end if;
  if tg_op = 'DELETE' then
    select * into o from public.course_offerings where id = old.offering_id;
    if o.status <> 'draft' then raise exception 'marks_locked' using errcode = 'P0001'; end if;
    return old;
  end if;
  select * into o from public.course_offerings where id = new.offering_id;
  if o.status <> 'draft' then raise exception 'marks_locked' using errcode = 'P0001'; end if;
  if new.member_id = public.current_member_id() then raise exception 'own_marks' using errcode = 'P0001'; end if;
  select * into s from public.semesters where id = o.semester_id;
  if not exists (select 1 from public.enrollments e where e.year_id = s.year_id and e.member_id = new.member_id and e.class_level = o.class_level) then
    raise exception 'not_in_class' using errcode = 'P0001';
  end if;
  if new.quiz > s.w_quiz or new.notebook > s.w_notebook or new.participation > s.w_participation
     or new.mid > s.w_mid or new.final > s.w_final then
    raise exception 'over_weight' using errcode = 'P0001';
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
create trigger trg_guard_marks before insert or update or delete on public.marks
  for each row execute function public.guard_marks();

-- Offering status: teacher submits (all finals in), ትምህርት ክፍል approves / returns / unlocks
create or replace function public.guard_offering()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare s public.semesters;
begin
  if public.is_service_role() then return new; end if;
  if new.status = old.status then
    if (new.name, new.class_level, new.semester_id, new.book_path, new.book_name)
       is distinct from (old.name, old.class_level, old.semester_id, old.book_path, old.book_name)
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
      where e.year_id = s.year_id and e.class_level = old.class_level and m.final is null
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
create trigger trg_guard_offering before update on public.course_offerings
  for each row execute function public.guard_offering();

create trigger trg_class_sessions_creator before insert on public.class_sessions
  for each row execute function public.stamp_creator();
create trigger trg_offering_unlocks_creator before insert on public.offering_unlocks
  for each row execute function public.stamp_creator();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.enrollments enable row level security;
alter table public.course_offerings enable row level security;
alter table public.offering_teachers enable row level security;
alter table public.offering_unlocks enable row level security;
alter table public.marks enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_attendance enable row level security;
alter table public.semester_conduct enable row level security;
alter table public.transcripts enable row level security;

grant select on public.academic_years, public.semesters, public.course_offerings, public.offering_teachers to authenticated;
grant insert, update, delete on public.academic_years, public.semesters, public.course_offerings, public.offering_teachers to authenticated;
grant select, insert, update, delete on public.enrollments, public.marks, public.class_sessions,
  public.class_attendance, public.semester_conduct, public.transcripts to authenticated;
grant select, insert on public.offering_unlocks to authenticated;
grant all on public.academic_years, public.semesters, public.enrollments, public.course_offerings,
  public.offering_teachers, public.offering_unlocks, public.marks, public.class_sessions,
  public.class_attendance, public.semester_conduct, public.transcripts to service_role;

-- Structure: staff and members can read; ትምህርት ክፍል writes
create policy years_read on public.academic_years for select to authenticated
  using (public.is_staff() or public.current_member_id() is not null);
create policy years_write on public.academic_years for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));
create policy semesters_read on public.semesters for select to authenticated
  using (public.is_staff() or public.current_member_id() is not null);
create policy semesters_write on public.semesters for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));
create policy offerings_read on public.course_offerings for select to authenticated
  using (public.is_staff() or public.current_member_id() is not null);
create policy offerings_write on public.course_offerings for insert to authenticated
  with check (public.has_dept('education'));
create policy offerings_update on public.course_offerings for update to authenticated
  using (public.has_dept('education') or public.is_teacher_of(id))
  with check (public.has_dept('education') or public.is_teacher_of(id));
create policy offerings_delete on public.course_offerings for delete to authenticated
  using (public.has_dept('education') and status = 'draft');
create policy offering_teachers_read on public.offering_teachers for select to authenticated
  using (public.is_staff() or public.current_member_id() is not null);
create policy offering_teachers_write on public.offering_teachers for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));
create policy offering_unlocks_read on public.offering_unlocks for select to authenticated
  using (public.has_any_dept(array['education', 'audit']));
create policy offering_unlocks_insert on public.offering_unlocks for insert to authenticated
  with check (public.has_dept('education') and length(btrim(reason)) > 2);

-- Enrollments: ትምህርት ክፍል manages; members see their own; teachers see their class lists
create policy enrollments_read on public.enrollments for select to authenticated
  using (public.has_any_dept(array['education', 'hr', 'office', 'audit'])
         or member_id = public.current_member_id()
         or exists (select 1 from public.offering_teachers t
                    join public.course_offerings o on o.id = t.offering_id
                    join public.semesters s on s.id = o.semester_id
                    where t.member_id = public.current_member_id()
                      and s.year_id = enrollments.year_id and o.class_level = enrollments.class_level));
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

-- Marks: ትምህርት ክፍል / ኦዲት read all; teacher reads and writes their class (never own);
-- a student sees their own only after approval
create policy marks_read on public.marks for select to authenticated
  using (public.has_any_dept(array['education', 'audit'])
         or (public.is_teacher_of(offering_id) and member_id <> public.current_member_id())
         or (member_id = public.current_member_id()
             and exists (select 1 from public.course_offerings o where o.id = offering_id and o.status = 'approved')));
create policy marks_write on public.marks for insert to authenticated
  with check (public.is_teacher_of(offering_id) and member_id <> public.current_member_id());
create policy marks_update on public.marks for update to authenticated
  using (public.is_teacher_of(offering_id) and member_id <> public.current_member_id())
  with check (public.is_teacher_of(offering_id) and member_id <> public.current_member_id());
create policy marks_delete on public.marks for delete to authenticated
  using (public.is_teacher_of(offering_id));

-- helpers avoid policy recursion between class_sessions and class_attendance
create or replace function public.teaches_session(p_session uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.class_sessions cs where cs.id = p_session and public.is_teacher_of(cs.offering_id)) $$;
create or replace function public.attended_session(p_session uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.class_attendance a where a.session_id = p_session and a.member_id = public.current_member_id()) $$;
grant execute on function public.teaches_session(uuid), public.attended_session(uuid) to authenticated;

create policy class_sessions_read on public.class_sessions for select to authenticated
  using (public.has_any_dept(array['education', 'audit', 'hr']) or public.is_teacher_of(offering_id)
         or public.attended_session(id));
create policy class_sessions_write on public.class_sessions for all to authenticated
  using (public.is_teacher_of(offering_id)) with check (public.is_teacher_of(offering_id));
create policy class_attendance_read on public.class_attendance for select to authenticated
  using (public.has_any_dept(array['education', 'audit', 'hr']) or member_id = public.current_member_id()
         or public.teaches_session(session_id));
create policy class_attendance_write on public.class_attendance for all to authenticated
  using (public.teaches_session(session_id))
  with check (public.teaches_session(session_id) and member_id <> public.current_member_id());

create policy conduct_read on public.semester_conduct for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or member_id = public.current_member_id());
create policy conduct_write on public.semester_conduct for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

create policy transcripts_read on public.transcripts for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or member_id = public.current_member_id());
create policy transcripts_write on public.transcripts for update to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

-- ---------------------------------------------------------------------
-- Results: totals, rank, attendance, readiness (one source for staff,
-- the student dashboard and the transcript)
-- ---------------------------------------------------------------------
create or replace function public.semester_results(p_semester uuid, p_class text)
returns table (member_id uuid, full_name text, reg_no text, offering_id uuid, course text,
               quiz numeric, notebook numeric, participation numeric, mid numeric, final numeric,
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
           mk.quiz, mk.notebook, mk.participation, mk.mid, mk.final,
           coalesce(mk.quiz, 0) + coalesce(mk.notebook, 0) + coalesce(mk.participation, 0) + coalesce(mk.mid, 0) + coalesce(mk.final, 0) as total,
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

/** Student self-enrollment in the active academic year (class assigned later by ትምህርት ክፍል). */
create or replace function public.enroll_self()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare y uuid; me uuid := public.current_member_id(); v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  select id into y from public.academic_years where is_active;
  if y is null then raise exception 'no_active_year' using errcode = 'P0001'; end if;
  insert into public.enrollments (year_id, member_id, self_registered) values (y, me, true)
  on conflict (year_id, member_id) do nothing
  returning id into v;
  return v;
end $$;
revoke all on function public.enroll_self() from public, anon;
grant execute on function public.enroll_self() to authenticated;

/** ትምህርት ክፍል: issue (or fetch) the transcript code for a student and semester. */
create or replace function public.issue_transcript(p_semester uuid, p_member uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v uuid; k text; i int := 0;
begin
  if not public.has_dept('education') then raise exception 'only ትምህርት ክፍል issues transcripts'; end if;
  select id into v from public.transcripts where semester_id = p_semester and member_id = p_member;
  if v is not null then return v; end if;
  loop
    k := private.code8('transcript|' || p_semester || '|' || p_member || '|' || i);
    exit when not exists (select 1 from public.transcripts where code_key = k);
    i := i + 1;
  end loop;
  insert into public.transcripts (semester_id, member_id, code_key, issued_by) values (p_semester, p_member, k, auth.uid())
  returning id into v;
  return v;
end $$;
revoke all on function public.issue_transcript(uuid, uuid) from public, anon;
grant execute on function public.issue_transcript(uuid, uuid) to authenticated;

create or replace function public.mark_transcript_printed(p_id uuid)
returns int language plpgsql security definer set search_path = ''
as $$
declare v int;
begin
  update public.transcripts set print_count = print_count + 1
  where id = p_id and public.has_dept('education') returning print_count into v;
  return v;
end $$;
revoke all on function public.mark_transcript_printed(uuid) from public, anon;
grant execute on function public.mark_transcript_printed(uuid) to authenticated;

-- Public verification learns transcripts too
create or replace function public.verify_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare k text := public.code_key(p_code);
begin
  if length(k) <> 8 then return jsonb_build_object('type', null); end if;
  return coalesce(
    (select jsonb_build_object('type', 'receipt', 'code', r.code, 'amount', r.amount, 'payer', r.payer_name,
                               'purpose', r.purpose, 'issued_at', r.issued_at, 'voided', r.voided_at is not null)
       from public.receipts r where r.code_key = k),
    (select jsonb_build_object('type', 'voucher', 'code', q.voucher_no, 'amount', q.amount,
                               'dept', (select name_am from public.departments where code = q.dept),
                               'paid_at', q.paid_at, 'received', q.received_at is not null)
       from public.money_requests q where q.voucher_key = k),
    (select jsonb_build_object('type', 'certificate', 'code', d.cert_no, 'name', m.full_name,
                               'leave_date', d.leave_date, 'approved_at', d.decided_at,
                               'reinstated', d.reinstated_at is not null)
       from public.member_departures d join public.members m on m.id = d.member_id where d.cert_key = k),
    (select jsonb_build_object('type', 'transcript', 'code', t.code, 'name', m.full_name,
                               'year', y.ec_year, 'semester', s.no, 'issued_at', t.issued_at,
                               'class', (select e.class_level from public.enrollments e where e.year_id = y.id and e.member_id = m.id))
       from public.transcripts t join public.members m on m.id = t.member_id
       join public.semesters s on s.id = t.semester_id join public.academic_years y on y.id = s.year_id
       where t.code_key = k),
    jsonb_build_object('type', null));
end $$;

-- Lost-member watch now also counts class attendance taken by course teachers
create or replace function public.member_absence_watch()
returns table (member_id uuid, full_name text, reg_no text, phone text, telegram_username text,
               last_seen date, first_missed date, days_absent int, level text)
language sql stable security invoker set search_path = ''
as $$
  with att as (
    select s.session_date, a.member_id, a.status
    from public.attendance a join public.attendance_sessions s on s.id = a.session_id
    where s.session_type in ('mezmur', 'course')
    union all
    select cs.session_date, ca.member_id, ca.status
    from public.class_attendance ca join public.class_sessions cs on cs.id = ca.session_id
  ),
  days as (
    select session_date from public.attendance_sessions where session_type in ('mezmur', 'course')
    union
    select session_date from public.class_sessions
  ),
  s as (select session_date from days where session_date <= (now() at time zone 'Africa/Addis_Ababa')::date),
  latest as (select max(session_date) as d from s),
  seen as (
    select att.member_id, max(att.session_date) as d from att
    where att.status in ('present', 'half') group by att.member_id
  ),
  calc as (
    select m.id, m.full_name, m.reg_no, m.phone, m.telegram_username, seen.d as last_seen,
           (select min(s.session_date) from s
             where s.session_date > greatest(coalesce(seen.d, '-infinity'::date),
                                             (m.created_at at time zone 'Africa/Addis_Ababa')::date - 1)) as first_missed
    from public.members m left join seen on seen.member_id = m.id
    where m.is_active
  )
  select c.id, c.full_name, c.reg_no, c.phone, c.telegram_username, c.last_seen, c.first_missed,
         coalesce((select d from latest) - c.first_missed, 0) as days_absent,
         case when (select d from latest) - c.first_missed >= 30 then 'lost' else 'warning' end
  from calc c
  where (select d from latest) - c.first_missed >= 20
  order by 8 desc, c.full_name
$$;

-- ---------------------------------------------------------------------
-- Reference books: private bucket — ትምህርት ክፍል uploads, the course's teachers read
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('edu-books', 'edu-books', false, 52428800)
on conflict (id) do nothing;

create policy "edu-books read" on storage.objects for select to authenticated
  using (bucket_id = 'edu-books' and (
    public.has_dept('education')
    or exists (select 1 from public.course_offerings o
               where o.book_path = storage.objects.name and public.is_teacher_of(o.id))));
create policy "edu-books insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'edu-books' and public.has_dept('education'));
create policy "edu-books delete" on storage.objects for delete to authenticated
  using (bucket_id = 'edu-books' and public.has_dept('education'));

-- A member's own profile (members table is staff-only)
create or replace function public.my_member_profile()
returns table (full_name text, reg_no text, photo_path text, sex public.sex, joined_year int)
language sql stable security definer set search_path = ''
as $$ select m.full_name, m.reg_no, m.photo_path, m.sex, m.joined_year from public.members m where m.id = public.current_member_id() $$;
grant execute on function public.my_member_profile() to authenticated;

-- Names of a member's teachers and classmates are shown through these, never the members table.
create or replace function public.member_names(p_ids uuid[])
returns table (id uuid, full_name text, reg_no text)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.full_name, m.reg_no from public.members m
  where m.id = any (p_ids)
    and (public.is_staff() or public.current_member_id() is not null)
    and (public.is_staff()
         or m.id = public.current_member_id()
         -- teachers of any course (shown to students)
         or exists (select 1 from public.offering_teachers t where t.member_id = m.id)
         -- students in a class the caller teaches
         or exists (select 1 from public.enrollments e
                    join public.semesters s on s.year_id = e.year_id
                    join public.course_offerings o on o.semester_id = s.id and o.class_level = e.class_level
                    where e.member_id = m.id and public.is_teacher_of(o.id)))
$$;
grant execute on function public.member_names(uuid[]) to authenticated;

-- ትምህርት ክፍል may open member photos (for transcripts) — photos only, not other evidence files
create policy "member-docs photos for education" on storage.objects for select to authenticated
  using (bucket_id = 'member-docs' and public.has_dept('education')
         and exists (select 1 from public.members m where m.photo_path = storage.objects.name));
