import { SCHOOL_NAME } from '@/lib/constants';
import { PublicHeader, PublicFooter } from '@/components/public-header';
import { createClient } from '@/lib/supabase/server';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import Link from 'next/link';
import { mediaUrl } from '@/lib/media';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Public home. More public pages (ኮርስ, ዜማ, ታሪካችን …) come in a later phase.
export default async function Home() {
  const today = todayIsoAddis();
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from('event_photos').select('id, caption, image_path').order('created_at', { ascending: false }).limit(20);
  const { data: week } = await supabase
    .from('events')
    .select('id, title, event_date, event_time')
    .eq('status', 'approved')
    .gte('event_date', today)
    .lte('event_date', addDays(today, 7))
    .order('event_date')
    .order('event_time');

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="card" style={{ marginTop: 30 }}>
          <h1 className="title">እንኳን ወደ {SCHOOL_NAME} በሰላም መጡ።</h1>
          <p>ለመመዝገብ ወደ ቢሮ ቁጥር 9 በአካል ይሂዱ።</p>
        </div>

        {photos && photos.length > 0 && (
          <>
            <h2 className="section">የክፍል ዝግጅቶች</h2>
            <div className="marquee">
              <div className="track">
                {[...photos, ...photos].map((p, i) => (
                  <Link key={`${p.id}-${i}`} href="/history" aria-hidden={i >= photos.length} tabIndex={i >= photos.length ? -1 : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(supabase, p.image_path)!} alt={p.caption ?? ''} loading="lazy" />
                    {p.caption && <span>{p.caption}</span>}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <h2 className="section">የሳምንቱ መርሓ ግብራት</h2>
        {week && week.length > 0 ? (
          <div className="table-wrap">
            <table>
              <tbody>
                {week.map((e) => (
                  <tr key={e.id}>
                    <td>{formatEc(e.event_date, { weekday: true })}</td>
                    <td dir="ltr">{e.event_time.slice(0, 5)}</td>
                    <td>{e.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">በሚቀጥሉት 7 ቀናት የተያዘ መርሓ ግብር የለም።</p>
        )}

        <PublicFooter />
      </main>
    </>
  );
}
