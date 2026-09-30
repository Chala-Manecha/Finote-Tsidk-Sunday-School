-- media bucket: add folders docs/ (ጽሕፈት ቤት — department PDFs) and shop/ (ልማትና በጎ አድራጎት — item photos)
drop policy "media write" on storage.objects;
drop policy "media delete" on storage.objects;

create policy "media write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb' and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'assignees', 'docs') and public.has_dept('office'))
    ));
create policy "media delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media' and (
         ((storage.foldername(name))[1] = 'songs' and public.has_dept('mezmur'))
      or ((storage.foldername(name))[1] = 'wereb' and public.has_dept('education'))
      or ((storage.foldername(name))[1] = 'shop'  and public.has_dept('development'))
      or ((storage.foldername(name))[1] in ('history', 'photos', 'assignees', 'docs') and public.has_dept('office'))
    ));
