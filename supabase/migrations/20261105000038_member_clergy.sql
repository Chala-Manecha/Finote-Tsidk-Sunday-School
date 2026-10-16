-- =====================================================================
-- Round 21: ክህነት is filled in on the registration form (male members);
-- the ካህናት list is kept from there — one row per member.
-- =====================================================================

-- keep one row per member (the newest), then make it unique
delete from public.clergy c
using public.clergy n
where c.member_id is not null and c.member_id = n.member_id and c.created_at < n.created_at;
create unique index if not exists clergy_member_uidx on public.clergy (member_id) where member_id is not null;

-- HR / ጽሕፈት ቤት save it together with the member (null = no ክህነት)
create or replace function public.set_member_clergy(p_member uuid, p_clergy jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_name text;
begin
  if not public.has_any_dept(array['hr', 'office']) then raise exception 'permission denied'; end if;
  if p_clergy is null or jsonb_typeof(p_clergy) <> 'object' then
    delete from public.clergy where member_id = p_member;
    return;
  end if;
  select full_name into v_name from public.members where id = p_member;
  if v_name is null then raise exception 'member not found'; end if;
  insert into public.clergy (member_id, full_name, rank, ordained_on, bishop, place, service_status, file_path, file_name)
  values (p_member, v_name,
          coalesce(nullif(p_clergy ->> 'rank', ''), 'deacon'),
          nullif(p_clergy ->> 'ordained_on', '')::date,
          left(nullif(p_clergy ->> 'bishop', ''), 120),
          left(nullif(p_clergy ->> 'place', ''), 160),
          coalesce(nullif(p_clergy ->> 'service_status', ''), 'serving'),
          nullif(p_clergy ->> 'evidence_path', ''), null)
  on conflict (member_id) where member_id is not null do update set
    full_name = excluded.full_name, rank = excluded.rank, ordained_on = excluded.ordained_on,
    bishop = excluded.bishop, place = excluded.place, service_status = excluded.service_status,
    file_path = excluded.file_path;
end $$;
revoke all on function public.set_member_clergy(uuid, jsonb) from public, anon;
grant execute on function public.set_member_clergy(uuid, jsonb) to authenticated;
