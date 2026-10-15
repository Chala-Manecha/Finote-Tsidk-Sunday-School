-- =====================================================================
-- Round 15: course students come into the year by themselves.
-- When ትምህርት ክፍል adds a member to ኮርስ (member_programs → active), or a
-- new academic year is opened, the member is enrolled in the open year
-- without a class; ትምህርት ክፍል then assigns the class.
-- =====================================================================

create or replace function public.enroll_course_member()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.program = 'course' and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into public.enrollments (year_id, member_id)
    select y.id, new.member_id from public.academic_years y
    join public.members m on m.id = new.member_id and m.is_active
    where y.is_active
    on conflict (year_id, member_id) do nothing;
  end if;
  return new;
end $$;
create trigger trg_member_programs_enroll after insert or update on public.member_programs
  for each row execute function public.enroll_course_member();

create or replace function public.enroll_course_members_in_year()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    insert into public.enrollments (year_id, member_id)
    select new.id, p.member_id from public.member_programs p
    join public.members m on m.id = p.member_id and m.is_active
    where p.program = 'course' and p.status = 'active'
    on conflict (year_id, member_id) do nothing;
  end if;
  return new;
end $$;
create trigger trg_academic_year_enroll after insert or update on public.academic_years
  for each row execute function public.enroll_course_members_in_year();

-- now: everyone already taking ኮርስ is in the open year
insert into public.enrollments (year_id, member_id)
select y.id, p.member_id from public.academic_years y
cross join public.member_programs p
join public.members m on m.id = p.member_id and m.is_active
where y.is_active and p.program = 'course' and p.status = 'active'
on conflict (year_id, member_id) do nothing;
