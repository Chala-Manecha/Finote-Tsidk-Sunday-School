-- =====================================================================
-- አብነት: fixed schedules get a place (ቦታ / አካባቢ); learning materials
-- (audio, video, files) and ማሕሌት texts — all shown on the public site.
-- ትምህርት ክፍል adds and edits them.
-- =====================================================================

-- ---------- schedule: the place ----------
alter table public.abnet_sessions add column if not exists place text check (place is null or length(place) <= 160);
grant select (place) on public.abnet_sessions to anon;

-- ---------- materials ----------
create table public.abnet_materials (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('audio', 'video', 'file')),
  title       text not null check (length(btrim(title)) between 2 and 160),
  description text check (description is null or length(description) <= 2000),
  file_path   text,                       -- media bucket, abnet/…
  url         text check (url is null or url ~* '^https?://'),   -- e.g. a YouTube link for a video
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (file_path is not null or url is not null)
);
alter table public.abnet_materials enable row level security;
grant select on public.abnet_materials to anon, authenticated;
grant insert, update, delete on public.abnet_materials to authenticated;
create policy abnet_materials_read on public.abnet_materials for select using (true);
create policy abnet_materials_write on public.abnet_materials for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));

-- ---------- ማሕሌት ----------
create table public.mahlet_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 200),
  body        text,
  audio_path  text,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_mahlet_items_updated before update on public.mahlet_items
  for each row execute function public.set_updated_at();
alter table public.mahlet_items enable row level security;
grant select on public.mahlet_items to anon, authenticated;
grant insert, update, delete on public.mahlet_items to authenticated;
create policy mahlet_read on public.mahlet_items for select using (true);
create policy mahlet_write on public.mahlet_items for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));
