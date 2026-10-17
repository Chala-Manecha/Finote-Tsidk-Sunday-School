-- =====================================================================
-- Clearing the sample data: only the system admin, and ትምህርት ክፍል's
-- samples too (academic years, semesters, courses, classes, marks,
-- exams, transcripts, አብነት lessons).
-- =====================================================================
drop function if exists public.clear_sample_data(boolean, boolean);

create or replace function public.clear_sample_data(p_members boolean, p_money boolean, p_education boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  out jsonb := '{}'::jsonb;
  n int;
  users uuid[] := '{}';
begin
  if not public.is_admin() then raise exception 'permission denied'; end if;

  if p_money then
    delete from public.expense_lines where true;
    delete from public.receipts where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('receipts', n);
    delete from public.money_requests where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('requests', n);
    delete from public.earnings where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('earnings', n);
    delete from public.donations where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('donations', n);
    update private.receipt_counter set n = 0 where id;
    update public.wallet_settings set opening_balance = 0, as_of = null where true;
  end if;

  -- marks of approved courses are locked; the samples go anyway
  if p_members or p_education then
    alter table public.marks disable trigger trg_guard_marks;
    delete from public.marks where true;
    alter table public.marks enable trigger trg_guard_marks;
  end if;

  if p_education then
    delete from public.academic_years where true;   -- semesters, courses, classes, exams, transcripts follow
    get diagnostics n = row_count; out := out || jsonb_build_object('years', n);
    delete from public.abnet_sessions where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('abnet', n);
  end if;

  if p_members then
    select coalesce(array_agg(distinct u), '{}') into users from (
      select user_id as u from public.member_accounts
      union select auth_user_id from public.member_applications where auth_user_id is not null) x;
    delete from public.attendance_sessions where true;
    delete from public.class_sessions where true;
    delete from public.leadership_roles where member_id is not null;
    delete from public.member_departures where true;
    delete from public.offering_teachers where true;
    delete from public.clergy where true;
    delete from public.member_applications where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('applications', n);
    delete from public.members where true;
    get diagnostics n = row_count; out := out || jsonb_build_object('members', n);
    alter sequence public.member_reg_seq restart;
  end if;

  return out || jsonb_build_object('users', to_jsonb(users));
end $$;
revoke all on function public.clear_sample_data(boolean, boolean, boolean) from public, anon;
grant execute on function public.clear_sample_data(boolean, boolean, boolean) to authenticated;
