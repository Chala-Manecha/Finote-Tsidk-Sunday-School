-- =====================================================================
-- Automatic audit:
--  * A payment is audited automatically when ሒሳብና ንብረት closes its spend
--    report and the department spent no more than it was given (any
--    remainder was returned as ተመላሽ). ኦዲት only handles the exceptions:
--    overspending, a flagged request, or no spend report long after the
--    money was received.
--  * Receipts are issued automatically on approval and are audited at the
--    same moment; voided / re-issued ones stay visible to ኦዲት.
-- =====================================================================

alter table public.money_requests add column auto_audited boolean not null default false;
alter table public.receipts add column auto_audited boolean not null default false;
grant select (auto_audited) on public.receipts to authenticated;

create or replace function public.auto_audit_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare spent numeric;
begin
  if new.spend_approved_at is not null and old.spend_approved_at is null
     and new.audited_at is null and not new.audit_flag and new.received_at is not null then
    select coalesce(sum(amount), 0) into spent from public.expense_lines where request_id = new.id;
    if spent <= new.amount then
      new.audited_at := now();
      new.audited_by := null;
      new.auto_audited := true;
    end if;
  end if;
  return new;
end $$;
-- Named to run after the other BEFORE UPDATE triggers (they fire in name order).
create trigger trg_zz_auto_audit before update on public.money_requests
  for each row execute function public.auto_audit_request();

create or replace function public.number_receipt()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare k text; i int := 0;
begin
  update private.receipt_counter set n = n + 1 where id returning n into new.serial;  -- gapless: rolls back with the insert
  loop
    k := private.code8('receipt|' || new.id || '|' || i);
    exit when not exists (select 1 from public.receipts where code_key = k);
    i := i + 1;
  end loop;
  new.code_key := k;
  new.issued_at := now();
  -- Issued by the system from an approved ገቢ / verified donation → audited at once.
  new.audited_at := now();
  new.audited_by := null;
  new.auto_audited := true;
  return new;
end $$;

-- Existing records: clean ones are marked the same way.
update public.receipts set audited_at = now(), auto_audited = true
where audited_at is null and voided_at is null;

update public.money_requests q set audited_at = now(), auto_audited = true
where q.audited_at is null and not q.audit_flag and q.received_at is not null and q.spend_approved_at is not null
  and (select coalesce(sum(e.amount), 0) from public.expense_lines e where e.request_id = q.id) <= q.amount;
