-- =====================================================================
-- Self-registration gives the username (registration number) and the
-- login code at once. The login only opens when HR approves; the member
-- then keeps the same registration number.
-- =====================================================================

alter table public.member_applications
  add column reg_key       text unique,
  add column auth_user_id  uuid references auth.users (id) on delete set null;
alter table public.member_applications add column reg_no text
  generated always as (public.fmt_code('ፍጽ-', reg_key)) stored;

/** Server-only: a registration key not used by any member or application. */
create or replace function public.new_application_key(p_seed text)
returns text language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  if not public.is_service_role() then raise exception 'server only'; end if;
  loop
    k := private.code8('application|' || p_seed || '|' || clock_timestamp() || '|' || i);
    exit when not exists (select 1 from public.members where reg_key = k)
          and not exists (select 1 from public.member_applications where reg_key = k);
    i := i + 1;
  end loop;
  return k;
end $$;
revoke all on function public.new_application_key(text) from public, anon, authenticated;
grant execute on function public.new_application_key(text) to service_role;

-- A new member keeps the key reserved by their pending application; otherwise one is issued.
create or replace function public.set_member_key()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  if tg_op = 'UPDATE' then
    new.reg_key := old.reg_key;      -- issued once, never changes
    return new;
  end if;
  if new.reg_key is not null
     and exists (select 1 from public.member_applications a where a.reg_key = new.reg_key and a.status = 'pending')
     and not exists (select 1 from public.members m where m.reg_key = new.reg_key) then
    return new;
  end if;
  loop
    k := private.code8(new.full_name || '|' || coalesce(new.created_at, now())::date || '|' || new.id || '|' || i);
    exit when not exists (select 1 from public.members where reg_key = k)
          and not exists (select 1 from public.member_applications where reg_key = k);
    i := i + 1;
  end loop;
  new.reg_key := k;
  return new;
end $$;

-- save_member passes reg_key through on insert (used only for approved applications; see trigger).
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
      reg_key, full_name, sex, title, work_status, member_status, dob, phone, email,
      telegram_username, sub_city, languages, geez_level, is_ethiopian,
      nationality, prior_school, secular_school, photo_path, joined_year,
      first_name, father_name, grandfather_name, mother_name,
      christian_name, baptism_church, marital_status, region, city, woreda, house_no, phone2,
      confessor_name, confessor_phone, emergency_name, emergency_relation, emergency_phone,
      education, work, member_type, member_type_other)
    values (
      r.reg_key, btrim(r.full_name), r.sex, r.title, r.work_status, coalesce(r.member_status, 'new'), r.dob,
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
