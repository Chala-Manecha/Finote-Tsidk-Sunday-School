-- Round 5: fuller member registration (fields modelled on the eotcssu.et member form).
-- full_name stays the canonical name used everywhere; the form now builds it from
-- ስም + የአባት ስም + የአያት ስም, which are also kept separately.

alter table public.members
  add column registered_on      date,
  add column doc_no             text,
  add column first_name         text,
  add column father_name        text,
  add column grandfather_name   text,
  add column mother_name        text,
  add column christian_name     text,
  add column baptism_church     text,
  add column marital_status     text check (marital_status in ('single', 'married', 'widowed', 'divorced', 'monastic')),
  add column region             text,
  add column city               text,
  add column woreda             text,
  add column house_no           text,
  add column phone2             text,
  add column confessor_name     text,
  add column confessor_phone    text,
  add column emergency_name     text,
  add column emergency_relation text,
  add column emergency_phone    text,
  -- [{"level","field","institution","start_year","end_year","current"}]
  add column education          jsonb not null default '[]' check (jsonb_typeof(education) = 'array'),
  -- [{"field","workplace","start_year","end_year","current"}]
  add column work               jsonb not null default '[]' check (jsonb_typeof(work) = 'array');

-- Existing members: registration date = when the row was created; split the name.
update public.members set
  registered_on    = (created_at at time zone 'Africa/Addis_Ababa')::date,
  first_name       = nullif(split_part(btrim(full_name), ' ', 1), ''),
  father_name      = nullif(split_part(regexp_replace(btrim(full_name), '\s+', ' ', 'g'), ' ', 2), ''),
  grandfather_name = nullif(btrim(substring(regexp_replace(btrim(full_name), '\s+', ' ', 'g')
                       from '^\S+\s+\S+\s+(.*)$')), ''),
  region           = case when sub_city is not null then 'አዲስ አበባ' end,
  city             = case when sub_city is not null then 'አዲስ አበባ' end;

alter table public.members alter column registered_on set default current_date;
alter table public.members alter column registered_on set not null;

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
  r := jsonb_populate_record(null::public.members, p_member - 'reg_no');

  if v_id is null then
    insert into public.members (
      full_name, sex, title, work_status, member_status, dob, phone, email,
      telegram_username, sub_city, languages, geez_level, is_ethiopian,
      nationality, prior_school, secular_school, photo_path, joined_year,
      registered_on, doc_no, first_name, father_name, grandfather_name, mother_name,
      christian_name, baptism_church, marital_status, region, city, woreda, house_no, phone2,
      confessor_name, confessor_phone, emergency_name, emergency_relation, emergency_phone,
      education, work)
    values (
      btrim(r.full_name), r.sex, r.title, r.work_status, coalesce(r.member_status, 'new'), r.dob,
      r.phone, r.email, r.telegram_username, r.sub_city, coalesce(r.languages, '{}'),
      coalesce(r.geez_level, 'none'), coalesce(r.is_ethiopian, true),
      r.nationality, r.prior_school, r.secular_school, r.photo_path, r.joined_year,
      coalesce(r.registered_on, current_date), r.doc_no, r.first_name, r.father_name, r.grandfather_name, r.mother_name,
      r.christian_name, r.baptism_church, r.marital_status, r.region, r.city, r.woreda, r.house_no, r.phone2,
      r.confessor_name, r.confessor_phone, r.emergency_name, r.emergency_relation, r.emergency_phone,
      coalesce(r.education, '[]'), coalesce(r.work, '[]'))
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
      registered_on = coalesce(r.registered_on, registered_on),
      doc_no = r.doc_no, first_name = r.first_name, father_name = r.father_name,
      grandfather_name = r.grandfather_name, mother_name = r.mother_name,
      christian_name = r.christian_name, baptism_church = r.baptism_church,
      marital_status = r.marital_status, region = r.region, city = r.city, woreda = r.woreda,
      house_no = r.house_no, phone2 = r.phone2,
      confessor_name = r.confessor_name, confessor_phone = r.confessor_phone,
      emergency_name = r.emergency_name, emergency_relation = r.emergency_relation,
      emergency_phone = r.emergency_phone,
      education = coalesce(r.education, '[]'), work = coalesce(r.work, '[]')
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
