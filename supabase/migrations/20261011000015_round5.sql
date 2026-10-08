-- =====================================================================
-- Round 5: membership type, age groups (ክፍል) set by HR, መደበኛ/የርቀት
-- study mode with its own attendance minimum, public self-registration
-- with HR approval. The registration date is always the save date.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Members: membership type, age group; drop the paper-form number
-- ---------------------------------------------------------------------
alter table public.members drop column doc_no;
alter table public.members
  add column member_type        text not null default 'regular'
                                 check (member_type in ('regular', 'special', 'honorary', 'other')),
  add column member_type_other  text,
  add column age_group          text;   -- code from public.age_groups, set from dob
alter table public.members
  add constraint member_type_other_given
    check (member_type <> 'other' or coalesce(length(btrim(member_type_other)), 0) > 0);
alter table public.members alter column registered_on set default ((now() at time zone 'Africa/Addis_Ababa')::date);

-- Age groups: HR sets the ranges (whole years, inclusive) and applies them.
create table public.age_groups (
  code     text primary key,
  name     text not null,
  min_age  int not null check (min_age between 0 and 120),
  max_age  int check (max_age is null or max_age between 0 and 120),
  sort     int not null default 0,
  check (max_age is null or max_age >= min_age)
);
insert into public.age_groups (code, name, min_age, max_age, sort) values
  ('children', 'ሕፃናት ክፍል',   0, 10, 1),
  ('middle',   'ማዕከላዊ ክፍል', 11, 17, 2),
  ('youth',    'ወጣት ክፍል',   18, null, 3);
alter table public.age_groups enable row level security;
grant select on public.age_groups to anon, authenticated;
grant insert, update, delete on public.age_groups to authenticated;
grant all on public.age_groups to service_role;
create policy age_groups_read on public.age_groups for select using (true);
create policy age_groups_write on public.age_groups for all to authenticated
  using (public.has_dept('hr')) with check (public.has_dept('hr'));
alter table public.members add constraint members_age_group_fk
  foreign key (age_group) references public.age_groups (code) on update cascade on delete set null;

/** Whole years between a birth date and a day. */
create or replace function public.age_on(p_dob date, p_day date)
returns int language sql immutable
as $$ select case when p_dob is null then null else extract(year from age(p_day, p_dob))::int end $$;

create or replace function public.age_group_for(p_dob date)
returns text language sql stable security definer set search_path = ''
as $$
  select g.code from public.age_groups g
  where public.age_on(p_dob, (now() at time zone 'Africa/Addis_Ababa')::date) between g.min_age and coalesce(g.max_age, 200)
  order by g.sort, g.min_age limit 1
$$;

create or replace function public.set_member_age_group()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.dob is distinct from old.dob then
    new.age_group := public.age_group_for(new.dob);
  end if;
  return new;
end $$;
create trigger trg_members_age_group before insert or update of dob on public.members
  for each row execute function public.set_member_age_group();

/** HR: re-file every active member into the age groups (ages change every year). Returns rows changed. */
create or replace function public.apply_age_groups()
returns int language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if not public.has_dept('hr') then raise exception 'only HR applies age groups'; end if;
  if exists (
    select 1 from public.age_groups a join public.age_groups b on a.code < b.code
    where a.min_age <= coalesce(b.max_age, 200) and b.min_age <= coalesce(a.max_age, 200)
  ) then
    raise exception 'age_ranges_overlap' using errcode = 'P0001';
  end if;
  update public.members m set age_group = public.age_group_for(m.dob)
  where m.is_active and m.age_group is distinct from public.age_group_for(m.dob);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.apply_age_groups() from public, anon;
grant execute on function public.apply_age_groups() to authenticated;

update public.members set age_group = public.age_group_for(dob) where dob is not null;

-- ---------------------------------------------------------------------
-- save_member: new fields; registration date is never taken from the form
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
  r := jsonb_populate_record(null::public.members, p_member - 'reg_no' - 'registered_on' - 'age_group');

  if v_id is null then
    insert into public.members (
      full_name, sex, title, work_status, member_status, dob, phone, email,
      telegram_username, sub_city, languages, geez_level, is_ethiopian,
      nationality, prior_school, secular_school, photo_path, joined_year,
      first_name, father_name, grandfather_name, mother_name,
      christian_name, baptism_church, marital_status, region, city, woreda, house_no, phone2,
      confessor_name, confessor_phone, emergency_name, emergency_relation, emergency_phone,
      education, work, member_type, member_type_other)
    values (
      btrim(r.full_name), r.sex, r.title, r.work_status, coalesce(r.member_status, 'new'), r.dob,
      r.phone, r.email, r.telegram_username, r.sub_city, coalesce(r.languages, '{}'),
      coalesce(r.geez_level, 'none'), coalesce(r.is_ethiopian, true),
      r.nationality, r.prior_school, r.secular_school, r.photo_path, r.joined_year,
      r.first_name, r.father_name, r.grandfather_name, r.mother_name,
      r.christian_name, r.baptism_church, r.marital_status, r.region, r.city, r.woreda, r.house_no, r.phone2,
      r.confessor_name, r.confessor_phone, r.emergency_name, r.emergency_relation, r.emergency_phone,
      coalesce(r.education, '[]'), coalesce(r.work, '[]'), coalesce(r.member_type, 'regular'),
      case when r.member_type = 'other' then r.member_type_other end)
    returning id into v_id;
  else
    update public.members set
      full_name = btrim(r.full_name), sex = r.sex, title = r.title,
      work_status = r.work_status, member_status = coalesce(r.member_status, member_status),
      dob = r.dob, phone = r.phone, email = r.email,
      telegram_username = r.telegram_username, sub_city = r.sub_city,
      languages = coalesce(r.languages, '{}'), geez_level = coalesce(r.geez_level, geez_level),
      is_ethiopian = coalesce(r.is_ethiopian, is_ethiopian), nationality = r.nationality,
      prior_school = r.prior_school,
      secular_school = r.secular_school,
      photo_path = coalesce(r.photo_path, photo_path),
      joined_year = r.joined_year,
      first_name = r.first_name, father_name = r.father_name,
      grandfather_name = r.grandfather_name, mother_name = r.mother_name,
      christian_name = r.christian_name, baptism_church = r.baptism_church,
      marital_status = r.marital_status, region = r.region, city = r.city, woreda = r.woreda,
      house_no = r.house_no, phone2 = r.phone2,
      confessor_name = r.confessor_name, confessor_phone = r.confessor_phone,
      emergency_name = r.emergency_name, emergency_relation = r.emergency_relation,
      emergency_phone = r.emergency_phone,
      education = coalesce(r.education, '[]'), work = coalesce(r.work, '[]'),
      member_type = coalesce(r.member_type, member_type),
      member_type_other = case when coalesce(r.member_type, member_type) = 'other' then r.member_type_other end
    where id = v_id;
    if not found then raise exception 'member not found or not permitted'; end if;
    delete from public.member_departments where member_id = v_id;
  end if;

  if cardinality(coalesce(p_depts, '{}')) > 2 then
    raise exception 'max_two_departments' using errcode = 'P0001';
  end if;
  insert into public.member_departments (member_id, dept)
  select v_id, d from unnest(coalesce(p_depts, '{}')) d
  on conflict do nothing;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Education: መደበኛ / የርቀት per enrollment, own attendance minimum
-- ---------------------------------------------------------------------
alter table public.enrollments
  add column study_mode text not null default 'regular' check (study_mode in ('regular', 'distance'));
alter table public.semesters
  add column min_attendance_distance int not null default 50 check (min_attendance_distance between 0 and 100);

create or replace function public.final_barred(p_offering uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select lim > 0
       and public.attendance_pct(p_offering, p_member) is not null
       and public.attendance_pct(p_offering, p_member) < lim
       and not exists (select 1 from public.final_exemptions x where x.offering_id = p_offering and x.member_id = p_member)
       and not exists (select 1 from public.makeup_grants g where g.offering_id = p_offering and g.member_id = p_member)
    from (
      select case when e.study_mode = 'distance' then s.min_attendance_distance else s.min_attendance end as lim
      from public.course_offerings o
      join public.semesters s on s.id = o.semester_id
      left join public.enrollments e on e.year_id = s.year_id and e.member_id = p_member
      where o.id = p_offering
    ) x), false)
$$;

-- ---------------------------------------------------------------------
-- Public self-registration (opened by HR for a limited time)
-- ---------------------------------------------------------------------
alter table public.site_settings
  add column registration_open   boolean not null default false,
  add column registration_until  date;

/** Is public self-registration open today? */
create or replace function public.registration_is_open()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select registration_open
     and (registration_until is null or registration_until >= (now() at time zone 'Africa/Addis_Ababa')::date)
   from public.site_settings where id), false)
$$;
grant execute on function public.registration_is_open() to anon, authenticated;

/** HR: open or close self-registration (optionally until a date). */
create or replace function public.set_registration(p_open boolean, p_until date)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_dept('hr') then raise exception 'only HR opens registration'; end if;
  update public.site_settings set registration_open = p_open, registration_until = case when p_open then p_until end,
    updated_at = now() where id;
end $$;
revoke all on function public.set_registration(boolean, date) from public, anon;
grant execute on function public.set_registration(boolean, date) to authenticated;

create table public.member_applications (
  id             uuid primary key default gen_random_uuid(),
  data           jsonb not null,                -- same shape save_member takes
  depts          text[] not null default '{}' check (cardinality(depts) <= 2),
  full_name      text not null,
  phone          text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason  text,
  member_id      uuid references public.members (id) on delete set null,
  decided_by     uuid references auth.users (id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index member_applications_status_idx on public.member_applications (status, created_at);
alter table public.member_applications enable row level security;
-- Inserted only by the server (service role) after checking registration_is_open().
grant select, update on public.member_applications to authenticated;
grant all on public.member_applications to service_role;
create policy applications_read on public.member_applications for select to authenticated
  using (public.has_any_dept(array['hr', 'office']));
create policy applications_decide on public.member_applications for update to authenticated
  using (public.has_dept('hr')) with check (public.has_dept('hr'));
