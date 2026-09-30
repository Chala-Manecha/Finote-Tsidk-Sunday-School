import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SONG_CATEGORIES, SONG_CATEGORY_LABEL } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'ታሪካችን' };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const category = cat && cat in SONG_CATEGORY_LABEL ? cat : undefined;
  const supabase = await createClient();
  let q = supabase.from('history_items').select('id, category, media_type, media_path, caption, item_date')
    .order('item_date', { ascending: false, nullsFirst: false });
  if (category) q = q.eq('category', category);
  const { data } = await q;

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ታሪካችን</h1>
        <div className="history-layout">
          <nav className="dept-tab-nav">
            <Link href="/history" className={!category ? 'active' : ''}>ሁሉም</Link>
            {SONG_CATEGORIES.map((c) => (
              <Link key={c.key} href={`/history?cat=${c.key}`} className={category === c.key ? 'active' : ''}>{c.label}</Link>
            ))}
          </nav>
          <div className="photo-grid" style={{ flex: 1, alignContent: 'start' }}>
            {(data ?? []).map((it) => {
              const url = mediaUrl(supabase, it.media_path)!;
              return (
                <details key={it.id} className="photo-tile history-tile">
                  <summary>
                    {it.media_type === 'video'
                      ? <video src={url} preload="metadata" muted />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={url} alt="" loading="lazy" />}
                    <span className="small">{it.caption?.split('\n')[0] ?? ''}</span>
                  </summary>
                  <div className="history-full">
                    {it.media_type === 'video'
                      ? <video src={url} controls style={{ width: '100%' }} />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={url} alt="" style={{ width: '100%' }} />}
                    <p className="small muted">{SONG_CATEGORY_LABEL[it.category]} · {formatEc(it.item_date)}</p>
                    {it.caption && <p style={{ whiteSpace: 'pre-wrap' }}>{it.caption}</p>}
                  </div>
                </details>
              );
            })}
            {data?.length === 0 && <p className="muted">በዚህ ምድብ እስካሁን ምንም የለም።</p>}
          </div>
        </div>
        <PublicFooter />
      </main>
    </>
  );
}
