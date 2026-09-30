-- =====================================================================
-- Feedback round 1 (2026-10-01)
--   * member registration IDs (ፍጽ-0001), photo, multi-language,
--     unique full names, max 2 sub-memberships
--   * leadership terms (ቡድን) + automatic term tagging
--   * spend-report approval by ሒሳብና ንብረት (locks expense lines)
--   * wallet opening balance
--   * property log (added / maintained / lost) for the property ranking
--   * public shop: images, contact, sales → ገቢ → stock decrease
--   * feedback authenticated by registration ID + Telegram username
--   * department description PDFs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Leadership terms (one team for the whole Sunday school per term)
-- ---------------------------------------------------------------------
create table public.leadership_terms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- e.g. አትናቴዎስ
  team_no     int,                           -- e.g. 11  → "ቡድን-11"
  starts_on   date,
  ends_on     date,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index leadership_terms_one_active on public.leadership_terms (is_active) where is_active;

create or replace function public.active_term_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.leadership_terms where is_active limit 1 $$;
grant execute on function public.active_term_id() to anon, authenticated, service_role;

-- Switch the active term atomically (ጽሕፈት ቤት only — RLS applies)
create or replace function public.set_active_term(p_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  update public.leadership_terms set is_active = false where is_active and id <> p_id;
  update public.leadership_terms set is_active = true where id = p_id;
  if not found then raise exception 'term not found or not permitted'; end if;
end $$;
revoke all on function public.set_active_term(uuid) from public, anon;
grant execute on function public.set_active_term(uuid) to authenticated;

alter table public.leadership_terms enable row level security;
grant select on public.leadership_terms to anon, authenticated;
grant insert, update, delete on public.leadership_terms to authenticated;
create policy terms_read on public.leadership_terms for select using (true);
create policy terms_write on public.leadership_terms for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

-- Tag records with the term active when they were created (no staff effort).
do $$
declare t text;
begin
  foreach t in array array['members', 'events', 'money_requests', 'expense_lines', 'earnings',
                           'attendance_sessions', 'duty_assignments', 'feedback'] loop
    execute format(
      'alter table public.%I add column term_id uuid references public.leadership_terms (id) on delete set null default public.active_term_id()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Members: registration ID, photo, languages, unique names, ≤2 depts
-- ---------------------------------------------------------------------
create sequence public.member_reg_seq;
alter table public.members add column reg_seq int not null default nextval('public.member_reg_seq');
alter sequence public.member_reg_seq owned by public.members.reg_seq;
grant usage, select on sequence public.member_reg_seq to authenticated, service_role;
alter table public.members add column reg_no text
  generated always as ('ፍጽ-' || lpad(reg_seq::text, 4, '0')) stored;
create unique index members_reg_no_key on public.members (reg_no);
create unique index members_reg_seq_key on public.members (reg_seq);

alter table public.members add column photo_path text;
alter table public.members add column languages text[] not null default '{}';
update public.members set languages = array[language] where language is not null and language <> '';
alter table public.members drop column language;

create or replace function public.norm_name(n text)
returns text language sql immutable
as $$ select lower(regexp_replace(btrim(coalesce(n, '')), '\s+', ' ', 'g')) $$;

-- Trigger rather than a unique index so any duplicates already in the
-- database don't block this migration; every new save is checked.
create or replace function public.guard_member_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_active and exists (
    select 1 from public.members m
    where m.is_active and m.id <> new.id
      and public.norm_name(m.full_name) = public.norm_name(new.full_name)
  ) then
    raise exception 'duplicate_name' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_guard_member_name before insert or update of full_name, is_active on public.members
  for each row execute function public.guard_member_name();

create or replace function public.guard_member_depts()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.member_departments where member_id = new.member_id) > 2 then
    raise exception 'max_two_departments' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_guard_member_depts after insert on public.member_departments
  for each row execute function public.guard_member_depts();

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
  r := jsonb_populate_record(null::public.members, p_member);

  if v_id is null then
    insert into public.members (
      full_name, sex, title, work_status, member_status, dob, phone, email,
      telegram_username, sub_city, languages, geez_level, is_ethiopian,
      nationality, prior_school, secular_school, photo_path)
    values (
      btrim(r.full_name), r.sex, r.title, r.work_status, coalesce(r.member_status, 'new'), r.dob,
      r.phone, r.email, r.telegram_username, r.sub_city, coalesce(r.languages, '{}'),
      coalesce(r.geez_level, 'none'), coalesce(r.is_ethiopian, true),
      r.nationality, r.prior_school, r.secular_school, r.photo_path)
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
      photo_path = coalesce(r.photo_path, photo_path)
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

-- ---------------------------------------------------------------------
-- Spend-report approval (ሒሳብና ንብረት) — locks the expense lines
-- ---------------------------------------------------------------------
alter table public.money_requests
  add column spend_approved_at timestamptz,
  add column spend_approved_by uuid references auth.users (id) on delete set null;

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
    new.decided_by := old.decided_by; new.decided_at := old.decided_at;
    new.paid_by := old.paid_by;       new.paid_at := old.paid_at;
  end if;
  return new;
end $$;

drop policy expense_lines_insert on public.expense_lines;
drop policy expense_lines_update on public.expense_lines;
drop policy expense_lines_delete on public.expense_lines;
create policy expense_lines_insert on public.expense_lines for insert to authenticated
  with check (exists (select 1 from public.money_requests r where r.id = request_id
                      and public.has_dept(r.dept) and r.status in ('approved', 'paid')
                      and r.spend_approved_at is null));
create policy expense_lines_update on public.expense_lines for update to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id
                 and public.has_dept(r.dept) and r.spend_approved_at is null))
  with check (exists (select 1 from public.money_requests r where r.id = request_id
                      and public.has_dept(r.dept) and r.status in ('approved', 'paid')
                      and r.spend_approved_at is null));
create policy expense_lines_delete on public.expense_lines for delete to authenticated
  using (exists (select 1 from public.money_requests r where r.id = request_id
                 and public.has_dept(r.dept) and r.spend_approved_at is null));

-- ---------------------------------------------------------------------
-- Wallet: opening balance set once by ሒሳብና ንብረት
-- balance = opening + approved ገቢ − paid requests + returned ተመላሽ
-- ---------------------------------------------------------------------
create table public.wallet_settings (
  id               boolean primary key default true check (id),
  opening_balance  numeric(12,2) not null default 0,
  as_of            date,
  updated_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now()
);
insert into public.wallet_settings (id) values (true);
alter table public.wallet_settings enable row level security;
grant select, update on public.wallet_settings to authenticated;
create policy wallet_read on public.wallet_settings for select to authenticated using (public.is_staff());
create policy wallet_write on public.wallet_settings for update to authenticated
  using (public.has_dept('finance')) with check (public.has_dept('finance'));

-- ---------------------------------------------------------------------
-- Property log (entered by ሒሳብና ንብረት, reported by ኦዲት)
-- ---------------------------------------------------------------------
create type public.property_log_kind as enum ('added', 'maintained', 'lost');

create table public.property_log (
  id           uuid primary key default gen_random_uuid(),
  dept         text not null references public.departments (code),
  kind         public.property_log_kind not null,
  item_name    text not null,
  property_id  uuid references public.dept_property (id) on delete set null,
  qty          int not null default 1 check (qty > 0),
  value        numeric(12,2) not null default 0 check (value >= 0),   -- total birr value of the entry
  note         text,
  log_date     date not null,
  term_id      uuid references public.leadership_terms (id) on delete set null default public.active_term_id(),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index property_log_date_idx on public.property_log (log_date);
create trigger trg_property_log_creator before insert on public.property_log
  for each row execute function public.stamp_creator();
alter table public.property_log enable row level security;
grant select, insert, update, delete on public.property_log to authenticated;
create policy property_log_read on public.property_log for select to authenticated using (public.is_staff());
create policy property_log_write on public.property_log for all to authenticated
  using (public.has_dept('finance')) with check (public.has_dept('finance'));

-- ---------------------------------------------------------------------
-- Public shop (ልማትና በጎ አድራጎት)
-- ---------------------------------------------------------------------
alter table public.sale_items add column image_path text, add column description text;
drop policy sale_items_read on public.sale_items;
create policy sale_items_read on public.sale_items for select using (true);
grant select on public.sale_items to anon;

create table public.shop_settings (
  id          boolean primary key default true check (id),
  phone       text,
  telegram    text,
  updated_at  timestamptz not null default now()
);
insert into public.shop_settings (id) values (true);
alter table public.shop_settings enable row level security;
grant select on public.shop_settings to anon, authenticated;
grant update on public.shop_settings to authenticated;
create policy shop_settings_read on public.shop_settings for select using (true);
create policy shop_settings_write on public.shop_settings for update to authenticated
  using (public.has_dept('development')) with check (public.has_dept('development'));

-- A sale is recorded as a ገቢ report; approval by ሒሳብና ንብረት reduces stock.
alter table public.earnings
  add column sale_item_id uuid references public.sale_items (id) on delete set null,
  add column sale_qty int check (sale_qty > 0),
  add constraint earnings_sale_consistent check (
    (sale_item_id is null and sale_qty is null) or (sale_item_id is not null and sale_qty is not null and dept = 'development'));

create or replace function public.apply_sale_on_approval()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' and new.sale_item_id is not null then
    update public.sale_items set qty = greatest(qty - new.sale_qty, 0), updated_at = now()
    where id = new.sale_item_id;
  end if;
  return new;
end $$;
create trigger trg_apply_sale after update of status on public.earnings
  for each row execute function public.apply_sale_on_approval();

-- ---------------------------------------------------------------------
-- Feedback: authenticated by registration ID + Telegram username
-- Returns 'ok' | 'mismatch' | 'not_found' | 'invalid'
-- ---------------------------------------------------------------------
drop policy feedback_submit on public.feedback;
revoke insert on public.feedback from anon;

create or replace function public.submit_feedback(
  p_reg_no   text,
  p_telegram text,
  p_dept     text,
  p_message  text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_seq int;
  m     public.members;
  tg_in text := lower(regexp_replace(btrim(coalesce(p_telegram, '')), '^@', ''));
  tg_db text;
begin
  if p_message is null or length(btrim(p_message)) < 3 or length(p_message) > 4000
     or not exists (select 1 from public.departments where code = p_dept) then
    return 'invalid';
  end if;
  -- accept "ፍጽ-0012", "0012" or "12"
  v_seq := nullif(regexp_replace(coalesce(p_reg_no, ''), '\D', '', 'g'), '')::int;
  if v_seq is null then return 'not_found'; end if;
  select * into m from public.members where reg_seq = v_seq and is_active;
  if not found then return 'not_found'; end if;

  tg_db := lower(regexp_replace(btrim(coalesce(m.telegram_username, '')), '^@', ''));
  if tg_in <> tg_db then return 'mismatch'; end if;

  insert into public.feedback (member_id, dept, message, contact)
  values (m.id, p_dept, btrim(p_message), coalesce(nullif(tg_db, ''), m.phone));
  return 'ok';
end $$;
revoke all on function public.submit_feedback(text, text, text, text) from public;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated;

-- The name list is no longer needed publicly (feedback uses the ID now).
revoke execute on function public.public_member_names() from anon;

-- ---------------------------------------------------------------------
-- Department description PDFs (ጽሕፈት ቤት uploads, public reads)
-- ---------------------------------------------------------------------
create table public.dept_documents (
  dept        text primary key references public.departments (code),
  file_path   text not null,
  file_name   text,
  updated_at  timestamptz not null default now()
);
create trigger trg_dept_documents_updated before update on public.dept_documents
  for each row execute function public.set_updated_at();
alter table public.dept_documents enable row level security;
grant select on public.dept_documents to anon, authenticated;
grant insert, update, delete on public.dept_documents to authenticated;
create policy dept_docs_read on public.dept_documents for select using (true);
create policy dept_docs_write on public.dept_documents for all to authenticated
  using (public.has_dept('office')) with check (public.has_dept('office'));

-- New tables: the backend key needs access too
grant all on public.leadership_terms, public.wallet_settings, public.property_log,
  public.shop_settings, public.dept_documents to service_role;
