import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SONG_CATEGORY_LABEL } from '@/lib/constants';
import { fetchSongs, fetchWereb } from '@/lib/songs-data';
import { SongList } from '@/components/song-list';
import { CategoryTabs } from '@/components/category-tabs';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'ዜማ' };

export default async function ZemaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string }>;
}) {
  const { tab, cat } = await searchParams;
  const isWereb = tab === 'wereb';
  const category = cat && cat in SONG_CATEGORY_LABEL ? cat : undefined;
  const supabase = await createClient();
  const items = isWereb ? await fetchWereb(supabase) : await fetchSongs(supabase, category);

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ዜማ</h1>
        <div className="subtabs">
          <Link href="/zema" className={`btn sm ${!isWereb ? 'green' : 'secondary'}`}>መዝሙራት</Link>
          <Link href="/zema?tab=wereb" className={`btn sm ${isWereb ? 'green' : 'secondary'}`}>ወረብ</Link>
        </div>
        {!isWereb && <CategoryTabs base="/zema" active={category} />}
        <SongList items={items} kind={isWereb ? 'wereb' : 'song'} showCategory={!isWereb && !category} />
        <PublicFooter />
      </main>
    </>
  );
}
