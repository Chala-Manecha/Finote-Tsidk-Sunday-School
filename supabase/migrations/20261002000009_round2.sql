-- =====================================================================
-- Round 2: hash codes, payment vouchers, receipts, donations,
-- leaving certificates, leadership roles, lost-member watch.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Secret-keyed short codes (HMAC → 8 chars, no 0/1/I/O)
-- The key lives in a schema the API never exposes.
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;

create table private.app_secret (
  id   boolean primary key default true check (id),
  key  text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
);
insert into private.app_secret default values;

-- pgcrypto lives in `extensions` on Supabase, `public` locally — both on the path.
create or replace function private.code8(p text)
returns text language plpgsql stable security definer
set search_path = extensions, public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  n   bigint := ('x' || substr(encode(hmac(p, (select key from private.app_secret), 'sha256'), 'hex'), 1, 10))::bit(40)::bigint;
  res text := '';
begin
  for i in 1..8 loop
    res := substr(alphabet, (n % 32)::int + 1, 1) || res;
    n := n / 32;
  end loop;
  return res;
end $$;
revoke all on function private.code8(text) from public;

create or replace function public.fmt_code(prefix text, k text)
returns text language sql immutable set search_path = ''
as $$ select case when k is null then null else prefix || substr(k, 1, 4) || '-' || substr(k, 5, 4) end $$;

/** Normalise anything a person types ("ፍጽ-ደ-h4tw-82nb", "H4TW82NB") to the 8-char key. */
create or replace function public.code_key(p text)
returns text language sql immutable set search_path = ''
as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- ---------------------------------------------------------------------
-- Members: hash registration ID, first-joined year
-- ---------------------------------------------------------------------
alter table public.members drop column reg_no;
alter table public.members add column reg_key text;
alter table public.members add column joined_year int check (joined_year between 1950 and 2100); -- EC year

update public.members
set reg_key = private.code8(full_name || '|' || created_at::date || '|' || id || '|0')
where reg_key is null;

alter table public.members alter column reg_key set not null;
create unique index members_reg_key_key on public.members (reg_key);
alter table public.members add column reg_no text
  generated always as (public.fmt_code('ፍጽ-', reg_key)) stored;

create or replace function public.set_member_key()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  if tg_op = 'UPDATE' then
    new.reg_key := old.reg_key;      -- issued once, never changes
    return new;
  end if;
  loop
    k := private.code8(new.full_name || '|' || coalesce(new.created_at, now())::date || '|' || new.id || '|' || i);
    exit when not exists (select 1 from public.members where reg_key = k);
    i := i + 1;
  end loop;
  new.reg_key := k;
  return new;
end $$;
create trigger trg_member_key before insert or update on public.members
  for each row execute function public.set_member_key();

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
      nationality, prior_school, secular_school, photo_path, joined_year)
    values (
      btrim(r.full_name), r.sex, r.title, r.work_status, coalesce(r.member_status, 'new'), r.dob,
      r.phone, r.email, r.telegram_username, r.sub_city, coalesce(r.languages, '{}'),
      coalesce(r.geez_level, 'none'), coalesce(r.is_ethiopian, true),
      r.nationality, r.prior_school, r.secular_school, r.photo_path, r.joined_year)
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
      joined_year = r.joined_year
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

-- Feedback now looks members up by the hash ID
create or replace function public.submit_feedback(
  p_reg_no   text,
  p_telegram text,
  p_dept     text,
  p_message  text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text := public.code_key(p_reg_no);
  m     public.members;
  tg_in text := lower(regexp_replace(btrim(coalesce(p_telegram, '')), '^@', ''));
  tg_db text;
begin
  if p_message is null or length(btrim(p_message)) < 3 or length(p_message) > 4000
     or not exists (select 1 from public.departments where code = p_dept) then
    return 'invalid';
  end if;
  if length(v_key) <> 8 then return 'not_found'; end if;
  select * into m from public.members where reg_key = v_key and is_active;
  if not found then return 'not_found'; end if;

  tg_db := lower(regexp_replace(btrim(coalesce(m.telegram_username, '')), '^@', ''));
  if tg_in <> tg_db then return 'mismatch'; end if;

  insert into public.feedback (member_id, dept, message, contact)
  values (m.id, p_dept, btrim(p_message), coalesce(nullif(tg_db, ''), m.phone));
  return 'ok';
end $$;

-- ---------------------------------------------------------------------
-- Money out: payment details, voucher, department receipt, audit review
--   approved → paid (ሒሳብና ንብረት, with method; voucher issued)
--   → received (requesting department signs) → audited (ኦዲት)
-- ---------------------------------------------------------------------
alter table public.money_requests
  add column pay_method    text check (pay_method in ('cash', 'telebirr', 'cbe', 'other')),
  add column pay_reference text,
  add column voucher_key   text unique,
  add column received_at   timestamptz,
  add column received_by   uuid references auth.users (id) on delete set null,
  add column received_name text,
  add column audited_at    timestamptz,
  add column audited_by    uuid references auth.users (id) on delete set null;
alter table public.money_requests add column voucher_no text
  generated always as (public.fmt_code('ፍጽ-ወ-', voucher_key)) stored;

create or replace function private.new_voucher_key(p_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  loop
    k := private.code8('voucher|' || p_id || '|' || i);
    exit when not exists (select 1 from public.money_requests where voucher_key = k);
    i := i + 1;
  end loop;
  return k;
end $$;
revoke all on function private.new_voucher_key(uuid) from public;

-- Requests already paid before round 2 get their voucher now.
update public.money_requests set voucher_key = private.new_voucher_key(id)
where status = 'paid' and voucher_key is null;

create or replace function public.guard_money_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare paying boolean;
begin
  if public.is_service_role() then return new; end if;
  paying := old.status = 'approved' and new.status = 'paid';

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

  -- spend report approval (locks expense lines)
  if new.spend_approved_at is distinct from old.spend_approved_at then
    if old.spend_approved_at is not null then
      raise exception 'spend report already approved';
    end if;
    if not public.has_dept('finance') or old.status not in ('approved', 'paid') then
      raise exception 'only ሒሳብና ንብረት approves spend reports of approved requests';
    end if;
    new.spend_approved_at := now();
    new.spend_approved_by := auth.uid();
  else
    new.spend_approved_by := old.spend_approved_by;
  end if;

  -- payment details only travel with the approved → paid step
  if not paying then
    new.pay_method := old.pay_method;
    new.pay_reference := old.pay_reference;
  end if;
  new.voucher_key := old.voucher_key;

  -- department confirms it received the cash (signs the voucher)
  if new.received_at is distinct from old.received_at then
    if old.received_at is not null or old.status <> 'paid' or not public.has_dept(old.dept) then
      raise exception 'only the requesting department confirms receipt of a paid request, once';
    end if;
    if coalesce(btrim(new.received_name), '') = '' then
      raise exception 'receiver name required';
    end if;
    new.received_at := now();
    new.received_by := auth.uid();
    new.received_name := btrim(new.received_name);
  else
    new.received_by := old.received_by;
    new.received_name := old.received_name;
  end if;

  -- ኦዲት review, only after the department signed
  if new.audited_at is distinct from old.audited_at then
    if old.audited_at is not null or old.received_at is null or not public.has_dept('audit') then
      raise exception 'ኦዲት reviews a payment once, after the department confirmed receipt';
    end if;
    new.audited_at := now();
    new.audited_by := auth.uid();
  else
    new.audited_by := old.audited_by;
  end if;

  if new.status <> old.status then
    if old.status = 'pending' and new.status in ('approved', 'rejected') then
      if not public.has_dept('office') then raise exception 'only ጽሕፈት ቤት approves'; end if;
      new.decided_by := auth.uid(); new.decided_at := now();
    elsif old.status = 'pending' and new.status = 'withdrawn' then
      if not public.has_dept(old.dept) then raise exception 'only the requester can withdraw'; end if;
    elsif paying then
      if not public.has_dept('finance') then raise exception 'only ሒሳብና ንብረት marks paid'; end if;
      if new.pay_method is null then raise exception 'payment method required'; end if;
      new.paid_by := auth.uid(); new.paid_at := now();
      new.voucher_key := private.new_voucher_key(new.id);
    else
      raise exception 'invalid status change % → %', old.status, new.status;
    end if;
  else
    new.decided_by := old.decided_by; new.decided_at := old.decided_at;
    new.paid_by := old.paid_by;       new.paid_at := old.paid_at;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Donation accounts shown on the public ለመርዳት page
-- ---------------------------------------------------------------------
create table public.donation_accounts (
  id               boolean primary key default true check (id),
  account_name     text,
  telebirr_number  text,
  cbe_account      text,
  updated_at       timestamptz not null default now()
);
insert into public.donation_accounts (id) values (true);
alter table public.donation_accounts enable row level security;
grant select on public.donation_accounts to anon, authenticated;
grant update on public.donation_accounts to authenticated;
create policy donation_accounts_read on public.donation_accounts for select using (true);
create policy donation_accounts_write on public.donation_accounts for update to authenticated
  using (public.has_dept('finance')) with check (public.has_dept('finance'));

-- ---------------------------------------------------------------------
-- Donations (claimed by the donor, verified by ሒሳብና ንብረት)
-- ---------------------------------------------------------------------
create table public.donations (
  id             uuid primary key default gen_random_uuid(),
  donor_name     text,                 -- null = anonymous
  donor_phone    text,
  amount         numeric(12,2) not null check (amount > 0),
  method         text not null check (method in ('telebirr', 'cbe')),
  txn_ref        text not null,
  txn_key        text not null unique, -- normalised: a transaction can be claimed once
  purpose        text,
  status         text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  reject_reason  text,
  decided_by     uuid references auth.users (id) on delete set null,
  decided_at     timestamptz,
  term_id        uuid references public.leadership_terms (id) on delete set null default public.active_term_id(),
  created_at     timestamptz not null default now()
);
create index donations_status_idx on public.donations (status, created_at desc);
alter table public.donations enable row level security;
grant select, update on public.donations to authenticated;
create policy donations_read on public.donations for select to authenticated
  using (public.has_any_dept(array['finance', 'audit', 'office']));
create policy donations_update on public.donations for update to authenticated
  using (public.has_dept('finance')) with check (public.has_dept('finance'));

create or replace function public.guard_donation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;
  if (new.donor_name, new.donor_phone, new.amount, new.method, new.txn_ref, new.txn_key, new.purpose, new.created_at)
     is distinct from (old.donor_name, old.donor_phone, old.amount, old.method, old.txn_ref, old.txn_key, old.purpose, old.created_at) then
    raise exception 'donation details cannot change';
  end if;
  if new.status <> old.status then
    if old.status <> 'pending' or new.status not in ('verified', 'rejected') or not public.has_dept('finance') then
      raise exception 'only ሒሳብና ንብረት verifies or rejects a pending donation';
    end if;
    if new.status = 'rejected' and coalesce(btrim(new.reject_reason), '') = '' then
      raise exception 'reject reason required';
    end if;
    new.decided_by := auth.uid(); new.decided_at := now();
  else
    if old.status <> 'pending' then raise exception 'decided donations are read-only'; end if;
    new.decided_by := old.decided_by; new.decided_at := old.decided_at; new.reject_reason := old.reject_reason;
  end if;
  return new;
end $$;
create trigger trg_guard_donation before update on public.donations
  for each row execute function public.guard_donation();

/** Public: donor claims a transfer. 'ok' | 'duplicate' | 'invalid' */
create or replace function public.submit_donation(
  p_name text, p_phone text, p_amount numeric, p_method text, p_txn text, p_purpose text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_key text := public.code_key(p_txn);
begin
  if p_amount is null or p_amount <= 0 or p_amount > 10000000 or p_method not in ('telebirr', 'cbe')
     or length(v_key) < 6 or length(v_key) > 40
     or length(coalesce(p_name, '')) > 120 or length(coalesce(p_purpose, '')) > 300 then
    return 'invalid';
  end if;
  if exists (select 1 from public.donations where txn_key = v_key) then return 'duplicate'; end if;
  insert into public.donations (donor_name, donor_phone, amount, method, txn_ref, txn_key, purpose)
  values (nullif(btrim(p_name), ''), nullif(btrim(p_phone), ''), round(p_amount, 2), p_method,
          btrim(p_txn), v_key, nullif(btrim(p_purpose), ''));
  return 'ok';
exception when unique_violation then
  return 'duplicate';
end $$;

/** Public: donor tracks a claim by its transaction number. */
create or replace function public.donation_status(p_txn text)
returns text language plpgsql stable security definer set search_path = ''
as $$
begin
  return coalesce((
    select case
      when d.status = 'verified' and exists (select 1 from public.receipts r where r.donation_id = d.id and r.voided_at is null) then 'ready'
      when d.status = 'verified' then 'voided'
      else d.status end
    from public.donations d where d.txn_key = public.code_key(p_txn)), 'not_found');
end $$;

-- ---------------------------------------------------------------------
-- Receipts: immutable, gapless hidden serial, hash code, void + reissue
-- ---------------------------------------------------------------------
create table private.receipt_counter (id boolean primary key default true check (id), n bigint not null default 0);
insert into private.receipt_counter default values;

create table public.receipts (
  id             uuid primary key default gen_random_uuid(),
  serial         bigint not null unique,           -- hidden running number (ኦዲት only)
  code_key       text not null unique,
  kind           text not null check (kind in ('income', 'donation')),
  earning_id     uuid references public.earnings (id) on delete restrict,
  donation_id    uuid references public.donations (id) on delete restrict,
  dept           text references public.departments (code),
  amount         numeric(12,2) not null,
  payer_name     text not null,
  payer_phone    text,
  method         text,
  txn_ref        text,
  account_label  text,
  purpose        text,
  received_on    date not null,
  term_id        uuid references public.leadership_terms (id) on delete set null,
  verified_by    uuid references auth.users (id) on delete set null,
  issued_by      uuid references auth.users (id) on delete set null,
  issued_at      timestamptz not null default now(),
  print_count    int not null default 0,
  voided_at      timestamptz,
  void_reason    text,
  voided_by      uuid references auth.users (id) on delete set null,
  audited_at     timestamptz,
  audited_by     uuid references auth.users (id) on delete set null,
  check ((kind = 'income' and earning_id is not null and dept is not null)
      or (kind = 'donation' and donation_id is not null))
);
alter table public.receipts add column code text generated always as (public.fmt_code('ፍጽ-ደ-', code_key)) stored;
create unique index receipts_one_live_earning on public.receipts (earning_id) where voided_at is null and earning_id is not null;
create unique index receipts_one_live_donation on public.receipts (donation_id) where voided_at is null and donation_id is not null;
create index receipts_issued_idx on public.receipts (issued_at desc);

create or replace function public.number_receipt()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  update private.receipt_counter set n = n + 1 returning n into new.serial;  -- gapless: rolls back with the insert
  loop
    k := private.code8('receipt|' || new.id || '|' || i);
    exit when not exists (select 1 from public.receipts where code_key = k);
    i := i + 1;
  end loop;
  new.code_key := k;
  new.issued_at := now();
  return new;
end $$;
create trigger trg_number_receipt before insert on public.receipts
  for each row execute function public.number_receipt();

create or replace function public.guard_receipt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_role() then return new; end if;
  if (new.serial, new.code_key, new.kind, new.earning_id, new.donation_id, new.dept, new.amount, new.payer_name,
      new.payer_phone, new.method, new.txn_ref, new.account_label, new.purpose, new.received_on, new.term_id,
      new.verified_by, new.issued_by, new.issued_at)
     is distinct from
     (old.serial, old.code_key, old.kind, old.earning_id, old.donation_id, old.dept, old.amount, old.payer_name,
      old.payer_phone, old.method, old.txn_ref, old.account_label, old.purpose, old.received_on, old.term_id,
      old.verified_by, old.issued_by, old.issued_at) then
    raise exception 'receipts are immutable';
  end if;
  if new.print_count < old.print_count then raise exception 'receipts are immutable'; end if;

  if new.voided_at is distinct from old.voided_at then
    if old.voided_at is not null or not public.has_dept('finance') or coalesce(btrim(new.void_reason), '') = '' then
      raise exception 'only ሒሳብና ንብረት voids a receipt, once, with a reason';
    end if;
    new.voided_at := now(); new.voided_by := auth.uid(); new.void_reason := btrim(new.void_reason);
  else
    new.voided_by := old.voided_by; new.void_reason := old.void_reason;
  end if;

  if new.audited_at is distinct from old.audited_at then
    if old.audited_at is not null or not public.has_dept('audit') then
      raise exception 'only ኦዲት reviews a receipt, once';
    end if;
    new.audited_at := now(); new.audited_by := auth.uid();
  else
    new.audited_by := old.audited_by;
  end if;
  return new;
end $$;
create trigger trg_guard_receipt before update on public.receipts
  for each row execute function public.guard_receipt();

alter table public.receipts enable row level security;
-- every column except the hidden serial
grant select (id, code_key, code, kind, earning_id, donation_id, dept, amount, payer_name, payer_phone, method,
              txn_ref, account_label, purpose, received_on, term_id, verified_by, issued_by, issued_at,
              print_count, voided_at, void_reason, voided_by, audited_at, audited_by)
  on public.receipts to authenticated;
grant update (voided_at, void_reason, audited_at) on public.receipts to authenticated;
grant all on public.receipts to service_role;
create policy receipts_read on public.receipts for select to authenticated
  using (public.has_any_dept(array['finance', 'audit', 'office'])
         or (kind = 'income' and public.has_dept(dept)));
create policy receipts_update on public.receipts for update to authenticated
  using (public.has_any_dept(array['finance', 'audit']))
  with check (public.has_any_dept(array['finance', 'audit']));

-- Issue a receipt when ሒሳብና ንብረት approves income …
create or replace function public.receipt_for_earning()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    insert into public.receipts (serial, code_key, kind, earning_id, dept, amount, payer_name, purpose,
                                 received_on, term_id, verified_by, issued_by)
    select 0, '', 'income', new.id, new.dept, new.amount, d.name_am, new.source,
           new.earned_on, new.term_id, new.decided_by, new.decided_by
    from public.departments d where d.code = new.dept;
  end if;
  return new;
end $$;
create trigger trg_receipt_for_earning after update of status on public.earnings
  for each row execute function public.receipt_for_earning();

-- … and when it verifies a donation
create or replace function public.receipt_for_donation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare a public.donation_accounts;
begin
  if new.status = 'verified' and old.status <> 'verified' then
    select * into a from public.donation_accounts limit 1;
    insert into public.receipts (serial, code_key, kind, donation_id, amount, payer_name, payer_phone, method,
                                 txn_ref, account_label, purpose, received_on, term_id, verified_by, issued_by)
    values (0, '', 'donation', new.id, new.amount, coalesce(new.donor_name, 'ስም አልባ'), new.donor_phone, new.method,
            new.txn_ref,
            case new.method when 'telebirr' then concat_ws(' · ', a.account_name, 'Telebirr ' || a.telebirr_number)
                            else concat_ws(' · ', a.account_name, 'CBE ' || a.cbe_account) end,
            new.purpose, (new.created_at at time zone 'Africa/Addis_Ababa')::date, new.term_id,
            new.decided_by, new.decided_by);
  end if;
  return new;
end $$;
create trigger trg_receipt_for_donation after update of status on public.donations
  for each row execute function public.receipt_for_donation();

-- Income approved before round 2 gets its receipt now.
insert into public.receipts (serial, code_key, kind, earning_id, dept, amount, payer_name, purpose,
                             received_on, term_id, verified_by, issued_by)
select 0, '', 'income', e.id, e.dept, e.amount, d.name_am, e.source, e.earned_on, e.term_id, e.decided_by, e.decided_by
from public.earnings e join public.departments d on d.code = e.dept
where e.status = 'approved'
order by e.decided_at nulls first, e.submitted_at;

/** A voided receipt can be replaced by a new one (new code, next serial). ሒሳብና ንብረት only. */
create or replace function public.reissue_receipt(p_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare r public.receipts; v_new uuid;
begin
  if not public.has_dept('finance') then raise exception 'only ሒሳብና ንብረት reissues receipts'; end if;
  select * into r from public.receipts where id = p_id;
  if not found or r.voided_at is null then raise exception 'only a voided receipt can be reissued'; end if;
  insert into public.receipts (serial, code_key, kind, earning_id, donation_id, dept, amount, payer_name, payer_phone,
                               method, txn_ref, account_label, purpose, received_on, term_id, verified_by, issued_by)
  values (0, '', r.kind, r.earning_id, r.donation_id, r.dept, r.amount, r.payer_name, r.payer_phone,
          r.method, r.txn_ref, r.account_label, r.purpose, r.received_on, r.term_id, r.verified_by, auth.uid())
  returning id into v_new;
  return v_new;
end $$;

/** Count a print; the first print is the original, later ones are ቅጂ. */
create or replace function public.mark_receipt_printed(p_id uuid)
returns int language plpgsql security definer set search_path = ''
as $$
declare v int;
begin
  update public.receipts set print_count = print_count + 1
  where id = p_id and voided_at is null
    and (public.has_any_dept(array['finance', 'audit', 'office']) or (kind = 'income' and public.has_dept(dept)))
  returning print_count into v;
  return v;
end $$;

/** ኦዲት: full detail of a receipt by its code, including the hidden serial. */
create or replace function public.receipt_audit(p_code text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare r public.receipts; res jsonb;
begin
  if not public.has_dept('audit') then raise exception 'ኦዲት only'; end if;
  select * into r from public.receipts where code_key = public.code_key(p_code);
  if not found then return null; end if;
  res := to_jsonb(r) || jsonb_build_object(
    'verified_by_name', (select full_name from public.staff_profiles where user_id = r.verified_by),
    'issued_by_name',   (select full_name from public.staff_profiles where user_id = r.issued_by),
    'voided_by_name',   (select full_name from public.staff_profiles where user_id = r.voided_by),
    'audited_by_name',  (select full_name from public.staff_profiles where user_id = r.audited_by),
    'dept_name',        (select name_am from public.departments where code = r.dept),
    'replaced_by', (select code from public.receipts x
                    where x.id <> r.id and x.voided_at is null
                      and (x.earning_id = r.earning_id or x.donation_id = r.donation_id)));
  return res;
end $$;

/** ኦዲት: serial numbers missing from the sequence (should always be empty). */
create or replace function public.receipt_serial_gaps()
returns table (missing bigint) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_dept('audit') then raise exception 'ኦዲት only'; end if;
  return query
    select g from generate_series(1, (select n from private.receipt_counter)) g
    where not exists (select 1 from public.receipts where serial = g);
end $$;

/** ኦዲት: receipts with serials, for the register. */
create or replace function public.receipt_register(p_from date, p_to date)
returns table (id uuid, serial bigint, code text, kind text, dept text, amount numeric, payer_name text,
               method text, issued_at timestamptz, voided_at timestamptz, audited_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.has_dept('audit') then raise exception 'ኦዲት only'; end if;
  return query
    select r.id, r.serial, r.code, r.kind, r.dept, r.amount, r.payer_name, r.method, r.issued_at, r.voided_at, r.audited_at
    from public.receipts r
    where (r.issued_at at time zone 'Africa/Addis_Ababa')::date between p_from and p_to
    order by r.serial;
end $$;

-- ---------------------------------------------------------------------
-- Leaving members (መልቀቂያ): HR requests → ጽሕፈት ቤት approves → certificate
-- ---------------------------------------------------------------------
create table public.member_departures (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.members (id) on delete restrict,
  leave_date       date not null,
  reason_text      text not null check (length(btrim(reason_text)) > 2),
  reason_category  text not null check (reason_category in ('moved', 'marriage', 'study', 'work', 'other_church', 'other')),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  commendation     text,
  decision_note    text,
  requested_by     uuid references auth.users (id) on delete set null,
  requested_at     timestamptz not null default now(),
  decided_by       uuid references auth.users (id) on delete set null,
  decided_at       timestamptz,
  cert_key         text unique,
  print_count      int not null default 0,
  reinstated_at    timestamptz,
  reinstated_by    uuid references auth.users (id) on delete set null,
  term_id          uuid references public.leadership_terms (id) on delete set null default public.active_term_id()
);
alter table public.member_departures add column cert_no text
  generated always as (public.fmt_code('ፍጽ-መ-', cert_key)) stored;
create unique index member_departures_one_open on public.member_departures (member_id)
  where status = 'pending' or (status = 'approved' and reinstated_at is null);

alter table public.member_departures enable row level security;
grant select, insert, update, delete on public.member_departures to authenticated;
create policy departures_read on public.member_departures for select to authenticated
  using (public.has_any_dept(array['hr', 'office', 'audit']));
create policy departures_insert on public.member_departures for insert to authenticated
  with check (public.has_dept('hr') and status = 'pending');
create policy departures_update on public.member_departures for update to authenticated
  using (public.has_any_dept(array['hr', 'office'])) with check (public.has_any_dept(array['hr', 'office']));
create policy departures_delete on public.member_departures for delete to authenticated
  using (public.has_dept('hr') and status = 'pending');

create or replace function public.guard_departure()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  if tg_op = 'INSERT' then
    new.requested_by := auth.uid(); new.requested_at := now();
    new.status := 'pending'; new.decided_by := null; new.decided_at := null;
    new.cert_key := null; new.reinstated_at := null; new.print_count := 0;
    return new;
  end if;
  if public.is_service_role() then return new; end if;

  if new.member_id <> old.member_id or new.requested_by is distinct from old.requested_by
     or new.requested_at <> old.requested_at then
    raise exception 'request identity cannot change';
  end if;
  if (new.leave_date, new.reason_text, new.reason_category) is distinct from (old.leave_date, old.reason_text, old.reason_category)
     and not (old.status = 'pending' and public.has_dept('hr')) then
    raise exception 'only HR edits a pending request';
  end if;
  new.cert_key := old.cert_key;
  if new.print_count < old.print_count then raise exception 'print count only grows'; end if;

  if new.status <> old.status then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') or not public.has_dept('office') then
      raise exception 'only ጽሕፈት ቤት decides a pending request';
    end if;
    new.decided_by := auth.uid(); new.decided_at := now();
    if new.status = 'approved' then
      loop
        k := private.code8('cert|' || new.id || '|' || i);
        exit when not exists (select 1 from public.member_departures where cert_key = k);
        i := i + 1;
      end loop;
      new.cert_key := k;
      update public.members set is_active = false where id = new.member_id;   -- frozen, history kept
    end if;
  else
    if (new.commendation, new.decision_note) is distinct from (old.commendation, old.decision_note)
       and not (old.status = 'pending' and public.has_dept('office')) then
      raise exception 'commendation is written by ጽሕፈት ቤት when deciding';
    end if;
    new.decided_by := old.decided_by; new.decided_at := old.decided_at;
  end if;

  if new.reinstated_at is distinct from old.reinstated_at then
    if old.reinstated_at is not null or old.status <> 'approved' then
      raise exception 'only an approved departure can be reinstated, once';
    end if;
    new.reinstated_at := now(); new.reinstated_by := auth.uid();
    update public.members set is_active = true where id = new.member_id;
  else
    new.reinstated_by := old.reinstated_by;
  end if;
  return new;
end $$;
create trigger trg_guard_departure before insert or update on public.member_departures
  for each row execute function public.guard_departure();

create or replace function public.mark_certificate_printed(p_id uuid)
returns int language plpgsql security definer set search_path = ''
as $$
declare v int;
begin
  update public.member_departures set print_count = print_count + 1
  where id = p_id and status = 'approved' and public.has_dept('hr')
  returning print_count into v;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Leadership roles per term (HR enters after each election)
-- ---------------------------------------------------------------------
create table public.leadership_roles (
  id         uuid primary key default gen_random_uuid(),
  term_id    uuid not null references public.leadership_terms (id) on delete cascade,
  dept       text not null references public.departments (code),
  role       text not null check (role in ('head', 'deputy', 'secretary')),
  member_id  uuid not null references public.members (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (term_id, dept, role)
);
alter table public.leadership_roles enable row level security;
grant select, insert, update, delete on public.leadership_roles to authenticated;
create policy leadership_roles_read on public.leadership_roles for select to authenticated using (public.is_staff());
create policy leadership_roles_write on public.leadership_roles for all to authenticated
  using (public.has_dept('hr')) with check (public.has_dept('hr'));

-- ---------------------------------------------------------------------
-- Lost members: absent from BOTH መዝሙር and ኮርስ
--   clock starts at the first missed session after they were last seen
--   and runs to the latest session held (pauses when no sessions are held)
-- ---------------------------------------------------------------------
create or replace function public.member_absence_watch()
returns table (member_id uuid, full_name text, reg_no text, phone text, telegram_username text,
               last_seen date, first_missed date, days_absent int, level text)
language sql stable security invoker set search_path = ''
as $$
  with s as (
    select id, session_date from public.attendance_sessions
    where session_type in ('mezmur', 'course')
      and session_date <= (now() at time zone 'Africa/Addis_Ababa')::date
  ),
  latest as (select max(session_date) as d from s),
  seen as (
    select a.member_id, max(s.session_date) as d
    from public.attendance a join s on s.id = a.session_id
    where a.status in ('present', 'half')
    group by a.member_id
  ),
  calc as (
    select m.id, m.full_name, m.reg_no, m.phone, m.telegram_username, seen.d as last_seen,
           (select min(s.session_date) from s
             where s.session_date > greatest(coalesce(seen.d, '-infinity'::date),
                                             (m.created_at at time zone 'Africa/Addis_Ababa')::date - 1)) as first_missed
    from public.members m left join seen on seen.member_id = m.id
    where m.is_active
  )
  select c.id, c.full_name, c.reg_no, c.phone, c.telegram_username, c.last_seen, c.first_missed,
         coalesce((select d from latest) - c.first_missed, 0) as days_absent,
         case when (select d from latest) - c.first_missed >= 30 then 'lost' else 'warning' end
  from calc c
  where (select d from latest) - c.first_missed >= 20
  order by 8 desc, c.full_name
$$;
revoke all on function public.member_absence_watch() from public, anon;
grant execute on function public.member_absence_watch() to authenticated;

create table public.lost_followups (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members (id) on delete cascade,
  contacted_on  date not null,
  note          text not null check (length(btrim(note)) > 0),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index lost_followups_member_idx on public.lost_followups (member_id, contacted_on desc);
create trigger trg_lost_followups_creator before insert on public.lost_followups
  for each row execute function public.stamp_creator();
alter table public.lost_followups enable row level security;
grant select, insert, delete on public.lost_followups to authenticated;
create policy lost_followups_read on public.lost_followups for select to authenticated
  using (public.has_any_dept(array['audit', 'hr', 'office']));
create policy lost_followups_write on public.lost_followups for insert to authenticated
  with check (public.has_any_dept(array['audit', 'hr']));
create policy lost_followups_delete on public.lost_followups for delete to authenticated
  using (public.has_dept('audit') and created_by = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Public verification of a printed receipt, voucher or certificate
-- ---------------------------------------------------------------------
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
    jsonb_build_object('type', null));
end $$;


-- ---------------------------------------------------------------------
-- Department money contribution for a period (for certificates; same
-- formula as the ኦዲት ranking): income + ከራስ ወጪ − (paid out − refunds)
-- ---------------------------------------------------------------------
create or replace function public.dept_contributions(p_from date, p_to date)
returns table (dept text, net numeric, rank int)
language sql stable security definer set search_path = ''
as $$
  with req as (
    select q.dept, q.amount, q.paid_at, q.spend_approved_at,
           coalesce((select sum(l.amount) from public.expense_lines l where l.request_id = q.id), 0) as spent
    from public.money_requests q where q.status in ('approved', 'paid')
  ),
  parts as (
    select e.dept, e.amount as v from public.earnings e
      where e.status = 'approved' and e.earned_on between p_from and p_to
    union all
    select r.dept, -r.amount from req r where r.paid_at is not null and r.paid_at::date between p_from and p_to
    union all
    select r.dept, greatest(r.amount - r.spent, 0) + greatest(r.spent - r.amount, 0)
      from req r where r.spend_approved_at is not null and r.spend_approved_at::date between p_from and p_to
  ),
  tot as (
    select d.code as dept, coalesce(sum(p.v), 0) as net
    from public.departments d left join parts p on p.dept = d.code
    group by d.code
  )
  select t.dept, t.net, (rank() over (order by t.net desc))::int from tot t
  where public.is_staff()
$$;
revoke all on function public.dept_contributions(date, date) from public, anon;
grant execute on function public.dept_contributions(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------
revoke all on function
  public.submit_donation(text, text, numeric, text, text, text), public.donation_status(text),
  public.verify_code(text), public.reissue_receipt(uuid), public.mark_receipt_printed(uuid),
  public.receipt_audit(text), public.receipt_serial_gaps(), public.receipt_register(date, date),
  public.mark_certificate_printed(uuid)
from public;
grant execute on function
  public.submit_donation(text, text, numeric, text, text, text), public.donation_status(text), public.verify_code(text)
to anon, authenticated;
grant execute on function
  public.reissue_receipt(uuid), public.mark_receipt_printed(uuid), public.receipt_audit(text),
  public.receipt_serial_gaps(), public.receipt_register(date, date), public.mark_certificate_printed(uuid)
to authenticated;

grant all on public.donation_accounts, public.donations, public.member_departures,
  public.leadership_roles, public.lost_followups to service_role;
