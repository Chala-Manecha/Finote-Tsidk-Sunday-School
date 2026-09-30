-- =====================================================================
-- Row-level security.
-- Public (anon) can only read the public-facing tables and submit feedback.
-- Staff (authenticated + staff_profiles row) are gated per department.
-- Transition rules that RLS can't express (who may approve/pay/flag)
-- are enforced by triggers at the bottom.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table privileges: start from nothing, grant back deliberately.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.departments, public.events, public.songs, public.wereb_items,
  public.history_items, public.event_photos, public.dept_assignees,
  public.abnet_sessions, public.course_sessions, public.edu_plan,
  public.mahiberat, public.prayer_schedule
to anon;
grant insert on public.feedback to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- departments: public read-only
-- ---------------------------------------------------------------------
create policy departments_read on public.departments for select using (true);

-- ---------------------------------------------------------------------
-- staff_profiles / staff_departments
-- All staff can see who's who; only admins change accounts
-- (account creation itself runs server-side with the secret key).
-- ---------------------------------------------------------------------
create policy staff_profiles_read on public.staff_profiles for select to authenticated
  using (public.is_staff() or user_id = (select auth.uid()));
create policy staff_profiles_admin_write on public.staff_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy staff_departments_read on public.staff_departments for select to authenticated
  using (public.is_staff() or user_id = (select auth.uid()));
create policy staff_departments_admin_write on public.staff_departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- members + member_departments
-- Every staff member can read (attendance rosters, duty dropdowns,
-- sub-member lists). HR registers/edits; ጽሕፈት ቤት can edit too.
-- Hard delete is admin-only — normal removal is is_active = false.
-- ---------------------------------------------------------------------
create policy members_read on public.members for select to authenticated
  using (public.is_staff());
create policy members_insert on public.members for insert to authenticated
  with check (public.has_any_dept(array['hr', 'office']));
create policy members_update on public.members for update to authenticated
  using (public.has_any_dept(array['hr', 'office']))
  with check (public.has_any_dept(array['hr', 'office']));
create policy members_delete on public.members for delete to authenticated
  using (public.is_admin());

create policy member_departments_read on public.member_departments for select to authenticated
  using (public.is_staff());
create policy member_departments_write on public.member_departments for all to authenticated
  using (public.has_any_dept(array['hr', 'office']))
  with check (public.has_any_dept(array['hr', 'office']));

-- ---------------------------------------------------------------------
-- attendance_sessions + attendance
-- Readable by all staff (HR's unified view). Written only by the
-- department that owns the session type.
-- ---------------------------------------------------------------------
create policy attendance_sessions_read on public.attendance_sessions for select to authenticated
  using (public.is_staff());
create policy attendance_sessions_write on public.attendance_sessions for all to authenticated
  using (public.has_dept(dept)) with check (public.has_dept(dept));

create policy attendance_read on public.attendance for select to authenticated
  using (public.is_staff());
create policy attendance_write on public.attendance for all to authenticated
  using (exists (select 1 from public.attendance_sessions s
                 where s.id = session_id and public.has_dept(s.dept)))
  with check (exists (select 1 from public.attendance_sessions s
                      where s.id = session_id and public.has_dept(s.dept)));

-- ---------------------------------------------------------------------
-- events (መርሓ ግብራት)
-- Public sees approved; staff see all. Any dept proposes for itself;
-- መርሓ ግብራት edits/approves anything; requester can edit/withdraw
-- while pending (trigger restricts status changes).
-- ---------------------------------------------------------------------
create policy events_public_read on public.events for select to anon
  using (status = 'approved');
create policy events_staff_read on public.events for select to authenticated
  using (public.is_staff() or status = 'approved');
create policy events_insert on public.events for insert to authenticated
  with check (public.has_dept(dept)
              and (status = 'pending' or public.has_dept('schedule')));
create policy events_update on public.events for update to authenticated
  using (public.has_dept('schedule') or (public.has_dept(dept) and status = 'pending'))
  with check (public.has_dept('schedule') or (public.has_dept(dept) and status = 'pending'));
create policy events_delete on public.events for delete to authenticated
  using (public.has_dept('schedule') or (public.has_dept(dept) and status = 'pending'));

-- ---------------------------------------------------------------------
-- duty_assignments — read by staff (public roster goes through
-- public_duty_roster() so member contact details never leak).
-- ---------------------------------------------------------------------
create policy duty_read on public.duty_assignments for select to authenticated
  using (public.is_staff());
create policy duty_write on public.duty_assignments for all to authenticated
  using (public.has_dept(dept)) with check (public.has_dept(dept));

-- ---------------------------------------------------------------------
-- Public content tables: anyone reads, owning dept writes.
-- ---------------------------------------------------------------------
create policy songs_read on public.songs for select using (true);
create policy songs_write on public.songs for all to authenticated
  using (public.has_dept('mezmur')) with check (public.has_dept('mezmur'));

create policy wereb_read on public.wereb_items for select using (true);
create policy wereb_write on public.wereb_items for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

create policy history_read on public.history_items for select using (true);
create policy history_write on public.history_items for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

create policy event_photos_read on public.event_photos for select using (true);
create policy event_photos_write on public.event_photos for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

create policy assignees_read on public.dept_assignees for select using (true);
create policy assignees_write on public.dept_assignees for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

create policy abnet_read on public.abnet_sessions for select using (true);
create policy abnet_write on public.abnet_sessions for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

create policy course_read on public.course_sessions for select using (true);
create policy course_write on public.course_sessions for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

create policy edu_plan_read on public.edu_plan for select using (true);
create policy edu_plan_write on public.edu_plan for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

create policy mahiberat_read on public.mahiberat for select using (true);
create policy mahiberat_write on public.mahiberat for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

create policy prayer_read on public.prayer_schedule for select using (true);
create policy prayer_write on public.prayer_schedule for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

-- ---------------------------------------------------------------------
-- Property & sale items (internal only)
-- ---------------------------------------------------------------------
create policy dept_property_read on public.dept_property for select to authenticated
  using (public.is_staff());
create policy dept_property_write on public.dept_property for all to authenticated
  using (public.has_dept('office') or (owner_dept = 'finance' and public.has_dept('finance')))
  with check (public.has_dept('office') or (owner_dept = 'finance' and public.has_dept('finance')));

create policy sale_items_read on public.sale_items for select to authenticated
  using (public.is_staff());
create policy sale_items_write on public.sale_items for all to authenticated
  using (public.has_dept('development')) with check (public.has_dept('development'));

-- ---------------------------------------------------------------------
-- Money
-- Visible to: the requesting dept, ጽሕፈት ቤት, ሒሳብና ንብረት, ኦዲት.
-- ---------------------------------------------------------------------
create policy money_requests_read on public.money_requests for select to authenticated
  using (public.has_dept(dept) or public.has_any_dept(array['office', 'finance', 'audit']));
create policy money_requests_insert on public.money_requests for insert to authenticated
  with check (public.has_dept(dept) and status = 'pending'
              and not audit_flag and requested_by = (select auth.uid()));
create policy money_requests_update on public.money_requests for update to authenticated
  using (public.has_dept(dept) or public.has_any_dept(array['office', 'finance', 'audit']))
  with check (public.has_dept(dept) or public.has_any_dept(array['office', 'finance', 'audit']));
-- no delete policy: requests are withdrawn, never deleted (audit trail)

create policy expense_lines_read on public.expense_lines for select to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id
                 and (public.has_dept(r.dept)
                      or public.has_any_dept(array['office', 'finance', 'audit']))));
create policy expense_lines_insert on public.expense_lines for insert to authenticated
  with check (exists (select 1 from public.money_requests r where r.id = request_id
                      and public.has_dept(r.dept) and r.status in ('approved', 'paid')));
create policy expense_lines_update on public.expense_lines for update to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id and public.has_dept(r.dept)))
  with check (exists (select 1 from public.money_requests r where r.id = request_id
                      and public.has_dept(r.dept) and r.status in ('approved', 'paid')));
create policy expense_lines_delete on public.expense_lines for delete to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id and public.has_dept(r.dept)));

create policy earnings_read on public.earnings for select to authenticated
  using (public.has_dept(dept) or public.has_any_dept(array['office', 'finance', 'audit']));
create policy earnings_insert on public.earnings for insert to authenticated
  with check (public.has_dept(dept) and status = 'pending'
              and submitted_by = (select auth.uid()));
create policy earnings_update on public.earnings for update to authenticated
  using (public.has_dept('finance') or (public.has_dept(dept) and status = 'pending'))
  with check (public.has_dept('finance') or (public.has_dept(dept) and status = 'pending'));
create policy earnings_delete on public.earnings for delete to authenticated
  using (public.has_dept(dept) and status = 'pending');

-- ---------------------------------------------------------------------
-- Feedback: anyone may submit (member picked from list); the tagged
-- dept and ጽሕፈት ቤት can read; only the tagged dept marks it seen.
-- ---------------------------------------------------------------------
create policy feedback_submit on public.feedback for insert to anon, authenticated
  with check (status = 'unseen' and seen_by is null and seen_at is null);
create policy feedback_read on public.feedback for select to authenticated
  using (public.has_dept(dept) or public.has_dept('office'));
create policy feedback_mark_seen on public.feedback for update to authenticated
  using (public.has_dept(dept)) with check (public.has_dept(dept));

-- =====================================================================
-- Transition guards
-- =====================================================================

-- money_requests:
--   pending  → approved | rejected   : ጽሕፈት ቤት
--   pending  → withdrawn             : requesting dept
--   approved → paid                  : ሒሳብና ንብረት
--   audit_flag / audit_note          : ኦዲት
--   amount / reason / needed_by      : requesting dept, only while pending
create or replace function public.guard_money_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;

  if new.dept <> old.dept or new.requested_by is distinct from old.requested_by
     or new.requested_at <> old.requested_at then
    raise exception 'dept/requester cannot change';
  end if;

  if (new.amount, new.reason, new.needed_by) is distinct from (old.amount, old.reason, old.needed_by)
     and not (old.status = 'pending' and public.has_dept(old.dept)) then
    raise exception 'only the requesting department can edit a pending request';
  end if;

  if (new.audit_flag, new.audit_note) is distinct from (old.audit_flag, old.audit_note)
     and not public.has_dept('audit') then
    raise exception 'only ኦዲት can flag requests';
  end if;

  if new.status <> old.status then
    if old.status = 'pending' and new.status in ('approved', 'rejected') then
      if not public.has_dept('office') then raise exception 'only ጽሕፈት ቤት approves'; end if;
      new.decided_by := auth.uid(); new.decided_at := now();
    elsif old.status = 'pending' and new.status = 'withdrawn' then
      if not public.has_dept(old.dept) then raise exception 'only the requester can withdraw'; end if;
    elsif old.status = 'approved' and new.status = 'paid' then
      if not public.has_dept('finance') then raise exception 'only ሒሳብና ንብረት marks paid'; end if;
      new.paid_by := auth.uid(); new.paid_at := now();
    else
      raise exception 'invalid status change % → %', old.status, new.status;
    end if;
  else
    -- stamps can't be forged without a transition
    new.decided_by := old.decided_by; new.decided_at := old.decided_at;
    new.paid_by := old.paid_by;       new.paid_at := old.paid_at;
  end if;
  return new;
end $$;

create trigger trg_guard_money_request before update on public.money_requests
  for each row execute function public.guard_money_request();

-- earnings: pending → approved | rejected by ሒሳብና ንብረት alone
create or replace function public.guard_earning()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;
  if new.dept <> old.dept or new.submitted_by is distinct from old.submitted_by then
    raise exception 'dept/submitter cannot change';
  end if;
  if new.status <> old.status then
    if old.status = 'pending' and new.status in ('approved', 'rejected')
       and public.has_dept('finance') then
      new.decided_by := auth.uid(); new.decided_at := now();
    else
      raise exception 'invalid earning status change';
    end if;
  elsif old.status <> 'pending' then
    raise exception 'decided earnings are read-only';
  end if;
  return new;
end $$;

create trigger trg_guard_earning before update on public.earnings
  for each row execute function public.guard_earning();

-- events: only መርሓ ግብራት changes status or the requesting dept
create or replace function public.guard_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;
  if (new.status <> old.status or new.dept <> old.dept) and not public.has_dept('schedule') then
    raise exception 'only መርሓ ግብራት approves/rejects events';
  end if;
  if new.status <> old.status then
    new.decided_by := auth.uid(); new.decided_at := now();
  end if;
  return new;
end $$;

create trigger trg_guard_event before update on public.events
  for each row execute function public.guard_event();

-- feedback: only status/seen fields may change
create or replace function public.guard_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;
  if (new.member_id, new.dept, new.message, new.contact, new.created_at)
     is distinct from (old.member_id, old.dept, old.message, old.contact, old.created_at) then
    raise exception 'feedback content is read-only';
  end if;
  if new.status = 'seen' and old.status = 'unseen' then
    new.seen_by := auth.uid(); new.seen_at := now();
  end if;
  return new;
end $$;

create trigger trg_guard_feedback before update on public.feedback
  for each row execute function public.guard_feedback();

-- Stamp creators server-side so clients can't spoof them
create or replace function public.stamp_creator()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create trigger trg_members_creator      before insert on public.members             for each row execute function public.stamp_creator();
create trigger trg_sessions_creator     before insert on public.attendance_sessions for each row execute function public.stamp_creator();
create trigger trg_events_creator       before insert on public.events              for each row execute function public.stamp_creator();
create trigger trg_songs_creator        before insert on public.songs               for each row execute function public.stamp_creator();
create trigger trg_wereb_creator        before insert on public.wereb_items         for each row execute function public.stamp_creator();
create trigger trg_history_creator      before insert on public.history_items       for each row execute function public.stamp_creator();
create trigger trg_photos_creator       before insert on public.event_photos        for each row execute function public.stamp_creator();
create trigger trg_property_creator     before insert on public.dept_property       for each row execute function public.stamp_creator();
create trigger trg_sale_items_creator   before insert on public.sale_items          for each row execute function public.stamp_creator();
create trigger trg_expense_creator      before insert on public.expense_lines       for each row execute function public.stamp_creator();

create or replace function public.stamp_assigner()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.assigned_by := auth.uid(); end if;
  return new;
end $$;
create trigger trg_duty_assigner before insert on public.duty_assignments
  for each row execute function public.stamp_assigner();
