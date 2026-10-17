import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import { AbnetTable, type Abnet, ABNET_COLS } from '@/components/education-views';
import { MaterialsView, MATERIAL_COLS, type Material } from '@/components/abnet-materials';
import { SongList } from '@/components/song-list';
import { BahireHasabView } from '@/components/bahire-hasab-view';
import { fetchMahlet } from '@/lib/songs-data';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'አብነት' };

const TABS = [
  ['sched', '🗓 ጥናት ክፍለ ጊዜያት'],
  ['lessons', '📚 መማሪያዎች'],
  ['mahlet', '🎼 ማሕሌት'],
  ['negs', '📜 ነግስ'],
  ['bahire', '🧮 ባሕረ ሃሳብ'],
] as const;
type Tab = (typeof TABS)[number][0];

/** Public: አብነት in tabs — study times and places, lessons (PDF, audio, YouTube), ማሕሌት, ነግስ and ባሕረ ሃሳብ. */
export default async function AbnetPage({ searchParams }: { searchParams: Promise<{ v?: string; y?: string }> }) {
  const sp = await searchParams;
  const view: Tab = TABS.some(([k]) => k === sp.v) ? (sp.v as Tab) : 'sched';
  const supabase = await createClient();

  let body: React.ReactNode;
  if (view === 'sched') {
    const { data } = await supabase.from('abnet_sessions').select(ABNET_COLS).order('created_at');
    const rows = ((data ?? []) as Abnet[]).map((a) => ({ ...a, audio_url: mediaUrl(supabase, a.audio_path), file_url: mediaUrl(supabase, a.file_path) }));
    body = <AbnetTable rows={rows} />;
  } else if (view === 'lessons' || view === 'negs') {
    const { data } = await supabase.from('abnet_materials').select(MATERIAL_COLS)
      .in('kind', view === 'negs' ? ['negs'] : ['file', 'audio', 'video']).order('created_at', { ascending: false });
    const rows = ((data ?? []) as Material[]).map((m) => ({ ...m, file_url: mediaUrl(supabase, m.file_path) }));
    body = <MaterialsView rows={rows} kinds={view === 'negs' ? ['negs'] : undefined} />;
  } else if (view === 'mahlet') {
    body = <SongList items={await fetchMahlet(supabase)} kind="mahlet" />;
  } else {
    body = <BahireHasabView year={Number(sp.y) || undefined} href={(y) => `/abnet?v=bahire&y=${y}`} />;
  }

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">አብነት</h1>
        <nav className="seg big" aria-label="የአብነት ክፍሎች">
          {TABS.map(([k, l]) => <Link key={k} className={view === k ? 'on' : ''} href={k === 'sched' ? '/abnet' : `/abnet?v=${k}`} scroll={false}>{l}</Link>)}
        </nav>
        <div style={{ marginTop: 14 }}>{body}</div>
        <PublicFooter />
      </main>
    </>
  );
}
