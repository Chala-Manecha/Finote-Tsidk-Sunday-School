-- =====================================================================
-- Home page greetings: today's birthdays (text by የውስጥ ግንኙነት) and
-- today's feast / monthly commemoration (text by አብነት).
-- አብነት gets one coordinator, chosen by ትምህርት ክፍል.
-- =====================================================================

-- ---------- Ethiopian date of a Gregorian date: {year, month, day} ----------
create or replace function public.ec_parts(d date)
returns int[] language sql immutable set search_path = ''
as $$
  with j as (select to_char(d, 'J')::int - 1723856 as x),
       r as (select x, ((x % 1461) + 1461) % 1461 as r from j)
  select array[
    4 * floor(x / 1461.0)::int + r / 365 - r / 1460,
    ((r % 365) + 365 * (r / 1460)) / 30 + 1,
    ((r % 365) + 365 * (r / 1460)) % 30 + 1
  ] from r
$$;

-- ---------- the አብነት coordinator (one member) ----------
create table public.abnet_coordinator (
  id         boolean primary key default true check (id),
  member_id  uuid not null references public.members (id) on delete cascade,
  set_by     uuid default auth.uid() references auth.users (id) on delete set null,
  set_at     timestamptz not null default now()
);
alter table public.abnet_coordinator enable row level security;
grant select, insert, update, delete on public.abnet_coordinator to authenticated;
create policy abnet_coordinator_read on public.abnet_coordinator for select to authenticated using (true);
create policy abnet_coordinator_write on public.abnet_coordinator for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

create or replace function public.is_abnet_coordinator()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.abnet_coordinator c
                 where c.member_id is not null and c.member_id = public.current_member_id());
$$;
grant execute on function public.is_abnet_coordinator() to authenticated;

create or replace function public.is_abnet()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_dept('education') or public.is_abnet_coordinator() $$;
grant execute on function public.is_abnet() to authenticated;

-- ---------- አብነት tables: ትምህርት ክፍል or the coordinator ----------
drop policy abnet_write on public.abnet_sessions;
create policy abnet_write on public.abnet_sessions for all to authenticated
  using (public.is_abnet()) with check (public.is_abnet());
drop policy abnet_materials_write on public.abnet_materials;
create policy abnet_materials_write on public.abnet_materials for all to authenticated
  using (public.is_abnet()) with check (public.is_abnet());
drop policy mahlet_write on public.mahlet_items;
create policy mahlet_write on public.mahlet_items for all to authenticated
  using (public.is_abnet()) with check (public.is_abnet());
drop policy mahlet_audios_write on public.mahlet_audios;
create policy mahlet_audios_write on public.mahlet_audios for all to authenticated
  using (public.is_abnet()) with check (public.is_abnet());

drop policy "media write" on storage.objects;
drop policy "media delete" on storage.objects;
create policy "media write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb' and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'abnet' and public.is_abnet())
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] = 'assignees' and public.has_dept('office'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'docs') and public.has_dept('internal_comm'))
    ));
create policy "media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb' and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'abnet' and public.is_abnet())
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] = 'assignees' and public.has_dept('office'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'docs') and public.has_dept('internal_comm'))
    ));

-- ---------- birthday texts (የውስጥ ግንኙነት) ----------
alter table public.site_settings
  add column if not exists bday_active boolean not null default true,
  add column if not exists bday_male_text text check (bday_male_text is null or length(bday_male_text) <= 500),
  add column if not exists bday_female_text text check (bday_female_text is null or length(bday_female_text) <= 500);

-- Today's birthdays (active members, by the Ethiopian date): first two names and sex only.
create or replace function public.todays_birthdays()
returns table (name text, sex public.sex)
language sql stable security definer set search_path = ''
as $$
  with t as (select public.ec_parts((now() at time zone 'Africa/Addis_Ababa')::date) as e)
  select btrim(split_part(n.v, ' ', 1) || ' ' || split_part(n.v, ' ', 2)), m.sex
  from public.members m
  cross join t
  cross join lateral (select regexp_replace(btrim(m.full_name), '\s+', ' ', 'g') as v) n
  where m.is_active and m.dob is not null
    and ( (public.ec_parts(m.dob))[2:3] = t.e[2:3]
       -- born on ጳጉሜ 6: remembered on ጳጉሜ 5 when the year has only five
       or ((public.ec_parts(m.dob))[2:3] = array[13, 6] and t.e[2:3] = array[13, 5] and t.e[1] % 4 <> 3) )
  order by m.full_name
$$;
grant execute on function public.todays_birthdays() to anon, authenticated;

-- ---------- feast / commemoration greetings (አብነት) ----------
create table public.abnet_settings (
  id            boolean primary key default true check (id),
  holiday_text  text check (holiday_text is null or length(holiday_text) <= 500),
  updated_at    timestamptz not null default now()
);
insert into public.abnet_settings (id) values (true);
alter table public.abnet_settings enable row level security;
grant select on public.abnet_settings to anon, authenticated;
grant update on public.abnet_settings to authenticated;
create policy abnet_settings_read on public.abnet_settings for select using (true);
create policy abnet_settings_write on public.abnet_settings for update to authenticated
  using (public.is_abnet()) with check (public.is_abnet());

-- kind: 'feast'   = one of the ባሕረ ሃሳብ feasts (feast_key) — its own text, or switched off
--       'yearly'  = every year on ec_month / ec_day (ገና, ጥምቀት, መስቀል …)
--       'monthly' = every month on ec_day (6 ቅድስት አርሴማ, 13 ቅዱስ ሩፋኤል …)
create table public.day_greetings (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('feast', 'yearly', 'monthly')),
  feast_key  text,
  ec_month   int check (ec_month between 1 and 13),
  ec_day     int check (ec_day between 1 and 30),
  name       text check (name is null or length(btrim(name)) between 1 and 120),
  message    text check (message is null or length(message) <= 500),
  active     boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ( (kind = 'feast' and feast_key is not null)
       or (kind = 'yearly' and ec_month is not null and ec_day is not null and name is not null)
       or (kind = 'monthly' and ec_day is not null and (name is not null or message is not null)) )
);
create unique index day_greetings_feast on public.day_greetings (feast_key) where kind = 'feast';
alter table public.day_greetings enable row level security;
grant select on public.day_greetings to anon, authenticated;
grant insert, update, delete on public.day_greetings to authenticated;
create policy day_greetings_read on public.day_greetings for select using (true);
create policy day_greetings_write on public.day_greetings for all to authenticated
  using (public.is_abnet()) with check (public.is_abnet());
