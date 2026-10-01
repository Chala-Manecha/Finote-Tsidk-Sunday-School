-- =====================================================================
-- Education extras: schedule + exam dates (public ኮርስ page), minimum
-- attendance for the final (with exemptions), make-up exams, year-end
-- promotion, year transcripts. Shop: bought/sold price and profit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schedule and exam dates
-- ---------------------------------------------------------------------
alter table public.semesters
  add column mid_exam_on     date,
  add column final_exam_on   date,
  add column min_attendance  int not null default 75 check (min_attendance between 0 and 100);  -- 0 = no minimum

alter table public.course_offerings
  add column days      smallint[] not null default '{}',   -- 0 = Sunday … 6 = Saturday
  add column time_text text;

-- Year-end promotion rule (set by ትምህርት ክፍል)
alter table public.academic_years
  add column promote_min_average  int not null default 50 check (promote_min_average between 0 and 100),
  add column max_failed_courses   int not null default 2 check (max_failed_courses >= 0);

/** Public: the active semester's courses per class with teachers and schedule. */
create or replace function public.public_course_catalog()
returns table (class_level text, course text, teachers text, days smallint[], time_text text,
               ec_year int, semester_no smallint, starts_on date, ends_on date, mid_exam_on date, final_exam_on date)
language sql stable security definer set search_path = ''
as $$
  select o.class_level, o.name,
         (select string_agg(m.full_name, '፣ ' order by m.full_name) from public.offering_teachers t
            join public.members m on m.id = t.member_id where t.offering_id = o.id),
         o.days, o.time_text, y.ec_year, s.no, s.starts_on, s.ends_on, s.mid_exam_on, s.final_exam_on
  from public.semesters s
  join public.academic_years y on y.id = s.year_id
  join public.course_offerings o on o.semester_id = s.id
  where s.is_active
  order by o.class_level, o.name
$$;
grant execute on function public.public_course_catalog() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Minimum attendance for the final, exemptions, make-up exams
-- ---------------------------------------------------------------------
/** % of a course's class meetings a student attended (null when none held yet). */
create or replace function public.attendance_pct(p_offering uuid, p_member uuid)
returns numeric language sql stable security definer set search_path = ''
as $$
  select case when count(cs.id) = 0 then null
              else round(100.0 * count(*) filter (where a.status in ('present', 'half')) / count(cs.id), 1) end
  from public.class_sessions cs
  left join public.class_attendance a on a.session_id = cs.id and a.member_id = p_member
  where cs.offering_id = p_offering
    and (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(p_offering) or p_member = public.current_member_id())
$$;
grant execute on function public.attendance_pct(uuid, uuid) to authenticated;

create table public.final_exemptions (
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  reason       text not null check (length(btrim(reason)) > 2),
  granted_by   uuid references auth.users (id) on delete set null,
  granted_at   timestamptz not null default now(),
  primary key (offering_id, member_id)
);

create table public.makeup_grants (
  offering_id  uuid not null references public.course_offerings (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  reason       text not null check (length(btrim(reason)) > 2),
  granted_by   uuid references auth.users (id) on delete set null,
  granted_at   timestamptz not null default now(),
  used_at      timestamptz,
  primary key (offering_id, member_id)
);

create or replace function public.stamp_granter()
returns trigger language plpgsql as $$
begin
  new.granted_by := auth.uid(); new.granted_at := now();
  return new;
end $$;
create trigger trg_final_exemptions_granter before insert on public.final_exemptions
  for each row execute function public.stamp_granter();
create trigger trg_makeup_grants_granter before insert on public.makeup_grants
  for each row execute function public.stamp_granter();

alter table public.final_exemptions enable row level security;
alter table public.makeup_grants enable row level security;
grant select, insert, delete on public.final_exemptions, public.makeup_grants to authenticated;
grant all on public.final_exemptions, public.makeup_grants to service_role;
create policy exemptions_read on public.final_exemptions for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(offering_id) or member_id = public.current_member_id());
create policy exemptions_write on public.final_exemptions for insert to authenticated with check (public.has_dept('education'));
create policy exemptions_delete on public.final_exemptions for delete to authenticated using (public.has_dept('education'));
create policy makeups_read on public.makeup_grants for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or public.is_teacher_of(offering_id) or member_id = public.current_member_id());
create policy makeups_write on public.makeup_grants for insert to authenticated with check (public.has_dept('education'));
create policy makeups_delete on public.makeup_grants for delete to authenticated using (public.has_dept('education') and used_at is null);

alter table public.marks add column makeup boolean not null default false;

/** Barred from the final: attendance below the minimum and no exemption. */
create or replace function public.final_barred(p_offering uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select s.min_attendance > 0
       and public.attendance_pct(p_offering, p_member) is not null
       and public.attendance_pct(p_offering, p_member) < s.min_attendance
       and not exists (select 1 from public.final_exemptions x where x.offering_id = p_offering and x.member_id = p_member)
       and not exists (select 1 from public.makeup_grants g where g.offering_id = p_offering and g.member_id = p_member)
    from public.course_offerings o join public.semesters s on s.id = o.semester_id
    where o.id = p_offering), false)
$$;
grant execute on function public.final_barred(uuid, uuid) to authenticated;

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
    if tg_op = 'UPDATE' and (new.quiz, new.notebook, new.participation, new.mid) is distinct from (old.quiz, old.notebook, old.participation, old.mid) then
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
     or new.mid > s.w_mid or new.final > s.w_final then
    raise exception 'over_weight' using errcode = 'P0001';
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;

-- Submission: every student needs a final, except those barred or waiting for a make-up
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
      where e.year_id = s.year_id and e.class_level = old.class_level and m.final is null
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

-- ---------------------------------------------------------------------
-- Year-end: both semesters, yearly average, rank, promotion
-- ---------------------------------------------------------------------
create table public.year_decisions (
  year_id     uuid not null references public.academic_years (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  decision    text not null check (decision in ('promoted', 'repeat')),
  remark      text,
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz not null default now(),
  primary key (year_id, member_id)
);
alter table public.year_decisions enable row level security;
grant select, insert, update, delete on public.year_decisions to authenticated;
grant all on public.year_decisions to service_role;
create policy year_decisions_read on public.year_decisions for select to authenticated
  using (public.has_any_dept(array['education', 'audit']) or member_id = public.current_member_id());
create policy year_decisions_write on public.year_decisions for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

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
           coalesce(mk.quiz, 0) + coalesce(mk.notebook, 0) + coalesce(mk.participation, 0) + coalesce(mk.mid, 0) + coalesce(mk.final, 0) as total
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

/** A student's history across years (for the year transcript). */
create or replace function public.student_history(p_member uuid)
returns table (ec_year int, class_level text, year_average numeric, decision text)
language plpgsql stable security definer set search_path = ''
as $$
declare e record; r record;
begin
  if not (public.has_any_dept(array['education', 'audit']) or p_member = public.current_member_id()) then
    raise exception 'not permitted';
  end if;
  for e in select en.year_id, en.class_level, y.ec_year from public.enrollments en
           join public.academic_years y on y.id = en.year_id
           where en.member_id = p_member and en.class_level is not null order by y.ec_year loop
    select x.year_average, x.decision into r from public.year_results(e.year_id, e.class_level) x where x.member_id = p_member;
    ec_year := e.ec_year; class_level := e.class_level; year_average := r.year_average; decision := r.decision;
    return next;
  end loop;
end $$;
revoke all on function public.student_history(uuid) from public, anon;
grant execute on function public.student_history(uuid) to authenticated;

-- Year transcripts share the transcripts table (semester_id null, year_id set)
alter table public.transcripts alter column semester_id drop not null;
alter table public.transcripts add column year_id uuid references public.academic_years (id) on delete cascade;
alter table public.transcripts add constraint transcripts_one_scope check ((semester_id is null) <> (year_id is null));
create unique index transcripts_year_member on public.transcripts (year_id, member_id) where year_id is not null;

create or replace function public.issue_year_transcript(p_year uuid, p_member uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v uuid; k text; i int := 0;
begin
  if not public.has_dept('education') then raise exception 'only ትምህርት ክፍል issues transcripts'; end if;
  select id into v from public.transcripts where year_id = p_year and member_id = p_member;
  if v is not null then return v; end if;
  loop
    k := private.code8('year-transcript|' || p_year || '|' || p_member || '|' || i);
    exit when not exists (select 1 from public.transcripts where code_key = k);
    i := i + 1;
  end loop;
  insert into public.transcripts (year_id, member_id, code_key, issued_by) values (p_year, p_member, k, auth.uid())
  returning id into v;
  return v;
end $$;
revoke all on function public.issue_year_transcript(uuid, uuid) from public, anon;
grant execute on function public.issue_year_transcript(uuid, uuid) to authenticated;

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
       left join public.semesters s on s.id = t.semester_id
       join public.academic_years y on y.id = coalesce(t.year_id, s.year_id)
       where t.code_key = k),
    jsonb_build_object('type', null));
end $$;

-- ---------------------------------------------------------------------
-- Shop: what each item cost, what it sells for, how many are sold
-- ---------------------------------------------------------------------
alter table public.sale_items
  add column buy_price  numeric(12,2) check (buy_price >= 0),
  add column sold_qty   int not null default 0 check (sold_qty >= 0),
  add column bought_on  date,
  add column sold_on    date;
alter table public.sale_items add constraint sale_items_sold_le_qty check (sold_qty <= qty);

-- The public shop sees names, prices and stock — not what the items cost us.
revoke select on public.sale_items from anon;
grant select (id, name, qty, sold_qty, price, description, image_path, created_at, updated_at) on public.sale_items to anon;
