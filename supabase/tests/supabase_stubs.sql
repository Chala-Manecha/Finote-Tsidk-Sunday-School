-- Minimal stand-ins for Supabase roles, auth.* and storage.* — LOCAL TESTING ONLY, never run on Supabase.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true),'') $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
