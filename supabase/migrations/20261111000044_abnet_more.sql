-- =====================================================================
-- አብነት (public tabs): materials get a ነግስ kind and a folder to group
-- audios under; a ማሕሌት can hold several named audios.
-- =====================================================================

-- ---------- materials: ነግስ + folder ----------
alter table public.abnet_materials drop constraint if exists abnet_materials_kind_check;
alter table public.abnet_materials add constraint abnet_materials_kind_check
  check (kind in ('audio', 'video', 'file', 'negs'));
alter table public.abnet_materials add column if not exists folder text
  check (folder is null or length(btrim(folder)) between 1 and 120);
grant select (folder) on public.abnet_materials to anon;

-- ---------- ማሕሌት: several audios each ----------
create table if not exists public.mahlet_audios (
  id          uuid primary key default gen_random_uuid(),
  mahlet_id   uuid not null references public.mahlet_items (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 160),
  audio_path  text not null,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists mahlet_audios_item on public.mahlet_audios (mahlet_id);
alter table public.mahlet_audios enable row level security;
grant select on public.mahlet_audios to anon, authenticated;
grant insert, update, delete on public.mahlet_audios to authenticated;
create policy mahlet_audios_read on public.mahlet_audios for select using (true);
create policy mahlet_audios_write on public.mahlet_audios for all to authenticated
  using (public.has_dept('education')) with check (public.has_dept('education'));
