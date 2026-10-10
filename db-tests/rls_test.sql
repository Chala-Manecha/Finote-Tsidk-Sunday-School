-- RLS smoke test. Runs against a scratch DB with Supabase-like auth stubs
-- (see README → Tests). Every block either succeeds or raises.
\set ON_ERROR_STOP 1

-- The school has money to pay requests with (payments are blocked beyond the balance).
update public.wallet_settings set opening_balance = 1000000 where id;

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
  ('00000000-0000-0000-0000-0000000000b1', 'ic@x'),
  ('00000000-0000-0000-0000-0000000000a7', 'nobody@x');
insert into public.staff_profiles (user_id, username, full_name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'admin',  'Admin', true),
  ('00000000-0000-0000-0000-0000000000a1', 'hr1',    'HR One', false),
  ('00000000-0000-0000-0000-0000000000a2', 'mez1',   'Mez One', false),
  ('00000000-0000-0000-0000-0000000000a3', 'office1','Office One', false),
  ('00000000-0000-0000-0000-0000000000a4', 'fin1',   'Fin One', false),
  ('00000000-0000-0000-0000-0000000000a5', 'audit1', 'Audit One', false),
  ('00000000-0000-0000-0000-0000000000a6', 'sched1', 'Sched One', false),
  ('00000000-0000-0000-0000-0000000000b1', 'ic1',    'IC One', false);
insert into public.staff_departments values
  ('00000000-0000-0000-0000-0000000000a1', 'hr'),
  ('00000000-0000-0000-0000-0000000000a2', 'mezmur'),
  ('00000000-0000-0000-0000-0000000000a3', 'office'),
  ('00000000-0000-0000-0000-0000000000a4', 'finance'),
  ('00000000-0000-0000-0000-0000000000a5', 'audit'),
  ('00000000-0000-0000-0000-0000000000a6', 'schedule'),
  ('00000000-0000-0000-0000-0000000000b1', 'internal_comm');

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
select pg_temp.must_fail($q$update public.money_requests set status = 'paid' where id = '20000000-0000-0000-0000-000000000001'$q$); -- no method
update public.money_requests set status = 'paid', pay_method = 'cash' where id = '20000000-0000-0000-0000-000000000001';
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
select reg_no as m1 from public.members where id = '10000000-0000-0000-0000-000000000001' \gset
set role anon;
select pg_temp.must_equal((select count(*) from public.events), 1, 'anon sees approved event');
select pg_temp.must_fail('select * from public.public_member_names()');
select pg_temp.must_fail($q$insert into public.feedback (member_id, dept, message) values ('10000000-0000-0000-0000-000000000001', 'mezmur', 'x y z')$q$);
select pg_temp.must_equal((public.submit_feedback('ፍጽ-0001', '', 'mezmur', 'ሰላም ነው') = 'not_found')::int, 1, 'old-style ID not found');
select pg_temp.must_equal((public.submit_feedback(:'m1', '@someone', 'mezmur', 'ሰላም ነው') = 'mismatch')::int, 1, 'feedback mismatch');
select pg_temp.must_equal((public.submit_feedback(lower(replace(:'m1', 'ፍጽ-', '')), '', 'mezmur', 'ጥሩ ነው') = 'ok')::int, 1, 'feedback ok (lowercase, no prefix)');
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
select public.save_member(null, '{"full_name":"ዮሐንስ ተስፋዬ ገብሬ","first_name":"ዮሐንስ","father_name":"ተስፋዬ","grandfather_name":"ገብሬ","mother_name":"ማርታ","marital_status":"single","sex":"male","work_status":"worker","dob":"1995-05-05","region":"አዲስ አበባ","confessor_name":"ቀሲስ አበበ","emergency_name":"ማርታ","emergency_relation":"እናት","emergency_phone":"0911","education":[{"level":"የመጀመሪያ ዲግሪ","field":"ሒሳብ","institution":"AAU","start_year":2010,"end_year":2014,"current":false}],"work":[{"field":"የግል ድርጅት","workplace":"ኤቢሲ","start_year":2015,"end_year":null,"current":true}]}', '{}');
select pg_temp.must_equal((select count(*) from public.members where full_name = 'ዮሐንስ ተስፋዬ ገብሬ' and mother_name = 'ማርታ' and marital_status = 'single'
  and jsonb_array_length(education) = 1 and work->0->>'workplace' = 'ኤቢሲ' and registered_on = (now() at time zone 'Africa/Addis_Ababa')::date and age_group = 'youth'), 1, 'save_member stores the new registration details');
select pg_temp.must_fail($q$select public.save_member(null, '{"full_name":"ሀሀ ለለ መመ","sex":"male","work_status":"student","marital_status":"unknown"}', '{}')$q$);
reset role;

-- ---------- phase 2: scheduling ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
-- a dept can't self-approve on insert
select pg_temp.must_fail($q$insert into public.events (title, event_date, event_time, dept, status) values ('x', '2026-10-05', '10:00', 'mezmur', 'approved')$q$);
-- nor propose for another dept
select pg_temp.must_fail($q$insert into public.events (title, event_date, event_time, dept) values ('x', '2026-10-05', '10:00', 'hr')$q$);
insert into public.events (id, title, event_date, event_time, dept)
  values ('30000000-0000-0000-0000-000000000002', 'ልምምድ', '2026-10-05', '10:00', 'mezmur');
-- requester withdraws its pending event
delete from public.events where id = '30000000-0000-0000-0000-000000000002';
select pg_temp.must_equal((select count(*) from public.events where id = '30000000-0000-0000-0000-000000000002'), 0, 'requester withdraws pending event');
-- requester can't delete an approved one
delete from public.events where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.events where id = '30000000-0000-0000-0000-000000000001'), 1, 'requester cannot delete approved event');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', false);
insert into public.events (title, event_date, event_time, dept, status) values ('ጸሎት', '2026-10-05', '10:00', 'schedule', 'approved');
update public.events set title = 'ወረብ ጥናት (ተቀይሯል)' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.events where title like '%ተቀይሯል%'), 1, 'schedule edits any event');
reset role;

-- ---------- phase 2: earnings + withdraw ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.earnings (id, dept, amount, source, earned_on, submitted_by)
  values ('40000000-0000-0000-0000-000000000001', 'mezmur', 500, 'ሽያጭ', '2026-09-28', '00000000-0000-0000-0000-0000000000a2');
select pg_temp.must_fail($q$update public.earnings set status = 'approved' where id = '40000000-0000-0000-0000-000000000001'$q$);
insert into public.money_requests (id, dept, amount, reason, requested_by)
  values ('20000000-0000-0000-0000-000000000002', 'mezmur', 200, 'ወረቀት', '00000000-0000-0000-0000-0000000000a2');
update public.money_requests set status = 'withdrawn' where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.must_fail($q$update public.money_requests set status = 'pending' where id = '20000000-0000-0000-0000-000000000002'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
-- office has no update rights on earnings at all: RLS silently matches 0 rows
update public.earnings set status = 'approved' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.must_fail($q$update public.money_requests set status = 'approved' where id = '20000000-0000-0000-0000-000000000002'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select pg_temp.must_equal((select count(*) from public.earnings where status = 'approved'), 0, 'office cannot approve earning');
update public.earnings set status = 'approved' where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.earnings where status = 'approved' and decided_by is not null), 1, 'finance approves earning');
reset role;

-- ---------- phase 3: duty roster + songs ----------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a8', 'edu@x');
insert into public.staff_profiles (user_id, username, full_name) values ('00000000-0000-0000-0000-0000000000a8', 'edu1', 'Edu One');
insert into public.staff_departments values ('00000000-0000-0000-0000-0000000000a8', 'education');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.duty_assignments (member_id, dept, duty, duty_date, occasion)
  values ('10000000-0000-0000-0000-000000000001', 'mezmur', 'ዘማሪ', '2026-10-10', 'በዓለ ሩፋኤል');
select pg_temp.must_fail($q$insert into public.duty_assignments (member_id, dept, duty, duty_date, occasion) values ('10000000-0000-0000-0000-000000000001', 'hr', 'ዘማሪ', '2026-10-10', 'መስቀል')$q$);
insert into public.songs (title, category) values ('እግዚአብሔር እረኛዬ ነው', 'zewetir');
select pg_temp.must_fail($q$insert into public.wereb_items (title) values ('x')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_fail($q$insert into public.duty_assignments (member_id, dept, duty, duty_date, occasion) values ('10000000-0000-0000-0000-000000000001', 'office', 'ዘማሪ', '2026-10-10', 'መስቀል')$q$);
select pg_temp.must_fail($q$insert into public.songs (title, category) values ('x', 'zewetir')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.wereb_items (title) values ('ወረብ ዘመስቀል');
select pg_temp.must_fail($q$insert into public.songs (title, category) values ('x', 'zewetir')$q$);
-- mezmur's duty row is not editable by education
update public.duty_assignments set duty = 'ፈታኝ' where dept = 'mezmur';
select pg_temp.must_equal((select count(*) from public.duty_assignments where duty = 'ፈታኝ'), 0, 'education cannot edit mezmur duty');
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select pg_temp.must_equal((select count(*) from public.public_duty_roster('2026-10-01')), 1, 'public roster');
select pg_temp.must_equal((select count(*) from public.songs), 1, 'anon reads songs');
select pg_temp.must_equal((select count(*) from public.wereb_items), 1, 'anon reads wereb');
select pg_temp.must_fail('select * from public.duty_assignments');
reset role;

-- ---------- phase 4: office content, feedback, property, education ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
insert into public.event_photos (image_path, caption) values ('photos/x.jpg', 'x');
insert into public.history_items (category, media_type, media_path) values ('meskel', 'photo', 'history/x.jpg');
insert into public.mahiberat (association_name, event_date) values ('የማርያም ማኅበር', '2026-10-20');
insert into public.prayer_schedule (program, days, times) values ('ምዕራፍ', '{1,3}', '{ማታ 11:00}');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.dept_assignees (dept, full_name, sex) values ('mezmur', 'ሀ', 'male')
  on conflict (dept) do update set full_name = excluded.full_name;
-- round 7: ሒሳብና ንብረት manages department property; ጽሕፈት ቤት only views it
select pg_temp.must_fail($q$insert into public.dept_property (name, qty, condition, owner_dept) values ('x', 1, 'old', 'mezmur')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
insert into public.dept_property (name, qty, condition, owner_dept, note) values ('ከበሮ', 3, 'old', 'mezmur', 'ሁለቱ ጠጅ ይፈልጋሉ');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_fail($q$insert into public.abnet_sessions (subjects, days, times, teacher) values ('{ቅኔ}', '{1}', '{x}', 'y')$q$);
select pg_temp.must_fail($q$insert into public.sale_items (name, qty) values ('x', 1)$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.event_photos (image_path) values ('photos/y.jpg')$q$);
select pg_temp.must_fail($q$insert into public.dept_property (name, qty, condition, owner_dept) values ('x', 1, 'new', 'mezmur')$q$);
select pg_temp.must_equal((select count(*) from public.dept_property where owner_dept = 'mezmur'), 1, 'mezmur sees its property');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
insert into public.dept_property (name, qty, condition, owner_dept) values ('ካዝና', 1, 'new', 'finance');
insert into public.dept_property (name, qty, condition, owner_dept) values ('ወንበር', 1, 'new', 'hr');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.abnet_sessions (subjects, days, times, teacher) values ('{ቅኔ,ዜማ}', '{1,3}', '{ጠዋት 12:00 ጀምሮ}', 'የኔታ አእምሮ');
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select pg_temp.must_equal((select count(*) from public.abnet_sessions), 1, 'anon reads abnet');
select pg_temp.must_equal((select count(*) from public.mahiberat), 1, 'anon reads mahiberat');
select pg_temp.must_equal((select count(*) from public.event_photos), 1, 'anon reads photos');
select pg_temp.must_fail('select * from public.dept_property');
select pg_temp.must_equal((select count(*) from public.sale_items), 0, 'anon can read the shop');
reset role;

-- ---------- round 1: terms, reg IDs, names, depts, spend approval, shop, property log ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.leadership_terms (id, name, team_no) values ('50000000-0000-0000-0000-000000000001', 'አትናቴዎስ', 11);
select public.set_active_term('50000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.must_fail($q$select public.set_active_term('50000000-0000-0000-0000-000000000001')$q$);
-- duplicate name (case/space-insensitive) rejected
select pg_temp.must_fail($q$select public.save_member(null, '{"full_name":"አበበ   ከበደ","sex":"male","work_status":"student"}', '{}')$q$);
-- more than two departments rejected
select pg_temp.must_fail($q$select public.save_member(null, '{"full_name":"ቤተልሔም አለሙ","sex":"female","work_status":"student"}', '{hr,mezmur,education}')$q$);
select public.save_member(null, '{"full_name":"ቤተልሔም አለሙ","sex":"female","work_status":"student","languages":["አማርኛ","ኦሮምኛ"],"telegram_username":"betty"}', '{hr,mezmur}');
select pg_temp.must_equal((select count(*) from public.members where full_name = 'ቤተልሔም አለሙ'
  and reg_no ~ '^ፍጽ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$' and cardinality(languages) = 2 and term_id = '50000000-0000-0000-0000-000000000001'), 1, 'reg_no, languages, term tag');
reset role;
do $$ declare r text; begin
  select reg_no into r from public.members where full_name = 'ቤተልሔም አለሙ';
  if public.submit_feedback(r, '@Betty', 'hr', 'ሰላም ሰላም') <> 'ok' then raise exception 'telegram match should be case-insensitive'; end if;
  if public.submit_feedback(r, '', 'hr', 'ሰላም ሰላም') <> 'mismatch' then raise exception 'empty telegram must mismatch when member has one'; end if;
end $$;

-- spend approval locks expense lines (request 20..01 is paid, mezmur)
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_fail($q$update public.money_requests set spend_approved_at = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
update public.money_requests set spend_approved_at = now() where id = '20000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.expense_lines (request_id, amount, reason, spent_on) values ('20000000-0000-0000-0000-000000000001', 5, 'x', '2026-09-30')$q$);
delete from public.expense_lines where request_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.expense_lines where request_id = '20000000-0000-0000-0000-000000000001'), 2, 'approved spend lines are locked');

-- shop: sale → earning → approval reduces stock
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a9', 'dev@x');
insert into public.staff_profiles (user_id, username, full_name) values ('00000000-0000-0000-0000-0000000000a9', 'dev1', 'Dev One');
insert into public.staff_departments values ('00000000-0000-0000-0000-0000000000a9', 'development');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false);
insert into public.sale_items (id, name, qty, price) values ('60000000-0000-0000-0000-000000000001', 'መስቀል', 3, 150);
update public.shop_settings set phone = '0911000000', telegram = 'finote_shop';
insert into public.earnings (dept, amount, source, earned_on, submitted_by, sale_item_id, sale_qty)
  values ('development', 450, 'ሽያጭ፦ መስቀል ×3', '2026-10-01', '00000000-0000-0000-0000-0000000000a9', '60000000-0000-0000-0000-000000000001', 3);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.earnings (dept, amount, source, earned_on, submitted_by, sale_item_id, sale_qty) values ('mezmur', 1, 'x', '2026-10-01', '00000000-0000-0000-0000-0000000000a2', '60000000-0000-0000-0000-000000000001', 1)$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
update public.earnings set status = 'approved' where sale_item_id = '60000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select qty::bigint from public.sale_items where id = '60000000-0000-0000-0000-000000000001'), 0, 'approved sale empties stock');
-- property log + wallet: finance only
insert into public.property_log (dept, kind, item_name, value, log_date) values ('mezmur', 'added', 'ከበሮ', 2000, '2026-10-01');
update public.wallet_settings set opening_balance = 10000, as_of = '2026-09-11';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_fail($q$insert into public.property_log (dept, kind, item_name, value, log_date) values ('mezmur', 'lost', 'x', 1, '2026-10-01')$q$);
update public.wallet_settings set opening_balance = 1;
select pg_temp.must_equal((select opening_balance::bigint from public.wallet_settings), 10000, 'only finance sets the opening balance');
reset role;


-- =================== ROUND 2 ===================
-- money out: voucher → department signs → ኦዲት
set role authenticated;
select pg_temp.must_equal((select count(*) from public.money_requests where id = '20000000-0000-0000-0000-000000000001'
  and voucher_no ~ '^ፍጽ-ወ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$' and pay_method = 'cash'), 1, 'voucher issued on payment');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select pg_temp.must_fail($q$update public.money_requests set audited_at = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select pg_temp.must_fail($q$update public.money_requests set received_at = now(), received_name = 'x' where id = '20000000-0000-0000-0000-000000000001'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$update public.money_requests set received_at = now() where id = '20000000-0000-0000-0000-000000000001'$q$);
update public.money_requests set received_at = now(), received_name = 'ዮሐንስ' where id = '20000000-0000-0000-0000-000000000001';
update public.money_requests set pay_reference = 'changed' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.money_requests where id = '20000000-0000-0000-0000-000000000001' and pay_reference is null), 1, 'payment details are fixed after payment');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
update public.money_requests set audited_at = now() where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.money_requests where audited_by = '00000000-0000-0000-0000-0000000000a5'), 1, 'ኦዲት reviewed after signature');
select pg_temp.must_fail($q$update public.money_requests set audited_at = now() + interval '1 day' where id = '20000000-0000-0000-0000-000000000001'$q$);

-- receipts: issued on income approval, immutable, scoped, voidable by finance only
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false);
select pg_temp.must_equal((select count(*) from public.receipts where kind = 'income' and dept = 'development'
  and code ~ '^ፍጽ-ደ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'), 1, 'department sees its income receipt');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_equal((select count(*) from public.receipts where dept = 'development'), 0, 'other departments do not see it');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select pg_temp.must_fail('select serial from public.receipts');
select pg_temp.must_fail($q$update public.receipts set amount = 1 where dept = 'development'$q$);
select pg_temp.must_fail($q$update public.receipts set voided_at = now() where dept = 'development'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select pg_temp.must_fail($q$update public.receipts set voided_at = now(), void_reason = 'x' where dept = 'development'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
update public.receipts set voided_at = now(), void_reason = 'የተሳሳተ ህትመት' where dept = 'development';
select public.reissue_receipt((select id from public.receipts where dept = 'development' and voided_at is not null));
select pg_temp.must_equal((select count(*) from public.receipts where dept = 'development' and voided_at is null), 1, 'reissued receipt is live');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select pg_temp.must_equal((select count(*) from public.receipt_serial_gaps()), 0, 'receipt serials have no gaps');
select pg_temp.must_equal(((public.receipt_audit((select code from public.receipts where dept = 'development' and voided_at is null)) ->> 'serial')::bigint > 1)::int, 1, 'audit lookup shows serial');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select pg_temp.must_fail($q$select public.receipt_audit('x')$q$);
update public.donation_accounts set account_name = 'ፍኖተ ጽድቅ ሰ/ት/ቤት', telebirr_number = '0911223344', cbe_account = '1000123456789';
reset role;

-- donations: public claim → finance verifies → receipt → public tracking + verify
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((public.submit_donation('ሰላማዊት', '0911000000', 1500, 'telebirr', 'CH12AB34CD', 'ለበዓል') = 'ok')::int, 1, 'donation claimed');
select pg_temp.must_equal((public.submit_donation('ሌላ', null, 10, 'cbe', 'ch12-ab34-cd', null) = 'duplicate')::int, 1, 'same transaction twice is rejected');
select pg_temp.must_equal((public.donation_status('ch12ab34cd') = 'pending')::int, 1, 'donor sees pending');
select pg_temp.must_fail('select * from public.donations');
reset role;
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_equal((select count(*) from public.donations), 0, 'departments do not see donations');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select pg_temp.must_fail($q$update public.donations set status = 'rejected' where txn_key = 'CH12AB34CD'$q$);
update public.donations set status = 'verified' where txn_key = 'CH12AB34CD';
select pg_temp.must_equal((select count(*) from public.receipts where kind = 'donation' and amount = 1500 and payer_name = 'ሰላማዊት'
  and account_label like '%Telebirr 0911223344%'), 1, 'donation receipt issued');
select code as donation_code from public.receipts where kind = 'donation' \gset
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((public.donation_status('CH12AB34CD') = 'ready')::int, 1, 'donor sees receipt ready');
select pg_temp.must_equal((public.verify_code(:'donation_code') ->> 'type' = 'receipt')::int, 1, 'public can verify a receipt');
select pg_temp.must_equal((public.verify_code('ZZZZ-ZZZZ') ->> 'type' is null)::int, 1, 'unknown code is not valid');
reset role;

-- leaving certificate: HR requests → office approves → member frozen → reinstate
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.member_departures (member_id, leave_date, reason_text, reason_category) values ('10000000-0000-0000-0000-000000000001', '2026-10-01', 'ወደ ሌላ ከተማ', 'moved')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.member_departures (id, member_id, leave_date, reason_text, reason_category)
  values ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-10-01', 'ወደ ሌላ ከተማ ተዛውሬያለሁ', 'moved');
select pg_temp.must_fail($q$insert into public.member_departures (member_id, leave_date, reason_text, reason_category) values ('10000000-0000-0000-0000-000000000001', '2026-10-01', 'again', 'other')$q$);
select pg_temp.must_fail($q$update public.member_departures set status = 'approved' where id = '70000000-0000-0000-0000-000000000001'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
update public.member_departures set status = 'approved', commendation = 'በታማኝነት አገልግለዋል' where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.members where id = '10000000-0000-0000-0000-000000000001' and not is_active), 1, 'approved departure freezes member');
select pg_temp.must_equal((select count(*) from public.member_departures where cert_no ~ '^ፍጽ-መ-'), 1, 'certificate code issued');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select pg_temp.must_equal((select count(*) from public.member_departures), 1, 'ኦዲት sees departures');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
update public.member_departures set reinstated_at = now() where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.members where id = '10000000-0000-0000-0000-000000000001' and is_active), 1, 'reinstated member is active');

-- leadership roles: HR only
insert into public.leadership_roles (term_id, dept, role, member_id)
  values ('50000000-0000-0000-0000-000000000001', 'mezmur', 'head', '10000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.leadership_roles (term_id, dept, role, member_id) values ('50000000-0000-0000-0000-000000000001', 'mezmur', 'deputy', '10000000-0000-0000-0000-000000000001')$q$);
reset role;

-- lost members: absent from both መዝሙር and ኮርስ
insert into public.members (id, full_name, sex, work_status, created_at)
  values ('10000000-0000-0000-0000-0000000000f1', 'የሚጠፋ አባል', 'male', 'student', '2026-08-01');
insert into public.attendance_sessions (id, session_type, session_date) values
  ('80000000-0000-0000-0000-000000000001', 'mezmur', '2026-08-09'),
  ('80000000-0000-0000-0000-000000000002', 'course', '2026-08-16'),
  ('80000000-0000-0000-0000-000000000003', 'mezmur', '2026-09-20');
insert into public.attendance (session_id, member_id, status) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000f1', 'present'),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000f1', 'absent'),
  ('80000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000f1', 'absent');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', false);
select pg_temp.must_equal((select count(*) from public.member_absence_watch()
  where member_id = '10000000-0000-0000-0000-0000000000f1' and level = 'lost' and last_seen = '2026-08-09'), 1, 'member absent 30+ days is lost');
insert into public.lost_followups (member_id, contacted_on, note) values ('10000000-0000-0000-0000-0000000000f1', '2026-10-01', 'ስልክ ተደውሏል፤ በሚቀጥለው እሁድ ይመጣል');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.lost_followups (member_id, contacted_on, note) values ('10000000-0000-0000-0000-0000000000f1', '2026-10-01', 'x')$q$);
reset role;

-- =================== ROUND 3a: የውስጥ ግንኙነት ===================
reset role;
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
update public.site_settings set welcome_title = 'እንኳን ደህና መጡ', announcement = 'ነገ ጉባኤ አለ', announcement_active = true;
insert into public.social_links (platform, url) values ('telegram', 'https://t.me/finote_tsidk');
select pg_temp.must_fail($q$insert into public.social_links (platform, url) values ('facebook', 'http://insecure')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_fail($q$insert into public.social_links (platform, url) values ('youtube', 'https://youtube.com/x')$q$);
select pg_temp.must_fail($q$insert into public.mahiberat (association_name, event_date) values ('x', '2026-10-21')$q$);
update public.site_settings set announcement = 'office cannot';
select pg_temp.must_equal((select count(*) from public.site_settings where announcement = 'ነገ ጉባኤ አለ'), 1, 'only የውስጥ ግንኙነት edits the home page');
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((select count(*) from public.social_links), 5, 'public sees social links (4 seeded + 1)');
reset role;

-- =================== ROUND 3b: education ===================
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'student@member'),
  ('00000000-0000-0000-0000-0000000000c2', 'teacher@member');
insert into public.members (id, full_name, sex, work_status, phone) values
  ('10000000-0000-0000-0000-0000000000e1', 'ተማሪ አንድ', 'female', 'student', '0911111111'),
  ('10000000-0000-0000-0000-0000000000e2', 'መምህር ተማሪ', 'male', 'student', '0922222222');
insert into public.member_accounts (member_id, user_id) values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1'),
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2');
-- server-only helpers (run as the backend: no JWT)
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((select count(*) from public.member_identify((select reg_no from public.members where id = '10000000-0000-0000-0000-0000000000e1'), '+251 911 111 111')), 1, 'identify by ID + phone');
select pg_temp.must_equal((select count(*) from public.member_identify((select reg_no from public.members where id = '10000000-0000-0000-0000-0000000000e1'), '0900000000')), 0, 'wrong phone is not identified');
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_fail($q$select public.member_password('X', '123456')$q$);
select pg_temp.must_fail($q$select * from public.member_identify('x', '0911111111')$q$);

-- ትምህርት ክፍል sets up the year
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.academic_years (id, ec_year, is_active) values ('90000000-0000-0000-0000-000000000001', 2019, true);
select pg_temp.must_fail($q$insert into public.semesters (year_id, no, w_quiz) values ('90000000-0000-0000-0000-000000000001', 2, 50)$q$);
insert into public.semesters (id, year_id, no, is_active) values ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 1, true);
insert into public.course_offerings (id, semester_id, class_level, name) values
  ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '3', 'ዶግማ'),
  ('92000000-0000-0000-0000-000000000005', '91000000-0000-0000-0000-000000000001', '5', 'ሥርዓተ ቤተክርስቲያን');
insert into public.offering_teachers values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e2');
insert into public.enrollments (year_id, member_id, class_level) values
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e2', '5');
select pg_temp.must_fail($q$insert into public.offering_teachers values ('92000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000e2')$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$insert into public.academic_years (ec_year) values (2020)$q$);

-- student self-enrolls; ትምህርት ክፍል assigns the class
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public.enroll_self();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
update public.enrollments set class_level = '3' where member_id = '10000000-0000-0000-0000-0000000000e1';
select pg_temp.must_fail($q$update public.enrollments set class_level = '3' where member_id = '10000000-0000-0000-0000-0000000000e2'$q$);

-- teacher enters marks for their class only
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select pg_temp.must_fail($q$insert into public.marks (offering_id, member_id, quiz) values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e1', 11)$q$);
insert into public.marks (offering_id, member_id, quiz, notebook, participation, mid) values
  ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e1', 9, 8, 10, 25);
select pg_temp.must_fail($q$insert into public.marks (offering_id, member_id, quiz) values ('92000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000e2', 5)$q$);
select pg_temp.must_fail($q$update public.course_offerings set status = 'submitted' where id = '92000000-0000-0000-0000-000000000003'$q$);
update public.marks set final = 36 where offering_id = '92000000-0000-0000-0000-000000000003';
insert into public.class_sessions (id, offering_id, session_date) values ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000003', '2026-09-27');
insert into public.class_attendance values ('93000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e1', 'present');
update public.course_offerings set status = 'submitted' where id = '92000000-0000-0000-0000-000000000003';
select pg_temp.must_fail($q$update public.marks set final = 40 where offering_id = '92000000-0000-0000-0000-000000000003'$q$);
select pg_temp.must_fail($q$update public.course_offerings set status = 'approved' where id = '92000000-0000-0000-0000-000000000003'$q$);
select pg_temp.must_equal((select count(*) from public.marks where offering_id = '92000000-0000-0000-0000-000000000005'), 0, 'teacher does not see other classes');

-- student sees nothing before approval, own marks after
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_equal((select count(*) from public.marks), 0, 'no marks before approval');
select pg_temp.must_fail($q$insert into public.marks (offering_id, member_id, quiz) values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e1', 10)$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
update public.course_offerings set status = 'approved' where id = '92000000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_equal((select count(*) from public.marks), 1, 'student sees own marks after approval');
select pg_temp.must_equal((select count(*) from public.semester_results('91000000-0000-0000-0000-000000000001', '3')
  where total = 88 and rank = 1 and ready and attended = 1 and sessions = 1), 1, 'results: total, rank, attendance, ready');
select pg_temp.must_fail($q$select * from public.semester_results('91000000-0000-0000-0000-000000000001', '5')$q$);

-- unlock needs a written reason
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
select pg_temp.must_fail($q$update public.course_offerings set status = 'draft' where id = '92000000-0000-0000-0000-000000000003'$q$);
insert into public.offering_unlocks (offering_id, from_status, reason) values ('92000000-0000-0000-0000-000000000003', 'approved', 'የተሳሳተ ውጤት ተገኝቷል');
update public.course_offerings set status = 'draft' where id = '92000000-0000-0000-0000-000000000003';
update public.course_offerings set status = 'submitted' where id = '92000000-0000-0000-0000-000000000003';
update public.course_offerings set status = 'approved' where id = '92000000-0000-0000-0000-000000000003';
select public.issue_transcript('91000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e1');
select code as transcript_code from public.transcripts \gset
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((public.verify_code(:'transcript_code') ->> 'type' = 'transcript')::int, 1, 'public can verify a transcript');
select pg_temp.must_fail('select * from public.marks');
reset role;
-- a locked account is no longer a member login
update public.member_accounts set locked_at = now() where member_id = '10000000-0000-0000-0000-0000000000e1';
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_equal((select count(*) from public.marks), 0, 'locked account sees nothing');
reset role;

-- =================== ROUND 4: year-end + extras ===================
reset role;
update public.member_accounts set locked_at = null where member_id = '10000000-0000-0000-0000-0000000000e1';
insert into public.members (id, full_name, sex, work_status) values ('10000000-0000-0000-0000-0000000000e3', 'ዘግይቶ የመጣ', 'male', 'student');
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.semesters (id, year_id, no) values ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 2);
insert into public.course_offerings (id, semester_id, class_level, name, days, time_text) values
  ('92000000-0000-0000-0000-000000000007', '91000000-0000-0000-0000-000000000002', '3', 'ዶግማ 2', '{0}', 'ጠዋት 3:00');
insert into public.offering_teachers values ('92000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-0000000000e2');

-- minimum attendance: 1 of 4 meetings = 25% < 75% → no final until exempted
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
insert into public.class_sessions (id, offering_id, session_date) values
  ('93000000-0000-0000-0000-000000000011', '92000000-0000-0000-0000-000000000007', '2026-09-06'),
  ('93000000-0000-0000-0000-000000000012', '92000000-0000-0000-0000-000000000007', '2026-09-13'),
  ('93000000-0000-0000-0000-000000000013', '92000000-0000-0000-0000-000000000007', '2026-09-20'),
  ('93000000-0000-0000-0000-000000000014', '92000000-0000-0000-0000-000000000007', '2026-09-27');
insert into public.class_attendance values
  ('93000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-0000000000e1', 'present'),
  ('93000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-0000000000e1', 'absent'),
  ('93000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-0000000000e1', 'absent'),
  ('93000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-0000000000e1', 'absent');
insert into public.marks (offering_id, member_id, quiz, notebook, participation, mid) values
  ('92000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-0000000000e1', 8, 8, 8, 20);
select pg_temp.must_fail($q$update public.marks set final = 30 where offering_id = '92000000-0000-0000-0000-000000000007'$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.final_exemptions (offering_id, member_id, reason) values ('92000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-0000000000e1', 'በሕመም ምክንያት');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
update public.marks set final = 30 where offering_id = '92000000-0000-0000-0000-000000000007';
update public.course_offerings set status = 'submitted' where id = '92000000-0000-0000-0000-000000000007';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
update public.course_offerings set status = 'approved' where id = '92000000-0000-0000-0000-000000000007';

-- make-up exam on an approved course: only with a grant, only once
insert into public.enrollments (year_id, member_id, class_level) values ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e3', '3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select pg_temp.must_fail($q$insert into public.marks (offering_id, member_id, final) values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e3', 30)$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.makeup_grants (offering_id, member_id, reason) values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e3', 'ዘግይቶ ተመዝግቧል');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
insert into public.marks (offering_id, member_id, final) values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e3', 30);
select pg_temp.must_equal((select count(*) from public.marks where member_id = '10000000-0000-0000-0000-0000000000e3' and makeup), 1, 'make-up final recorded');
select pg_temp.must_fail($q$update public.marks set final = 40 where member_id = '10000000-0000-0000-0000-0000000000e3'$q$);

-- year-end: both semesters approved → averages, rank, promotion
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
select pg_temp.must_equal((select count(*) from public.year_results('90000000-0000-0000-0000-000000000001', '3')
  where member_id = '10000000-0000-0000-0000-0000000000e1' and ready and decision = 'promoted' and rank = 1), 1, 'year results: promoted, rank 1');
select pg_temp.must_equal((select count(*) from public.year_results('90000000-0000-0000-0000-000000000001', '3')
  where member_id = '10000000-0000-0000-0000-0000000000e3' and decision = 'repeat'), 1, 'low average repeats');
insert into public.year_decisions (year_id, member_id, decision, remark) values ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e3', 'promoted', 'በጉባኤ ውሳኔ');
select pg_temp.must_equal((select count(*) from public.year_results('90000000-0000-0000-0000-000000000001', '3')
  where member_id = '10000000-0000-0000-0000-0000000000e3' and decision = 'promoted' and auto_decision = 'repeat'), 1, 'decision override');
select public.issue_year_transcript('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e1');
select pg_temp.must_equal((select count(*) from public.student_history('10000000-0000-0000-0000-0000000000e1')), 1, 'history has the year');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_equal((select count(*) from public.year_results('90000000-0000-0000-0000-000000000001', '3')), 1, 'student sees only own year row');
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((select count(*) from public.public_course_catalog()), 2, 'catalog shows the active semester only');
reset role;

-- shop: cannot sell more than bought
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', false);
insert into public.sale_items (id, name, qty, price, buy_price, bought_on) values ('60000000-0000-0000-0000-000000000002', 'ነጠላ', 5, 300, 200, '2026-09-30');
update public.sale_items set sold_qty = 2, sold_on = '2026-10-01' where id = '60000000-0000-0000-0000-000000000002';
select pg_temp.must_fail($q$update public.sale_items set sold_qty = 6 where id = '60000000-0000-0000-0000-000000000002'$q$);
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_fail('select buy_price from public.sale_items');
select pg_temp.must_equal((select count(*) from public.sale_items where qty - sold_qty = 3), 1, 'public sees remaining stock');
reset role;

-- ---------- round 5: age groups, registration window, applications ----------
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail('select public.apply_age_groups()');
select pg_temp.must_fail('select public.set_registration(true, null)');
update public.age_groups set min_age = 12 where code = 'middle';
select pg_temp.must_equal((select min_age from public.age_groups where code = 'middle'), 11, 'non-HR cannot change age groups');
select pg_temp.must_equal((select count(*) from public.member_applications), 0, 'non-HR sees no applications');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
update public.age_groups set max_age = 12 where code = 'children';
select pg_temp.must_fail('select public.apply_age_groups()');   -- overlaps ማዕከላዊ (11)
update public.age_groups set max_age = 10 where code = 'children';
select public.apply_age_groups();
select public.set_registration(true, null);
select pg_temp.must_equal((select public.registration_is_open()::int), 1, 'HR opens registration');
reset role;
insert into public.member_applications (data, full_name) values ('{}', 'ፈተና ሰው ስም');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.must_equal((select count(*) from public.member_applications), 1, 'HR sees applications');
select public.set_registration(false, null);
reset role;
set role anon;
select set_config('request.jwt.claim.role', 'anon', false);
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.must_equal((select public.registration_is_open()::int), 0, 'registration closed');
select pg_temp.must_fail($q$insert into public.member_applications (data, full_name) values ('{}', 'x y z')$q$);
reset role;

-- ---------- round 5c: application keeps its registration number ----------
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', '', false);
select public.new_application_key('ሙከራ') as k \gset
insert into public.member_applications (data, full_name, reg_key) values ('{}', 'ቀ ለ መ', :'k');
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.save_member(null, jsonb_build_object('reg_key', :'k', 'full_name', 'ቀለም ለማ መኮንን', 'sex', 'male', 'work_status', 'student'), '{}');
select pg_temp.must_equal((select count(*) from public.members where reg_key = :'k' and full_name = 'ቀለም ለማ መኮንን'), 1, 'approved member keeps the application number');
select public.save_member(null, jsonb_build_object('reg_key', 'ZZZZ2222', 'full_name', 'ሌላ ሰው ስም', 'sex', 'male', 'work_status', 'student'), '{}');
select pg_temp.must_equal((select count(*) from public.members where reg_key = 'ZZZZ2222'), 0, 'arbitrary numbers are not accepted');
reset role;

-- ---------- round 5d: HR deletes members without history ----------
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.must_fail($q$select public.delete_member((select id from public.members where full_name = 'ቀለም ለማ መኮንን'))$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select public.delete_member((select id from public.members where full_name = 'ቀለም ለማ መኮንን'));
select pg_temp.must_equal((select count(*) from public.members where full_name = 'ቀለም ለማ መኮንን'), 0, 'HR deletes a member without history');
select pg_temp.must_fail($q$select public.delete_member((select m.id from public.members m join public.attendance a on a.member_id = m.id limit 1))$q$);
reset role;

-- ---------- round 6: payments cannot exceed the balance ----------
reset role;
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', '', false);
insert into public.money_requests (id, dept, amount, reason, status)
values ('70000000-0000-0000-0000-000000000001', 'mezmur', 5000000, 'ከሂሳቡ በላይ', 'approved');
select pg_temp.must_fail($q$update public.money_requests set status = 'paid', paid_at = now(), pay_method = 'cash'
  where id = '70000000-0000-0000-0000-000000000001'$q$);
update public.wallet_settings set opening_balance = 0, as_of = null where id;
update public.money_requests set amount = greatest(public.wallet_balance() + 1, 1) where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.must_fail($q$update public.money_requests set status = 'paid', paid_at = now(), pay_method = 'cash'
  where id = '70000000-0000-0000-0000-000000000001'$q$);
update public.wallet_settings set opening_balance = 1000000 where id;
update public.money_requests set status = 'paid', paid_at = now(), pay_method = 'cash' where id = '70000000-0000-0000-0000-000000000001';
select pg_temp.must_equal((select count(*) from public.money_requests where id = '70000000-0000-0000-0000-000000000001' and status = 'paid'), 1, 'payment within the balance goes through');

-- ---------- round 6b: automatic audit ----------
select pg_temp.must_equal((select count(*) from public.receipts where audited_at is null and voided_at is null), 0, 'receipts are audited when issued');
reset role;
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', '', false);
update public.wallet_settings set opening_balance = 1000000 where id;
insert into public.money_requests (id, dept, amount, reason, status, paid_at, pay_method, received_at, received_name)
values ('70000000-0000-0000-0000-000000000002', 'mezmur', 500, 'ንጹሕ', 'paid', now(), 'cash', now(), 'x'),
       ('70000000-0000-0000-0000-000000000003', 'mezmur', 500, 'ከበጀት በላይ', 'paid', now(), 'cash', now(), 'x');
insert into public.expense_lines (request_id, amount, reason, spent_on) values
  ('70000000-0000-0000-0000-000000000002', 400, 'ግዢ', current_date),
  ('70000000-0000-0000-0000-000000000003', 700, 'ግዢ', current_date);
update public.money_requests set spend_approved_at = now() where id in ('70000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000003');
select pg_temp.must_equal((select count(*) from public.money_requests where id = '70000000-0000-0000-0000-000000000002' and auto_audited and audited_at is not null), 1, 'clean payment audited automatically');
select pg_temp.must_equal((select count(*) from public.money_requests where id = '70000000-0000-0000-0000-000000000003' and audited_at is null), 1, 'overspend left for audit');

-- ---------- round 7: heads open their department; members ask for መልቀቂያ ----------
reset role;
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', '', false);
update public.dept_assignees set member_id = '10000000-0000-0000-0000-0000000000e2' where dept = 'mezmur';
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select pg_temp.must_equal((select public.has_dept('mezmur')::int), 1, 'head opens own department');
select pg_temp.must_equal((select public.has_dept('finance')::int), 0, 'head does not open other departments');
select pg_temp.must_equal((select cardinality(public.my_head_depts())), 1, 'head departments listed');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_equal((select public.has_dept('mezmur')::int), 0, 'ordinary member has no department');
select public.request_my_departure('moved', 'ወደ ሌላ ከተማ ተዛውሬያለሁ', null);
select pg_temp.must_equal((select count(*) from public.my_departures() where status = 'pending'), 1, 'member sees own request');
select pg_temp.must_fail($q$select public.request_my_departure('moved', 'ሁለተኛ ጥያቄ', null)$q$);
reset role;
select pg_temp.must_equal((select count(*) from public.member_departures where self_requested and member_id = '10000000-0000-0000-0000-0000000000e1'), 1, 'self request stored');

-- ---------- property requests: departments ask, ሒሳብና ንብረት approves ----------
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
insert into public.property_requests (dept, name, qty, price) values ('mezmur', 'ማይክራፎን', 2, 1500);
select pg_temp.must_fail($q$insert into public.property_requests (dept, name, qty) values ('hr', 'x', 1)$q$);
select pg_temp.must_fail($q$insert into public.property_requests (dept, name, qty, status) values ('mezmur', 'x', 1, 'approved')$q$);
select pg_temp.must_fail($q$select public.approve_property_request((select id from public.property_requests where name = 'ማይክራፎን'))$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select public.approve_property_request((select id from public.property_requests where name = 'ማይክራፎን'));
select pg_temp.must_equal((select count(*) from public.dept_property where name = 'ማይክራፎን' and owner_dept = 'mezmur' and source = 'አዲስ በክፍሉ የገዛ'), 1, 'approved request joins property');
select pg_temp.must_equal((select count(*) from public.property_log where item_name = 'ማይክራፎን' and kind = 'added' and value = 3000), 1, 'approval logged for audit');
select pg_temp.must_fail($q$select public.approve_property_request((select id from public.property_requests where name = 'ማይክራፎን'))$q$);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
insert into public.property_requests (dept, name, qty) values ('mezmur', 'ከበሮ ማስቀመጫ', 1);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', false);
select pg_temp.must_fail($q$select public.reject_property_request((select id from public.property_requests where name = 'ከበሮ ማስቀመጫ'), '')$q$);
select public.reject_property_request((select id from public.property_requests where name = 'ከበሮ ማስቀመጫ'), 'ደረሰኝ የለውም');
select pg_temp.must_equal((select count(*) from public.property_requests where status = 'rejected'), 1, 'request rejected');
reset role;

-- ---------- teacher attendance + class attendance summary ----------
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', false);
insert into public.teacher_attendance (offering_id, member_id, att_date, status)
  values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e2', '2026-09-27', 'late');
select pg_temp.must_equal((select attended from public.class_attendance_summary('91000000-0000-0000-0000-000000000001', '3')
  where member_id = '10000000-0000-0000-0000-0000000000e1' and offering_id = '92000000-0000-0000-0000-000000000003'), 1, 'summary counts attendance');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.must_fail($q$insert into public.teacher_attendance (offering_id, member_id, att_date, status) values ('92000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000e2', '2026-09-28', 'present')$q$);
select pg_temp.must_equal((select count(*) from public.class_attendance_summary('91000000-0000-0000-0000-000000000001', '3')), 0, 'summary hidden from other departments');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select pg_temp.must_equal((select count(*) from public.teacher_attendance), 1, 'teacher sees own attendance');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.must_equal((select count(*) from public.teacher_attendance), 0, 'others do not');
reset role;

\echo ALL RLS TESTS PASSED
