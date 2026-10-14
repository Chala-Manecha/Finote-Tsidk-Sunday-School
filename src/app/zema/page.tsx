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
  searchParams: Promise<{ tab?: string; cat?: string; q?: string }>;
}) {
  const { tab, cat, q } = await searchParams;
  const isWereb = tab === 'wereb';
  const category = cat && cat in SONG_CATEGORY_LABEL ? cat : undefined;
  const supabase = await createClient();
  const all = isWereb ? await fetchWereb(supabase) : await fetchSongs(supabase, category);
  const term = (q ?? '').trim();
  const items = term ? all.filter((x) => x.title.includes(term)) : all;

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ዜማ</h1>
        <div className="subtabs">
          <Link scroll={false} href="/zema" className={`btn sm ${!isWereb ? 'green' : 'secondary'}`}>መዝሙራት</Link>
          <Link scroll={false} href="/zema?tab=wereb" className={`btn sm ${isWereb ? 'green' : 'secondary'}`}>ወረብ</Link>
        </div>
        {!isWereb && <CategoryTabs base="/zema" active={category} />}
        <form className="song-search" action="/zema">
          {isWereb && <input type="hidden" name="tab" value="wereb" />}
          {category && <input type="hidden" name="cat" value={category} />}
          <input type="search" name="q" defaultValue={term} placeholder={`🔍 በ${isWereb ? 'ወረቡ' : 'መዝሙሩ'} ስም ይፈልጉ…`} aria-label="ፈልግ" />
          <button className="btn sm">ፈልግ</button>
          {term && <Link className="link small" href={`/zema${isWereb ? '?tab=wereb' : category ? `?cat=${category}` : ''}`}>አጽዳ</Link>}
        </form>
        {term && <p className="small muted">“{term}” — {items.length} ተገኝቷል</p>}
        <SongList items={items} kind={isWereb ? 'wereb' : 'song'} showCategory={!isWereb && !category} />
        <PublicFooter />
      </main>
    </>
  );
}
