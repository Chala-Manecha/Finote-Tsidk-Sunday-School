import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SongItem } from '@/components/song-list';

const withUrl = (supabase: SupabaseClient) => (r: Omit<SongItem, 'audio_url'>): SongItem => ({
  ...r,
  audio_url: r.audio_path ? supabase.storage.from('media').getPublicUrl(r.audio_path).data.publicUrl : null,
});

export async function fetchSongs(supabase: SupabaseClient, category?: string): Promise<SongItem[]> {
  let q = supabase.from('songs').select('id, title, body, category, audio_path').order('title');
  if (category) q = q.eq('category', category);
  const { data } = await q;
  return (data ?? []).map(withUrl(supabase));
}

export async function fetchWereb(supabase: SupabaseClient): Promise<SongItem[]> {
  const { data } = await supabase.from('wereb_items').select('id, title, body, audio_path, created_at').order('title');
  return (data ?? []).map(withUrl(supabase));
}

export async function fetchMahlet(supabase: SupabaseClient): Promise<SongItem[]> {
  const [{ data }, { data: au }] = await Promise.all([
    supabase.from('mahlet_items').select('id, title, body, audio_path, created_at').order('title'),
    supabase.from('mahlet_audios').select('id, mahlet_id, title, audio_path').order('created_at'),
  ]);
  const audios = (au ?? []) as { id: string; mahlet_id: string; title: string; audio_path: string }[];
  return (data ?? []).map(withUrl(supabase)).map((m) => ({
    ...m,
    audios: audios.filter((a) => a.mahlet_id === m.id)
      .map((a) => ({ id: a.id, title: a.title, url: supabase.storage.from('media').getPublicUrl(a.audio_path).data.publicUrl })),
  }));
}
