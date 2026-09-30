-- =====================================================================
-- Supabase Storage buckets
--   member-docs : private — registration evidence files (HR / ጽሕፈት ቤት)
--   media       : public read — songs, ወረብ audio, ታሪካችን, marquee, assignee photos
-- Object path convention: <dept-or-area>/<uuid>-<filename>
-- (R2 can replace `media` later for large video; paths stay the same shape.)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('member-docs', 'member-docs', false, 10485760)      -- 10 MB
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)                    -- 50 MB
on conflict (id) do nothing;

-- member-docs: HR and ጽሕፈት ቤት only
create policy "member-docs read"   on storage.objects for select to authenticated
  using (bucket_id = 'member-docs' and public.has_any_dept(array['hr', 'office']));
create policy "member-docs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-docs' and public.has_any_dept(array['hr', 'office']));
create policy "member-docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'member-docs' and public.has_any_dept(array['hr', 'office']));

-- media: public bucket serves reads via public URL; writes by folder owner.
--   songs/*    → mezmur    wereb/*   → education
--   history/*, photos/*, assignees/* → office
create policy "media write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs'     and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb'     and public.has_dept('education'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'assignees') and public.has_dept('office'))
    ));
create policy "media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs'     and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb'     and public.has_dept('education'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'assignees') and public.has_dept('office'))
    ));
