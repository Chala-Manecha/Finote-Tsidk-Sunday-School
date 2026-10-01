-- =====================================================================
-- የውስጥ ግንኙነት takes over public-site content from ጽሕፈት ቤት:
-- home page (welcome, announcement, sections, moving photos), social
-- links, ታሪካችን, ማኅበራት, የጸሎት መርኀ ግብራት, ክፍሎቻችን (PDFs).
-- ጽሕፈት ቤት keeps ክፍል ኃላፊዎች (assignees).
-- =====================================================================

drop policy history_write on public.history_items;
create policy history_write on public.history_items for all to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

drop policy event_photos_write on public.event_photos;
create policy event_photos_write on public.event_photos for all to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

drop policy mahiberat_write on public.mahiberat;
create policy mahiberat_write on public.mahiberat for all to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

drop policy prayer_write on public.prayer_schedule;
create policy prayer_write on public.prayer_schedule for all to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

drop policy dept_docs_write on public.dept_documents;
create policy dept_docs_write on public.dept_documents for all to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

-- media bucket folders
drop policy "media write" on storage.objects;
drop policy "media delete" on storage.objects;
create policy "media write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb' and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] = 'assignees' and public.has_dept('office'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'docs') and public.has_dept('internal_comm'))
    ));
create policy "media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb' and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] = 'assignees' and public.has_dept('office'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'docs') and public.has_dept('internal_comm'))
    ));

-- ---------------------------------------------------------------------
-- Home page settings (one row)
--   sections: ordered list of {key, visible}; keys: welcome, photos, events, social
-- ---------------------------------------------------------------------
create table public.site_settings (
  id                   boolean primary key default true check (id),
  welcome_title        text,
  welcome_text         text,
  announcement         text,
  announcement_active  boolean not null default false,
  marquee_seconds      int not null default 40 check (marquee_seconds between 10 and 180),
  sections             jsonb not null default
    '[{"key":"welcome","visible":true},{"key":"photos","visible":true},{"key":"events","visible":true},{"key":"social","visible":true}]',
  updated_at           timestamptz not null default now()
);
insert into public.site_settings (id) values (true);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
create policy site_settings_read on public.site_settings for select using (true);
create policy site_settings_write on public.site_settings for update to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

create table public.social_links (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null check (platform in ('telegram', 'facebook', 'youtube', 'tiktok', 'instagram', 'x', 'website')),
  url         text not null check (url ~ '^https://'),
  label       text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.social_links enable row level security;
grant select on public.social_links to anon, authenticated;
grant insert, update, delete on public.social_links to authenticated;
create policy social_links_read on public.social_links for select using (true);
create policy social_links_write on public.social_links for all to authenticated
  using (public.has_dept('internal_comm')) with check (public.has_dept('internal_comm'));

grant all on public.site_settings, public.social_links to service_role;
