import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SONG_CATEGORY_LABEL } from '@/lib/constants';
import { fetchSongs } from '@/lib/songs-data';
import { SongForm } from '@/components/song-form';
import { SongList } from '@/components/song-list';
import { CategoryTabs } from '@/components/category-tabs';

export default async function MezmurSongs({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'mezmur') notFound();
  const { cat } = await searchParams;
  const category = cat && cat in SONG_CATEGORY_LABEL ? cat : undefined;
  const supabase = await createClient();
  const songs = await fetchSongs(supabase, category);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>መዝሙራት</h2>
      <details className="no-print">
        <summary className="btn sm" style={{ display: 'inline-flex' }}>+ መዝሙር ጨምር</summary>
        <div style={{ marginTop: 10 }}><SongForm kind="song" defaultCategory={category} /></div>
      </details>
      <CategoryTabs base="/staff/mezmur/songs" active={category} />
      <p className="muted small">{songs.length} መዝሙራት</p>
      <SongList items={songs} kind="song" editable showCategory={!category} />
    </>
  );
}
