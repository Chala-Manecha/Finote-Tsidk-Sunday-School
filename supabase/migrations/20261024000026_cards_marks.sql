-- Marks: "absent from the final" flag and a note per student; ID cards: the QR on a member card verifies on /verify.

alter table public.marks
  add column absent boolean not null default false,
  add column note   text check (note is null or length(note) <= 300);

create or replace function public.verify_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare k text := public.code_key(p_code);
begin
  if length(k) <> 8 then return jsonb_build_object('type', null); end if;
  return coalesce(
    (select jsonb_build_object('type', 'receipt', 'code', r.code, 'amount', r.amount, 'payer', r.payer_name,
                               'purpose', r.purpose, 'issued_at', r.issued_at, 'voided', r.voided_at is not null)
       from public.receipts r where r.code_key = k),
    (select jsonb_build_object('type', 'voucher', 'code', q.voucher_no, 'amount', q.amount,
                               'dept', (select name_am from public.departments where code = q.dept),
                               'paid_at', q.paid_at, 'received', q.received_at is not null)
       from public.money_requests q where q.voucher_key = k),
    (select jsonb_build_object('type', 'certificate', 'code', d.cert_no, 'name', m.full_name,
                               'leave_date', d.leave_date, 'approved_at', d.decided_at,
                               'reinstated', d.reinstated_at is not null)
       from public.member_departures d join public.members m on m.id = d.member_id where d.cert_key = k),
    (select jsonb_build_object('type', 'transcript', 'code', t.code, 'name', m.full_name,
                               'year', y.ec_year, 'semester', s.no, 'issued_at', t.issued_at,
                               'class', (select e.class_level from public.enrollments e where e.year_id = y.id and e.member_id = m.id))
       from public.transcripts t join public.members m on m.id = t.member_id
       left join public.semesters s on s.id = t.semester_id
       join public.academic_years y on y.id = coalesce(t.year_id, s.year_id)
       where t.code_key = k),
    -- Member ID card: only what is printed on the card anyway.
    (select jsonb_build_object('type', 'member', 'code', m.reg_no, 'name', m.full_name, 'active', m.is_active,
                               'member_type', m.member_type, 'joined_year', m.joined_year)
       from public.members m where m.reg_key = k),
    jsonb_build_object('type', null));
end $$;
