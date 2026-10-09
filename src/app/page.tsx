import Link from 'next/link';
import { CHURCH_NAME, DEPARTMENTS, SCHOOL_NAME, SCHOOL_NAME_EN } from '@/lib/constants';
import { PublicHeader } from '@/components/public-header';
import { SocialButtons } from '@/components/social-buttons';
import { ScrollReveal } from '@/components/scroll-reveal';
import { anniversaryYear } from '@/components/brand';
import { createClient } from '@/lib/supabase/server';
import { EC_MONTHS, WEEKDAYS_AM, formatEc, isoToEc, todayIsoAddis, weekdayOf } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { SITE_DEFAULTS, SITE_TEXT_COLUMNS, normaliseSections, type SiteSettings, type SocialLink } from '@/lib/site';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const SERVICES = [
  { href: '/course', icon: '📖', title: 'ኮርስ', text: 'ለሕፃናት፣ ለወጣቶች እና ለጎልማሶች በደረጃ የሚሰጡ ተከታታይ መንፈሳዊ ትምህርቶች።' },
  { href: '/abnet', icon: '✍️', title: 'አብነት', text: 'የግእዝ ንባብ፣ ቅኔ እና የአብነት ትምህርቶች ገፅ ለገፅ።' },
  { href: '/zema', icon: '🎵', title: 'ዜማ እና በገና', text: 'ያሬዳዊ ዝማሬ ስልቶች፣ ወረብ እና የበገና ትምህርት።' },
];

/** Public home — one long page like eotcssu.et; texts and section order are set by የውስጥ ግንኙነት. */
export default async function Home() {
  const today = todayIsoAddis();
  const supabase = await createClient();
  const [{ data }, { data: photos }, { data: week }, { data: social }, { data: upcoming }] = await Promise.all([
    supabase.from('site_settings').select(SITE_TEXT_COLUMNS).maybeSingle(),
    supabase.from('event_photos').select('id, caption, image_path').order('created_at', { ascending: false }).limit(20),
    supabase.from('events').select('id, title, event_date, event_time').eq('status', 'approved')
      .gte('event_date', today).lte('event_date', addDays(today, 7)).order('event_date').order('event_time'),
    supabase.from('social_links').select('id, platform, url, label, sort').order('sort').order('created_at'),
    supabase.from('events').select('id, title, event_date, event_time').eq('status', 'approved')
      .gt('event_date', addDays(today, 7)).order('event_date').order('event_time').limit(1),
  ]);
  const tomorrow = addDays(today, 1);
  const shortDay = (d: string) => { const e = isoToEc(d); return `${WEEKDAYS_AM[weekdayOf(d)]}፣ ${EC_MONTHS[e.month - 1]} ${e.day}`; };
  const dayTag = (d: string) => (d === today ? 'ዛሬ' : d === tomorrow ? 'ነገ' : null);
  const weekList = week ?? [];
  const later = (upcoming ?? [])[0];
  const s = data as SiteSettings | null;
  const sections = normaliseSections(s?.sections).filter((x) => x.visible);
  const links = (social ?? []) as SocialLink[];
  const hero = mediaUrl(supabase, s?.hero_path);
  const years = anniversaryYear();
  const phone = s?.contact_phone || SITE_DEFAULTS.contact_phone;
  const email = s?.contact_email || SITE_DEFAULTS.contact_email;
  const address = s?.contact_address || SITE_DEFAULTS.contact_address;
  const lat = Number(s?.map_lat ?? SITE_DEFAULTS.map_lat);
  const lng = Number(s?.map_lng ?? SITE_DEFAULTS.map_lng);
  const values = (s?.core_values ?? '').split('\n').map((v) => v.trim()).filter(Boolean);

  const head = (eyebrow: string, title: string, sub?: string) => (
    <div className="sec-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {sub && <p className="muted">{sub}</p>}
    </div>
  );

  const blocks: Record<string, React.ReactNode> = {
    mission: (s?.mission || s?.vision || values.length > 0) ? (
      <>
        {head('ማንነታችን', 'ተልዕኮ፣ ራዕይ እና እሴቶች')}
        <div className="mvv">
          {s?.mission && <div className="mvv-card"><span className="mvv-icon">🎯</span><h3>ተልዕኮ</h3><p>{s.mission}</p></div>}
          {s?.vision && <div className="mvv-card"><span className="mvv-icon">👁️</span><h3>ራዕይ</h3><p style={{ whiteSpace: 'pre-line' }}>{s.vision}</p></div>}
          {values.length > 0 && (
            <div className="mvv-card"><span className="mvv-icon">❤️</span><h3>እሴቶች</h3>
              <div className="value-chips">{values.map((v) => <span key={v}>{v}</span>)}</div>
            </div>
          )}
        </div>
      </>
    ) : null,
    about: (
      <div className="about" id="about">
        <div>
          <span className="eyebrow">ስለ እኛ</span>
          <h2>{s?.about_title || SCHOOL_NAME}</h2>
          {s?.about_text && <p>{s.about_text}</p>}
          <div className="btn-row">
            <Link href="/history" className="btn">ሙሉ ታሪካችንን ያንብቡ →</Link>
            <Link href="/departments" className="btn secondary">ክፍሎቻችን</Link>
          </div>
        </div>
        <div className="about-side">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={SCHOOL_NAME} width={200} height={200} />
          <div className="about-stats">
            <div><b>{years}ኛ</b><span>የምሥረታ ዓመት</span></div>
            <div><b>2000</b><span>ዓ.ም ተመሠረተ</span></div>
            <div><b>{DEPARTMENTS.length}</b><span>ክፍሎች</span></div>
          </div>
        </div>
      </div>
    ),
    departments: (
      <div id="departments">
        {head('አገልግሎቶች', 'ክፍሎቻችን እና አገልግሎቶቻችን')}
        <div className="service-cards">
          {SERVICES.map((x) => (
            <Link key={x.href} href={x.href} className="service-card">
              <span className="mvv-icon">{x.icon}</span>
              <h3>{x.title}</h3>
              <p className="muted">{x.text}</p>
              <span className="more">ተጨማሪ →</span>
            </Link>
          ))}
        </div>
        <div className="dept-chips">
          {DEPARTMENTS.map((d) => <Link key={d.code} href="/departments">{d.name}</Link>)}
        </div>
      </div>
    ),
    welcome: (
      <div className="welcome-card">
        <h2>{s?.welcome_title || `እንኳን ወደ ${SCHOOL_NAME} በሰላም መጡ።`}</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{s?.welcome_text || 'ለመመዝገብ ወደ ቢሮ ቁጥር 7 በአካል ይሂዱ።'}</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <Link href="/login" className="btn">የአባል መግቢያ</Link>
          <Link href="/feedback" className="btn secondary">አስተያየት ይስጡ</Link>
        </div>
      </div>
    ),
    donate: (
      <div className="cta-band">
        <div>
          <h2>አገልግሎታችንን ይደግፉ</h2>
          <p>በTelebirr ወይም በCBE የሚያደርጉት እርዳታ ለትምህርት፣ ለዝማሬ እና ለበጎ አድራጎት አገልግሎቶች ይውላል።</p>
        </div>
        <Link href="/donate" className="btn light">ለመርዳት →</Link>
      </div>
    ),
    contact: (
      <div id="contact">
        {head('ያግኙን', 'አድራሻችን', 'ለማንኛውም ጥያቄ ይደውሉልን ወይም በአካል ይጎብኙን።')}
        <div className="contact-cards">
          <a className="contact-card" href={`tel:${phone.replace(/\s/g, '')}`}><span className="mvv-icon">📞</span><b>ስልክ</b><span dir="ltr">{phone}</span></a>
          <a className="contact-card" href={`mailto:${email}`}><span className="mvv-icon">✉️</span><b>ኢሜይል</b><span dir="ltr">{email}</span></a>
          <div className="contact-card"><span className="mvv-icon">📍</span><b>አድራሻ</b><span>{address}</span><span className="small muted">{CHURCH_NAME}</span></div>
        </div>
        {Number.isFinite(lat) && Number.isFinite(lng) && (
          <div className="map-card">
            <iframe
              title="ካርታ"
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a className="btn" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
              በGoogle Maps ይክፈቱ ↗
            </a>
          </div>
        )}
      </div>
    ),
    social: links.length > 0 ? (
      <div className="center">
        {head('ይከተሉን', 'ማኅበራዊ ሚዲያ')}
        <SocialButtons links={links} />
      </div>
    ) : null,
  };

  return (
    <>
      <PublicHeader />
      {s?.announcement_active && s.announcement && (
        <div className="announce-bar" role="status">📢 {s.announcement}</div>
      )}
      <section className={`hero ${hero ? 'has-photo' : ''}`} style={hero ? { backgroundImage: `url("${hero}")` } : undefined}>
        <div className="hero-grid">
          <div className="hero-inner">
            <span className="hero-chip">ሰንበት ትምህርት ቤት <i aria-hidden>•</i> {years}ኛ ምሥረታ</span>
            <h1>{SCHOOL_NAME}</h1>
            <p className="hero-en">{SCHOOL_NAME_EN}</p>
            <span className="hero-pill">⛪ {CHURCH_NAME}</span>
            {s?.hero_text && <p className="hero-text">{s.hero_text}</p>}
            <div className="hero-buttons">
              <a className="glass" href={`tel:${phone.replace(/\s/g, '')}`} dir="ltr">📞 {phone}</a>
              <a className="glass solid" href="#about">ስለ እኛ</a>
              <a className="glass" href="#departments">አገልግሎቶች</a>
            </div>
          </div>

          <aside className="week-panel" aria-labelledby="week-title">
            <div className="week-head">
              <span className="live-dot" aria-hidden />
              <h2 id="week-title">የሳምንቱ መርሓ ግብራት</h2>
            </div>
            {weekList.length > 0 ? (
              <ol className="week-list">
                {weekList.slice(0, 6).map((e, i) => {
                  const tag = dayTag(e.event_date);
                  return (
                    <li key={e.id} className={i === 0 ? 'next' : ''}>
                      <div className="week-when">
                        {tag ? <span className="day-tag">{tag}</span> : <span className="small">{shortDay(e.event_date)}</span>}
                        <span dir="ltr">{e.event_time.slice(0, 5)}</span>
                      </div>
                      <b>{e.title}</b>
                      {i === 0 && !tag && <span className="small next-label">ቀጣይ</span>}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="week-empty">
                <p>በዚህ ሳምንት የተያዘ መርሓ ግብር የለም።</p>
                {later && <p className="small">ቀጣይ፦ <b>{later.title}</b> · {formatEc(later.event_date, { weekday: true })}</p>}
              </div>
            )}
            {weekList.length > 6 && <p className="small" style={{ margin: '8px 0 0', opacity: .8 }}>+{weekList.length - 6} ሌሎች</p>}
          </aside>
        </div>
      </section>

      {photos && photos.length > 0 && (
        <section className="photo-band" aria-label="የክፍል ዝግጅቶች">
          <div className="photo-band-head"><span className="eyebrow">ምስሎች</span><h2>የክፍል ዝግጅቶች</h2><Link href="/history" className="link small">ሁሉንም ይመልከቱ →</Link></div>
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
        </section>
      )}
      <main className="home">
        {sections.map((x) => blocks[x.key] ? <section key={x.key} className={`home-sec reveal sec-${x.key}`}>{blocks[x.key]}</section> : null)}
      </main>
      <ScrollReveal />
    </>
  );
}
