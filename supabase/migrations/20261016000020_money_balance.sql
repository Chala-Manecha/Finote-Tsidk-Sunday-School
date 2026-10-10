-- =====================================================================
-- 1) Fix: receipt numbering ran "UPDATE … SET" without WHERE, which Supabase
--    (pg_safeupdate) refuses — approving ገቢ failed with
--    "UPDATE requires a WHERE clause".
-- 2) The school's money balance lives in the database too, so a payment
--    (ወጪ) can never take it below zero.
-- =====================================================================

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
  return new;
end $$;

/**
 * Current balance, the same formula as the ledger pages:
 * opening + approved ገቢ + verified donations − paid requests + returned ተመላሽ
 * (only movements from the opening date on).
 */
create or replace function public.wallet_balance()
returns numeric language sql stable security definer set search_path = ''
as $$
  with w as (select coalesce(opening_balance, 0) as opening, coalesce(as_of, '0001-01-01'::date) as since
             from public.wallet_settings where id)
  select w.opening
    + coalesce((select sum(e.amount) from public.earnings e where e.status = 'approved' and e.earned_on >= w.since), 0)
    + coalesce((select sum(r.amount) from public.receipts r
                 where r.kind = 'donation' and r.voided_at is null and r.received_on >= w.since), 0)
    - coalesce((select sum(q.amount) from public.money_requests q
                 where q.paid_at is not null and q.paid_at::date >= w.since), 0)
    + coalesce((select sum(t.refund) from public.money_request_totals t join public.money_requests q on q.id = t.id
                 where q.spend_approved_at is not null and q.spend_approved_at::date >= w.since), 0)
  from w
$$;
revoke all on function public.wallet_balance() from public, anon;
grant execute on function public.wallet_balance() to authenticated;

create or replace function public.guard_payment_balance()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare bal numeric;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    bal := coalesce(public.wallet_balance(), 0);
    if bal <= 0 or new.amount > bal then
      raise exception 'insufficient_funds:%', bal using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_payment_balance before update of status on public.money_requests
  for each row execute function public.guard_payment_balance();

-- ---------------------------------------------------------------------
-- Shop: a second photo per item
-- ---------------------------------------------------------------------
alter table public.sale_items add column image2_path text;
grant select (image2_path) on public.sale_items to anon;
