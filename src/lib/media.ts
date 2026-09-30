import type { SupabaseClient } from '@supabase/supabase-js';

export const mediaUrl = (supabase: SupabaseClient, path: string | null | undefined) =>
  path ? supabase.storage.from('media').getPublicUrl(path).data.publicUrl : null;
