import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { mediaUrl } from '@/lib/media';
import { AbnetTable, type Abnet, ABNET_COLS } from '@/components/education-views';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'አብነት' };

export default async function AbnetPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('abnet_sessions').select(ABNET_COLS).order('created_at');
  const rows = ((data ?? []) as Abnet[]).map((a) => ({ ...a, audio_url: mediaUrl(supabase, a.audio_path), file_url: mediaUrl(supabase, a.file_path) }));
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">አብነት</h1>
        <AbnetTable rows={rows} />
        <PublicFooter />
      </main>
    </>
  );
}
