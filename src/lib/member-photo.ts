import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** The signed-in member's own photo: members can't read the photo bucket, so the server signs their own path. */
export async function ownPhoto(path: string | null) {
  if (!path) return null;
  try {
    const { data } = await createAdminClient().storage.from('member-docs').createSignedUrl(path, 900);
    return data?.signedUrl ?? null;
  } catch { return null; }
}
