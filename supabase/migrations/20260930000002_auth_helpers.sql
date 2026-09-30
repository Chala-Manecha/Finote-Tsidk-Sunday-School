-- =====================================================================
-- Role helpers used by every RLS policy.
-- SECURITY DEFINER so policies can read staff tables without recursion;
-- search_path pinned to '' so nothing can be shadowed.
-- An admin passes every department check.
-- =====================================================================

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.user_id = (select auth.uid()) and p.is_active and p.is_admin
  );
$$;

create or replace function public.has_dept(d text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles p
    left join public.staff_departments sd on sd.user_id = p.user_id
    where p.user_id = (select auth.uid())
      and p.is_active
      and (p.is_admin or sd.dept = d)
  );
$$;

create or replace function public.has_any_dept(ds text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles p
    left join public.staff_departments sd on sd.user_id = p.user_id
    where p.user_id = (select auth.uid())
      and p.is_active
      and (p.is_admin or sd.dept = any (ds))
  );
$$;

-- true when the caller is the backend (secret/service key) or a direct DB
-- session with no JWT at all (SQL editor, migrations). NOTE: don't use
-- current_user here — inside SECURITY DEFINER functions it's the owner.
create or replace function public.is_service_role()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((select auth.role()) = 'service_role', false)
      or ((select auth.role()) is null and (select auth.uid()) is null);
$$;

revoke all on function public.is_staff(), public.is_admin(), public.has_dept(text),
  public.has_any_dept(text[]), public.is_service_role() from public;
grant execute on function public.is_staff(), public.is_admin(), public.has_dept(text),
  public.has_any_dept(text[]), public.is_service_role() to anon, authenticated, service_role;
