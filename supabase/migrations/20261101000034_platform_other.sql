-- Round 16: an online platform can be typed in (when it is not Google Meet / Telegram / Zoom).
do $$
declare t text;
begin
  foreach t in array array['events', 'fixed_schedules', 'abnet_sessions', 'course_offerings', 'attendance_sessions'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_platform_check');
    execute format('alter table public.%I add constraint %I check (platform is null or length(btrim(platform)) between 1 and 60)', t, t || '_platform_check');
  end loop;
end $$;
