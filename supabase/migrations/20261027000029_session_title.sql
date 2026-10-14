-- A title for an attendance session (e.g. the meeting's subject).
alter table public.attendance_sessions add column title text check (title is null or length(title) <= 160);
