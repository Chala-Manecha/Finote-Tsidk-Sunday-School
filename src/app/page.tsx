import Link from 'next/link';
import { SCHOOL_NAME } from '@/lib/constants';
import { PublicHeader } from '@/components/public-header';
import { SocialButtons } from '@/components/social-buttons';
import { createClient } from '@/lib/supabase/server';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { normaliseSections, type SocialLink } from '@/lib/site';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Public home — content and section order are set by የውስጥ ግንኙነት. */
export default async function Home() {
  const today = todayIsoAddis();
  const supabase = await createClient();
  const [{ data: s }, { data: photos }, { data: week }, { data: social }] = await Promise.all([
    supabase.from('site_settings').select('welcome_title, welcome_text, announcement, announcement_active, marquee_seconds, sections').maybeSingle(),
    supabase.from('event_photos').select('id, caption, image_path').order('created_at', { ascending: false }).limit(20),
    supabase.from('events').select('id, title, event_date, event_time').eq('status', 'approved')
      .gte('event_date', today).lte('event_date', addDays(today, 7)).order('event_date').order('event_time'),
    supabase.from('social_links').select('id, platform, url, label, sort').order('sort').order('created_at'),
  ]);
  const sections = normaliseSections(s?.sections).filter((x) => x.visible);
  const links = (social ?? []) as SocialLink[];

  const blocks = {
    welcome: (
      <div className="card" style={{ marginTop: 24 }}>
        <h1 className="title">{s?.welcome_title || `እንኳን ወደ ${SCHOOL_NAME} በሰላም መጡ።`}</h1>
        <p style={{ whiteSpace: 'pre-line' }}>{s?.welcome_text || 'ለመመዝገብ ወደ ቢሮ ቁጥር 9 በአካል ይሂዱ።'}</p>
      </div>
    ),
    photos: photos && photos.length > 0 ? (
      <>
        <h2 className="section">የክፍል ዝግጅቶች</h2>
        <div className="marquee">
          <div className="track" style={{ animationDuration: `${s?.marquee_seconds ?? 40}s` }}>
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
    ) : null,
    events: (
      <>
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
        ) : <p className="muted">በሚቀጥሉት 7 ቀናት የተያዘ መርሓ ግብር የለም።</p>}
      </>
    ),
    social: links.length > 0 ? (
      <>
        <h2 className="section">ይከተሉን</h2>
        <SocialButtons links={links} />
      </>
    ) : null,
  };

  return (
    <>
      <PublicHeader />
      {s?.announcement_active && s.announcement && (
        <div className="announce-bar" role="status">📢 {s.announcement}</div>
      )}
      <main className="page">
        {sections.map((x) => <section key={x.key}>{blocks[x.key]}</section>)}
      </main>
    </>
  );
}
