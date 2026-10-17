import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import { AbnetTable, type Abnet, ABNET_COLS } from '@/components/education-views';
import { MaterialsView, MATERIAL_COLS, type Material } from '@/components/abnet-materials';
import { SongList } from '@/components/song-list';
import { fetchMahlet } from '@/lib/songs-data';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'አብነት' };

/** Public: the አብነት schedule, learning materials (audio, video, files) and ማሕሌት. */
export default async function AbnetPage() {
  const supabase = await createClient();
  const [{ data }, { data: mats }, mahlet] = await Promise.all([
    supabase.from('abnet_sessions').select(ABNET_COLS).order('created_at'),
    supabase.from('abnet_materials').select(MATERIAL_COLS).order('created_at', { ascending: false }),
    fetchMahlet(supabase),
  ]);
  const rows = ((data ?? []) as Abnet[]).map((a) => ({ ...a, audio_url: mediaUrl(supabase, a.audio_path), file_url: mediaUrl(supabase, a.file_path) }));
  const materials = ((mats ?? []) as Material[]).map((m) => ({ ...m, file_url: mediaUrl(supabase, m.file_path) }));
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">አብነት</h1>
        <nav className="jump-links">
          <a href="#schedule">🗓 መርሐ ግብር</a>
          {materials.length > 0 && <a href="#materials">📚 መማሪያዎች</a>}
          {mahlet.length > 0 && <a href="#mahlet">🎼 ማሕሌት</a>}
        </nav>
        <h2 className="section" id="schedule">🗓 መርሐ ግብር</h2>
        <AbnetTable rows={rows} />
        {materials.length > 0 && (
          <>
            <h2 className="section" id="materials">📚 መማሪያዎች</h2>
            <MaterialsView rows={materials} />
          </>
        )}
        {mahlet.length > 0 && (
          <>
            <h2 className="section" id="mahlet">🎼 ማሕሌት</h2>
            <SongList items={mahlet} kind="mahlet" />
          </>
        )}
        <PublicFooter />
      </main>
    </>
  );
}
