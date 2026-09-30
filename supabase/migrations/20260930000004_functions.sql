-- =====================================================================
-- Views & RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- ወጪ ሪፖርት totals — refund / self-contribution always computed on read
-- security_invoker: callers only see rows RLS already lets them see
-- ---------------------------------------------------------------------
create or replace view public.money_request_totals
with (security_invoker = true) as
select
  r.id,
  r.dept,
  r.amount,
  r.status,
  coalesce(sum(e.amount), 0)                              as spent,
  greatest(r.amount - coalesce(sum(e.amount), 0), 0)      as refund,           -- ተመላሽ
  greatest(coalesce(sum(e.amount), 0) - r.amount, 0)      as self_contributed  -- ከራስ ወጪ
from public.money_requests r
left join public.expense_lines e on e.request_id = r.id
group by r.id;

grant select on public.money_request_totals to authenticated;

-- ---------------------------------------------------------------------
-- Public, contact-free projections (SECURITY DEFINER, read-only)
-- ---------------------------------------------------------------------

-- Feedback form: submitter picks their own name from this list
create or replace function public.public_member_names()
returns table (id uuid, full_name text)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.full_name
  from public.members m
  where m.is_active
  order by m.full_name;
$$;

-- Public የአባላት ምደባ page
create or replace function public.public_duty_roster(p_from date default null)
returns table (id uuid, full_name text, duty text, duty_date date, occasion text, dept text)
language sql stable security definer set search_path = ''
as $$
  select d.id, m.full_name, d.duty, d.duty_date, d.occasion, d.dept
  from public.duty_assignments d
  join public.members m on m.id = d.member_id
  where p_from is null or d.duty_date >= p_from
  order by d.duty_date, m.full_name;
$$;

revoke all on function public.public_member_names(), public.public_duty_roster(date) from public;
grant execute on function public.public_member_names(), public.public_duty_roster(date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Attendance RPCs (SECURITY INVOKER → RLS applies; one transaction)
-- p_statuses: {"<member uuid>": "present" | "half" | "absent", ...}
-- Every ACTIVE member gets a row; anyone not listed defaults to absent.
-- ---------------------------------------------------------------------
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
  where m.is_active;

  return v_id;
end $$;

create or replace function public.save_attendance(
  p_session  uuid,
  p_statuses jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.attendance (session_id, member_id, status)
  select p_session, (kv.key)::uuid, (kv.value #>> '{}')::public.attendance_status
  from jsonb_each(p_statuses) kv
  on conflict (session_id, member_id) do update set status = excluded.status;

  update public.attendance_sessions set updated_at = now() where id = p_session;
end $$;

-- HR የተዋሃደ ክትትል: one row per session type for a date range
create or replace function public.attendance_overview(p_from date, p_to date)
returns table (
  session_type public.session_type,
  dept text,
  sessions bigint,
  records bigint,
  absent bigint,
  half bigint,
  present bigint,
  absent_pct numeric
)
language sql stable security invoker set search_path = ''
as $$
  select t.session_type,
         case t.session_type
           when 'mezmur' then 'mezmur' when 'wereb' then 'mezmur'
           when 'course' then 'education' when 'abnet' then 'education'
           else 'hr' end,
         count(distinct s.id),
         count(a.session_id),
         count(*) filter (where a.status = 'absent'),
         count(*) filter (where a.status = 'half'),
         count(*) filter (where a.status = 'present'),
         case when count(a.session_id) = 0 then 0
              else round(100.0 * count(*) filter (where a.status = 'absent') / count(a.session_id), 1) end
  from unnest(enum_range(null::public.session_type)) as t(session_type)
  left join public.attendance_sessions s
         on s.session_type = t.session_type and s.session_date between p_from and p_to
  left join public.attendance a on a.session_id = s.id
  group by t.session_type
  order by t.session_type;
$$;

-- HR የአባል ክትትል ፍለጋ: absences per member + how many depts they were absent in
create or replace function public.member_absence_summary(p_from date, p_to date)
returns table (
  member_id uuid,
  full_name text,
  absent_days bigint,
  half_days bigint,
  absent_dept_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  select m.id, m.full_name,
         coalesce(x.absent_days, 0),
         coalesce(x.half_days, 0),
         coalesce(x.absent_dept_count, 0)
  from public.members m
  left join (
    select a.member_id,
           count(*) filter (where a.status = 'absent')                   as absent_days,
           count(*) filter (where a.status = 'half')                     as half_days,
           count(distinct s.dept) filter (where a.status = 'absent')     as absent_dept_count
    from public.attendance a
    join public.attendance_sessions s on s.id = a.session_id
    where s.session_date between p_from and p_to
    group by a.member_id
  ) x on x.member_id = m.id
  where m.is_active
  order by 3 desc, m.full_name;
$$;

revoke all on function
  public.create_attendance_session(public.session_type, date, time, jsonb, text),
  public.save_attendance(uuid, jsonb),
  public.attendance_overview(date, date),
  public.member_absence_summary(date, date)
from public, anon;
grant execute on function
  public.create_attendance_session(public.session_type, date, time, jsonb, text),
  public.save_attendance(uuid, jsonb),
  public.attendance_overview(date, date),
  public.member_absence_summary(date, date)
to authenticated;

-- ---------------------------------------------------------------------
-- Member registration / edit in one transaction (SECURITY INVOKER →
-- members/member_departments RLS applies: HR or ጽሕፈት ቤት only).
-- p_member: JSON object with members columns (id/created_* ignored)
-- p_depts : sub-membership department codes
-- ---------------------------------------------------------------------
create or replace function public.save_member(
  p_id     uuid,
  p_member jsonb,
  p_depts  text[]
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  r public.members;
  v_id uuid := p_id;
begin
  r := jsonb_populate_record(null::public.members, p_member);

  if v_id is null then
    insert into public.members (
      full_name, sex, title, work_status, member_status, dob, phone, email,
      telegram_username, sub_city, language, geez_level, is_ethiopian,
      nationality, prior_school, secular_school)
    values (
      trim(r.full_name), r.sex, r.title, r.work_status, coalesce(r.member_status, 'new'), r.dob,
      r.phone, r.email, r.telegram_username, r.sub_city, r.language,
      coalesce(r.geez_level, 'none'), coalesce(r.is_ethiopian, true),
      r.nationality, r.prior_school, r.secular_school)
    returning id into v_id;
  else
    update public.members set
      full_name = trim(r.full_name), sex = r.sex, title = r.title,
      work_status = r.work_status, member_status = coalesce(r.member_status, member_status),
      dob = r.dob, phone = r.phone, email = r.email,
      telegram_username = r.telegram_username, sub_city = r.sub_city,
      language = r.language, geez_level = coalesce(r.geez_level, geez_level),
      is_ethiopian = coalesce(r.is_ethiopian, is_ethiopian), nationality = r.nationality,
      prior_school = r.prior_school,
      secular_school = r.secular_school
    where id = v_id;
    if not found then raise exception 'member not found or not permitted'; end if;
    delete from public.member_departments where member_id = v_id;
  end if;

  insert into public.member_departments (member_id, dept)
  select v_id, d from unnest(coalesce(p_depts, '{}')) d
  on conflict do nothing;

  return v_id;
end $$;

revoke all on function public.save_member(uuid, jsonb, text[]) from public, anon;
grant execute on function public.save_member(uuid, jsonb, text[]) to authenticated;
