import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchWereb } from '@/lib/songs-data';
import { SongList } from '@/components/song-list';

export default async function MezmurWereb({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'mezmur') notFound();
  const supabase = await createClient();
  const items = await fetchWereb(supabase);
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ወረብ</h2>
      <p className="muted small">የወረብ ይዘት በትምህርት ክፍል ይዘጋጃል፤ እዚህ ለማየት ብቻ ነው።</p>
      <SongList items={items} kind="wereb" />
    </>
  );
}
