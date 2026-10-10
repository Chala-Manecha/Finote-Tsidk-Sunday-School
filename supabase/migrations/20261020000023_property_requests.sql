-- Property: registration date + source on every item; departments ask ሒሳብና ንብረት to approve what they bought.

alter table public.dept_property
  add column registered_on date not null default ((now() at time zone 'Africa/Addis_Ababa')::date),
  add column source        text not null default 'ካለፈው የተረከበ';
update public.dept_property set registered_on = (created_at at time zone 'Africa/Addis_Ababa')::date where id is not null;

create type public.property_request_status as enum ('pending', 'approved', 'rejected');

create table public.property_requests (
  id            uuid primary key default gen_random_uuid(),
  dept          text not null references public.departments (code),
  name          text not null check (length(trim(name)) > 0),
  qty           int  not null check (qty > 0),
  price         numeric(12,2) check (price >= 0),
  condition     public.item_condition not null default 'new',
  source        text not null default 'አዲስ በክፍሉ የገዛ',
  note          text,
  registered_on date not null default ((now() at time zone 'Africa/Addis_Ababa')::date),
  status        public.property_request_status not null default 'pending',
  reason        text,
  property_id   uuid references public.dept_property (id) on delete set null,
  requested_by  uuid default auth.uid() references auth.users (id) on delete set null,
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index property_requests_dept_idx on public.property_requests (dept, status);

alter table public.property_requests enable row level security;
grant select, insert, delete on public.property_requests to authenticated;
create policy property_requests_read on public.property_requests for select to authenticated
  using (public.has_dept(dept) or public.has_any_dept(array['finance', 'office', 'audit']));
create policy property_requests_insert on public.property_requests for insert to authenticated
  with check (public.has_dept(dept) and status = 'pending' and property_id is null and decided_at is null);
create policy property_requests_withdraw on public.property_requests for delete to authenticated
  using (public.has_dept(dept) and status = 'pending');

/** ሒሳብና ንብረት approves: the item joins the department's property and counts for audit (ንብረት በመጨመር). */
create or replace function public.approve_property_request(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.property_requests; v_prop uuid;
begin
  if not public.has_dept('finance') then raise exception 'only finance'; end if;
  select * into r from public.property_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'not pending'; end if;
  insert into public.dept_property (name, qty, price, condition, owner_dept, note, registered_on, source, created_by)
    values (r.name, r.qty, r.price, r.condition, r.dept, r.note, r.registered_on, r.source, auth.uid())
    returning id into v_prop;
  insert into public.property_log (dept, kind, item_name, qty, value, log_date, note)
    values (r.dept, 'added', r.name, r.qty, r.qty * coalesce(r.price, 0), r.registered_on, r.source);
  update public.property_requests
     set status = 'approved', property_id = v_prop, decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  return v_prop;
end $$;

create or replace function public.reject_property_request(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_dept('finance') then raise exception 'only finance'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'reason required'; end if;
  update public.property_requests
     set status = 'rejected', reason = trim(p_reason), decided_by = auth.uid(), decided_at = now()
   where id = p_id and status = 'pending';
  if not found then raise exception 'not pending'; end if;
end $$;

revoke all on function public.approve_property_request(uuid) from public, anon;
revoke all on function public.reject_property_request(uuid, text) from public, anon;
grant execute on function public.approve_property_request(uuid) to authenticated;
grant execute on function public.reject_property_request(uuid, text) to authenticated;
