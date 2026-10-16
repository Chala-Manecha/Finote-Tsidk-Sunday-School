-- =====================================================================
-- Round 19: choosing a programme takes effect at once (no “add” step);
-- የተለያዩ አገልግሎቶች is a choice again; the year decision follows the rules
-- only; a register of ordained members (ካህናትና ዲያቆናት).
-- =====================================================================

-- ---------- programmes: ticked = taking part ----------
create or replace function public.set_member_programs(p_member uuid, p_chosen text[])
returns void language plpgsql security invoker set search_path = ''
as $$
declare p text;
begin
  foreach p in array array['course', 'abnet', 'mezmur', 'duty'] loop
    if p = any (coalesce(p_chosen, '{}')) then
      insert into public.member_programs (member_id, program, status) values (p_member, p, 'active')
      on conflict (member_id, program) do update set status = 'active';
    else
      insert into public.member_programs (member_id, program, status) values (p_member, p, 'declined')
      on conflict (member_id, program) do update set status = 'declined';
    end if;
  end loop;
end $$;

-- everyone who had chosen is now taking part (ኮርስ: enrolled in the open year by the trigger)
update public.member_programs set status = 'active' where status = 'chosen';

-- self-enrolling = taking ኮርስ
create or replace function public.enroll_self()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare y uuid; me uuid := public.current_member_id(); v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  if exists (select 1 from public.member_programs where member_id = me and program = 'course' and status = 'declined') then
    raise exception 'course_declined' using errcode = 'P0001';
  end if;
  select id into y from public.academic_years where is_active;
  if y is null then raise exception 'no_active_year' using errcode = 'P0001'; end if;
  insert into public.member_programs (member_id, program, status) values (me, 'course', 'active')
  on conflict (member_id, program) do update set status = 'active';
  insert into public.enrollments (year_id, member_id, self_registered) values (y, me, true)
  on conflict (year_id, member_id) do nothing
  returning id into v;
  return v;
end $$;

-- ---------- choosing a job needs የተለያዩ አገልግሎቶች ----------
create or replace function public.choose_duty(p_duty text, p_occasion text, p_date date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare me uuid := public.current_member_id(); v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  if not public.in_program(me, 'duty') then raise exception 'duty_not_chosen' using errcode = 'P0001'; end if;
  if coalesce(length(btrim(p_duty)), 0) not between 1 and 80 or coalesce(length(btrim(p_occasion)), 0) not between 1 and 80 then
    raise exception 'duty_fields' using errcode = 'P0001';
  end if;
  if p_date is null or p_date < public.addis_today() then raise exception 'duty_date' using errcode = 'P0001'; end if;
  insert into public.duty_assignments (member_id, dept, duty, duty_date, occasion, source, accepted_at)
  values (me, null, btrim(p_duty), p_date, btrim(p_occasion), 'chosen', now())
  returning id into v;
  return v;
end $$;

-- ---------- the year decision is the rule's, nobody overrides it ----------
delete from public.year_decisions where true;
drop policy if exists year_decisions_write on public.year_decisions;
revoke insert, update, delete on public.year_decisions from authenticated;

-- ---------- ካህናትና ዲያቆናት ----------
create table public.clergy (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid references public.members (id) on delete set null,
  full_name       text not null check (length(btrim(full_name)) between 2 and 120),
  rank            text not null default 'deacon' check (rank in ('deacon', 'priest', 'other')),
  ordained_on     date,
  bishop          text check (bishop is null or length(bishop) <= 120),
  place           text check (place is null or length(place) <= 160),
  service_status  text not null default 'serving' check (service_status in ('serving', 'not_serving', 'away')),
  file_path       text,
  file_name       text,
  note            text check (note is null or length(note) <= 500),
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
alter table public.clergy enable row level security;
grant select, insert, update, delete on public.clergy to authenticated;
create policy clergy_read on public.clergy for select to authenticated
  using (public.has_any_dept(array['education', 'hr', 'office', 'audit']));
create policy clergy_write on public.clergy for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

-- certificates are kept in the private edu-books bucket under clergy/
drop policy "edu-books read" on storage.objects;
create policy "edu-books read" on storage.objects for select to authenticated
  using (bucket_id = 'edu-books' and (
    public.has_dept('education')
    or ((storage.foldername(name))[1] = 'clergy' and public.has_any_dept(array['hr', 'office', 'audit']))
    or exists (select 1 from public.course_offerings o
               where o.book_path = storage.objects.name and public.is_teacher_of(o.id))));
