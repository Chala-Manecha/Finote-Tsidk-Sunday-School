-- HR can permanently delete a member who has no history yet (e.g. a mistaken
-- or duplicate registration). Members with any history are deactivated instead,
-- so attendance, results and certificates are never lost.

create or replace function public.member_history_count(p_member uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select ((select count(*) from public.attendance where member_id = p_member)
        + (select count(*) from public.class_attendance where member_id = p_member)
        + (select count(*) from public.marks where member_id = p_member)
        + (select count(*) from public.duty_assignments where member_id = p_member)
        + (select count(*) from public.member_departures where member_id = p_member)
        + (select count(*) from public.leadership_roles where member_id = p_member)
        + (select count(*) from public.offering_teachers where member_id = p_member)
        + (select count(*) from public.transcripts where member_id = p_member)
        + (select count(*) from public.year_decisions where member_id = p_member))::int
$$;
revoke all on function public.member_history_count(uuid) from public, anon;
grant execute on function public.member_history_count(uuid) to authenticated;

/** HR: delete a member with no history. Returns the login (auth user) to remove, if any. */
create or replace function public.delete_member(p_member uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user uuid;
begin
  if not public.has_dept('hr') then raise exception 'only HR deletes members'; end if;
  if public.member_history_count(p_member) > 0 then
    raise exception 'member_has_history' using errcode = 'P0001';
  end if;
  select user_id into v_user from public.member_accounts where member_id = p_member;
  delete from public.members where id = p_member;
  if not found then raise exception 'member not found'; end if;
  return v_user;
end $$;
revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
