-- Cleanup: the old "የአመቱ ዕቅድ" / course-session tables were replaced by course_offerings (ኮርሶችና መምህራን).
drop table if exists public.edu_plan;
drop table if exists public.course_sessions;
