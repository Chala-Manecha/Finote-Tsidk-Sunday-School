-- "የመግቢያ ኮድ ድጋፍ" (unlock / reset a forgotten login code) moves from ትምህርት ክፍል to የሰው ሃብት አስተዳደር.
drop policy member_accounts_read on public.member_accounts;
create policy member_accounts_read on public.member_accounts for select to authenticated
  using (user_id = (select auth.uid()) or public.has_any_dept(array['hr', 'education']));
