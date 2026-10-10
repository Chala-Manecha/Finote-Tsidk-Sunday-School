-- =====================================================================
-- Round 7:
--  * members ask for their own መልቀቂያ (logged in)
--  * ክፍል ኃላፊ = a registered member; the head opens their department
--    pages with their own login (no separate access grant)
--  * department property managed by ሒሳብና ንብረት, with a note
--  * shop items are published from the purchases register
--  * አብነት rows: subject (with audio / file), day, time, teacher as text
-- =====================================================================

-- ---------- self-requested leave ----------
alter table public.member_departures add column self_requested boolean not null default false;

create or replace function public.request_my_departure(p_category text, p_reason text, p_leave date)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare me uuid := public.current_member_id(); v uuid;
begin
  if me is null then raise exception 'not a member login'; end if;
  if exists (select 1 from public.member_departures d where d.member_id = me
             and (d.status = 'pending' or (d.status = 'approved' and d.reinstated_at is null))) then
    raise exception 'already_requested' using errcode = 'P0001';
  end if;
  insert into public.member_departures (member_id, leave_date, reason_text, reason_category, self_requested)
  values (me, coalesce(p_leave, (now() at time zone 'Africa/Addis_Ababa')::date), btrim(p_reason), p_category, true)
  returning id into v;
  return v;
end $$;
revoke all on function public.request_my_departure(text, text, date) from public, anon;
grant execute on function public.request_my_departure(text, text, date) to authenticated;

create or replace function public.my_departures()
returns table (id uuid, status text, requested_at timestamptz, leave_date date, reason_category text,
               decided_at timestamptz, cert_no text, reinstated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.status, d.requested_at, d.leave_date, d.reason_category, d.decided_at, d.cert_no, d.reinstated_at
  from public.member_departures d
  where d.member_id = public.current_member_id()
  order by d.requested_at desc
$$;
grant execute on function public.my_departures() to authenticated;

-- ---------- department heads are members ----------
alter table public.dept_assignees add column member_id uuid references public.members (id) on delete set null;
create unique index dept_assignees_member_dept on public.dept_assignees (dept, member_id);

-- A department head opens their department with their own login.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.staff_profiles p where p.user_id = (select auth.uid()) and p.is_active)
      or exists (select 1 from public.dept_assignees a
                 where a.member_id is not null and a.member_id = public.current_member_id());
$$;

create or replace function public.has_dept(d text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles p
    left join public.staff_departments sd on sd.user_id = p.user_id
    where p.user_id = (select auth.uid()) and p.is_active and (p.is_admin or sd.dept = d))
  or exists (select 1 from public.dept_assignees a
             where a.dept = d and a.member_id is not null and a.member_id = public.current_member_id());
$$;

create or replace function public.has_any_dept(ds text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles p
    left join public.staff_departments sd on sd.user_id = p.user_id
    where p.user_id = (select auth.uid()) and p.is_active and (p.is_admin or sd.dept = any (ds)))
  or exists (select 1 from public.dept_assignees a
             where a.dept = any (ds) and a.member_id is not null and a.member_id = public.current_member_id());
$$;

/** The departments the signed-in member heads (for the app's menus). */
create or replace function public.my_head_depts()
returns text[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(a.dept order by a.dept), '{}')
  from public.dept_assignees a
  where a.member_id is not null and a.member_id = public.current_member_id()
$$;
grant execute on function public.my_head_depts() to authenticated;

-- ---------- department property: ሒሳብና ንብረት manages, ጽሕፈት ቤት views ----------
alter table public.dept_property add column note text;
drop policy dept_property_write on public.dept_property;
create policy dept_property_write on public.dept_property for all to authenticated
  using (public.has_dept('finance')) with check (public.has_dept('finance'));

-- ---------- shop: publish from the purchases register ----------
alter table public.sale_items add column published boolean not null default false;
update public.sale_items set published = true where price is not null;
grant select (published) on public.sale_items to anon;

-- ---------- አብነት: four plain fields + audio / file for the subject ----------
alter table public.abnet_sessions
  add column subject     text,
  add column audio_path  text,
  add column file_path   text,
  add column day_text    text,
  add column time_text   text;
update public.abnet_sessions set
  subject = array_to_string(subjects, '፣ '),
  time_text = array_to_string(times, '፣ ')
where subject is null;

drop policy "media write" on storage.objects;
drop policy "media delete" on storage.objects;
create policy "media write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] in ('wereb', 'abnet') and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] = 'assignees' and public.has_dept('office'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'docs') and public.has_dept('internal_comm'))
    ));
create policy "media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] in ('wereb', 'abnet') and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] = 'assignees' and public.has_dept('office'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'docs') and public.has_dept('internal_comm'))
    ));
