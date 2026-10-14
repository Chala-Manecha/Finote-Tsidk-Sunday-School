-- የሰው ሃብት's attendance overview also shows teachers' absences recorded by ትምህርት ክፍል.
drop policy teacher_attendance_read on public.teacher_attendance;
create policy teacher_attendance_read on public.teacher_attendance for select to authenticated
  using (public.has_any_dept(array['education', 'audit', 'hr']) or member_id = public.current_member_id());
