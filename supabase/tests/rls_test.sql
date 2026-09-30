-- RLS smoke test. Runs against a scratch DB with Supabase-like auth stubs
-- (see supabase/tests/README.md). Every block either succeeds or raises.
\set ON_ERROR_STOP 1

-- helper: expect the statement in `sql` to fail
create or replace function pg_temp.must_fail(sql text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'EXPECTED FAILURE but succeeded: %', sql;
end $$;

create or replace function pg_temp.must_equal(got bigint, want bigint, what text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception '% : got %, want %', what, got, want; end if;
end $$;

-- ---------- fixtures (as postgres) ----------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@x'),
  ('00000000-0000-0000-0000-0000000000a1', 'hr@x'),
  ('00000000-0000-0000-0000-0000000000a2', 'mez@x'),
  ('00000000-0000-0000-0000-0000000000a3', 'office@x'),
  ('00000000-0000-0000-0000-0000000000a4', 'fin@x'),
  ('00000000-0000-0000-0000-0000000000a5', 'audit@x'),
  ('00000000-0000-0000-0000-0000000000a6', 'sched@x'),
  ('00000000-0000-0000-0000-0000000000a7', 'nobody@x');
insert into public.staff_profiles (user_id, username, full_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'admin',  'Admin', true),
  ('00000000-0000-0000-0000-0000000000a1', 'hr1',    'HR One', false),
  ('00000000-0000-0000-0000-0000000000a2', 'mez1',   'Mez One', false),
  ('00000000-0000-0000-0000-0000000000a3', 'office1','Office One', false),
  ('00000000-0000-0000-0000-0000000000a4', 'fin1',   'Fin One', false),
  ('00000000-0000-0000-0000-0000000000a5', 'audit1', 'Audit One', false),
  ('00000000-0000-0000-0000-0000000000a6', 'sched1', 'Sched One', false);
insert into public.staff_departments values
  ('00000000-0000-0000-0000-0000000000a1', 'hr'),
  ('00000000-0000-0000-0000-0000000000a2', 'mezmur'),
  ('00000000-0000-0000-0000-0000000000a3', 'office'),
  ('00000000-0000-0000-0000-0000000000a4', 'finance'),
  ('00000000-0000-0000-0000-0000000000a5', 'audit'),
  ('00000000-0000-0000-0000-0000000000a6', 'schedule');

-- ---------- anon ----------
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_fail('select * from public.members');
select pg_temp.must_fail('select * from public.feedback');
select pg_temp.must_fail('select * from public.money_requests');
select pg_temp.must_equal((select count(*) from public.departments), 9, 'anon sees departments');
reset role;

-- ---------- HR registers members ----------
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.members (id, full_name, sex, work_status, dob) values
  ('10000000-0000-0000-0000-000000000001', 'አበበ ከበደ', 'male',   'student', '2005-03-10'),
  ('10000000-0000-0000-0000-000000000002', 'ሰላም ታደሰ', 'female', 'worker',  '1998-09-12'),
  ('10000000-0000-0000-0000-000000000003', 'ዮናስ ገብሩ',  'male',   'worker',  null);
insert into public.member_departments values ('10000000-0000-0000-0000-000000000001', 'mezmur');
select pg_temp.must_equal((select count(*) from public.members where created_by = '00000000-0000-0000-0000-0000000000a1'), 3, 'created_by stamped');
delete from public.members where id = '10000000-0000-0000-0000-000000000003';
select pg_temp.must_equal((select count(*) from public.members), 3, 'HR cannot hard-delete');
-- HR records a ስብሰባ (meeting) session; cannot record መዝሙር
select pg_temp.must_fail($q$select public.create_attendance_session('mezmur', '2026-09-28', '08:00', '{}')$q$);
select public.create_attendance_session('meeting', '2026-09-28', '10:00',
  '{"10000000-0000-0000-0000-000000000002": "present"}');
select pg_temp.must_equal((select count(*) from public.attendance), 3, 'all active members get a row');
reset role;

-- ---------- መዝሙር ክፍል ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.members (full_name, sex, work_status) values ('X Y', 'male', 'student')$q$);
select pg_temp.must_equal((select count(*) from public.members), 3, 'mezmur reads members');
select public.create_attendance_session('wereb', '2026-09-27', '14:00',
  '{"10000000-0000-0000-0000-000000000001": "present", "10000000-0000-0000-0000-000000000003": "half"}');
-- cannot edit HR's meeting attendance
update public.attendance set status = 'present'
  where session_id = (select id from public.attendance_sessions where session_type = 'meeting');
select pg_temp.must_equal((select count(*) from public.attendance a join public.attendance_sessions s on s.id = a.session_id
  where s.session_type = 'meeting' and a.status = 'present'), 1, 'mezmur cannot edit HR session');
-- can edit own session via save_attendance
select public.save_attendance((select id from public.attendance_sessions where session_type = 'wereb'),
  '{"10000000-0000-0000-0000-000000000002": "present"}');
select pg_temp.must_equal((select count(*) from public.attendance a join public.attendance_sessions s on s.id = a.session_id
  where s.session_type = 'wereb' and a.status = 'present'), 2, 'mezmur edits own session');

-- money: request, cannot self-approve
insert into public.money_requests (id, dept, amount, reason, requested_by)
  values ('20000000-0000-0000-0000-000000000001', 'mezmur', 1000, 'ከበሮ', '00000000-0000-0000-0000-0000000000a2');
select pg_temp.must_fail($q$insert into public.money_requests (dept, amount, reason, requested_by) values ('hr', 5, 'x', '00000000-0000-0000-0000-0000000000a2')$q$);
select pg_temp.must_fail($q$update public.money_requests set status = 'approved' where id = '20000000-0000-0000-0000-000000000001'$q$);
select pg_temp.must_fail($q$update public.money_requests set audit_flag = true where id = '20000000-0000-0000-0000-000000000001'$q$);
-- cannot log spend on a pending request
select pg_temp.must_fail($q$insert into public.expense_lines (request_id, amount, reason, spent_on) values ('20000000-0000-0000-0000-000000000001', 10, 'x', '2026-09-29')$q$);
-- propose an event, cannot approve it
insert into public.events (id, title, event_date, event_time, dept)
  values ('30000000-0000-0000-0000-000000000001', 'ወረብ ጥናት', '2026-10-02', '15:00', 'mezmur');
select pg_temp.must_fail($q$update public.events set status = 'approved' where id = '30000000-0000-0000-0000-000000000001'$q$);
reset role;

-- ---------- ጽሕፈት ቤት approves money ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
update public.money_requests set status = 'approved' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.must_fail($q$update public.money_requests set status = 'paid' where id = '20000000-0000-0000-0000-000000000001'$q$);
reset role;
select pg_temp.must_equal((select count(*) from public.money_requests where decided_by = '00000000-0000-0000-0000-0000000000a3'), 1, 'decided_by stamped');

-- ---------- finance pays, audit flags ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
update public.money_requests set status = 'paid' where id = '20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
update public.money_requests set audit_flag = true, audit_note = 'ደረሰኝ ይቅረብ' where id = '20000000-0000-0000-0000-000000000001';
-- mezmur logs spend > approved → ከራስ ወጪ
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.expense_lines (request_id, amount, reason, spent_on) values
  ('20000000-0000-0000-0000-000000000001', 700, 'ከበሮ', '2026-09-29'),
  ('20000000-0000-0000-0000-000000000001', 450, 'ትራንስፖርት', '2026-09-29');
select pg_temp.must_equal((select self_contributed::bigint from public.money_request_totals), 150, 'self contribution computed');
select pg_temp.must_equal((select refund::bigint from public.money_request_totals), 0, 'refund computed');
reset role;

-- ---------- scheduling ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', false);
update public.events set status = 'approved' where id = '30000000-0000-0000-0000-000000000001';
reset role;
set role anon;
select pg_temp.must_equal((select count(*) from public.events), 1, 'anon sees approved event');
select pg_temp.must_equal((select count(*) from public.public_member_names()), 3, 'anon member names');
insert into public.feedback (member_id, dept, message) values ('10000000-0000-0000-0000-000000000001', 'mezmur', 'ጥሩ ነው');
select pg_temp.must_fail($q$insert into public.feedback (member_id, dept, message, status) values ('10000000-0000-0000-0000-000000000001', 'mezmur', 'x', 'seen')$q$);
reset role;

-- ---------- feedback visibility ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.must_equal((select count(*) from public.feedback), 0, 'HR cannot read mezmur feedback');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_equal((select count(*) from public.feedback), 1, 'office sees all feedback');
update public.feedback set status = 'seen';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_equal((select count(*) from public.feedback where status = 'unseen'), 1, 'office cannot mark seen');
update public.feedback set status = 'seen';
select pg_temp.must_equal((select count(*) from public.feedback where status = 'seen' and seen_by is not null), 1, 'mezmur marks seen');
reset role;

-- ---------- non-staff authenticated user ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', false);
select pg_temp.must_equal((select count(*) from public.members), 0, 'non-staff sees no members');
select pg_temp.must_fail($q$select public.create_attendance_session('meeting', '2026-09-30', '10:00', '{}')$q$);
reset role;

-- ---------- HR overview RPCs ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.must_equal((select count(*) from public.attendance_overview('2026-09-01', '2026-09-30')), 5, 'overview has 5 rows');
select pg_temp.must_equal((select absent_dept_count from public.member_absence_summary('2026-09-01', '2026-09-30')
  where member_id = '10000000-0000-0000-0000-000000000003'), 1, 'ዮናስ absent in 1 dept');
select pg_temp.must_equal((select absent_days from public.member_absence_summary('2026-09-01', '2026-09-30')
  where member_id = '10000000-0000-0000-0000-000000000001'), 1, 'አበበ absent once');
reset role;

-- ---------- save_member RPC ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$select public.save_member(null, '{"full_name":"ሀ ለ","sex":"male","work_status":"student"}', '{mezmur}')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.save_member(null, '{"full_name":"  ሄኖን ጫላ ","sex":"male","work_status":"worker","dob":"2000-01-01","prior_school":{"name":"ቅ/ማርያም","years":2}}', '{mezmur,education}');
select pg_temp.must_equal((select count(*) from public.member_departments md join public.members m on m.id = md.member_id where m.full_name = 'ሄኖን ጫላ'), 2, 'save_member inserts depts');
select public.save_member((select id from public.members where full_name = 'ሄኖን ጫላ'), '{"full_name":"ሄኖን ጫላ","sex":"male","work_status":"student"}', '{hr}');
select pg_temp.must_equal((select count(*) from public.member_departments md join public.members m on m.id = md.member_id where m.full_name = 'ሄኖን ጫላ' and md.dept = 'hr'), 1, 'save_member replaces depts');
select pg_temp.must_equal((select count(*) from public.members where full_name = 'ሄኖን ጫላ' and work_status = 'student' and prior_school is null), 1, 'save_member updates');
reset role;

\echo ALL RLS TESTS PASSED
