import Link from 'next/link';
import { fmtTime } from '@/lib/ethiopian-calendar';
import { CHURCH_NAME, DEPARTMENTS, DUTIES, EVENT_KINDS, SCHOOL_NAME, SCHOOL_NAME_EN } from '@/lib/constants';
import { platformName } from '@/lib/delivery';
import { PublicHeader } from '@/components/public-header';
import { SocialButtons } from '@/components/social-buttons';
import { ScrollReveal } from '@/components/scroll-reveal';
import { HolidaysPanel } from '@/components/bahire-hasab-view';
import { TodayGreeting } from '@/components/today-greeting';
import { todaysGreetings } from '@/lib/greetings';
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
  const [{ data }, { data: photos }, { data: week }, { data: social }, { data: upcoming }, { data: regOpen }] = await Promise.all([
    supabase.from('site_settings').select(SITE_TEXT_COLUMNS).maybeSingle(),
    supabase.from('event_photos').select('id, caption, image_path').order('created_at', { ascending: false }).limit(20),
    supabase.from('events').select('id, title, event_date, event_time, kind, place, mode, platform').eq('status', 'approved')
      .gte('event_date', today).lte('event_date', addDays(today, 7)).order('event_date').order('event_time'),
    supabase.from('social_links').select('id, platform, url, label, sort').order('sort').order('created_at'),
    supabase.from('events').select('id, title, event_date, event_time').eq('status', 'approved')
      .gt('event_date', addDays(today, 7)).order('event_date').order('event_time').limit(1),
    supabase.rpc('registration_is_open'),
  ]);
  const greetings = await todaysGreetings(supabase, today).catch(() => []);
  // Online links: only for a signed-in member or staff (the public role cannot read them).
  const { data: claims } = await supabase.auth.getClaims();
  const onlineIds = (week ?? []).filter((e) => e.mode === 'online').map((e) => e.id);
  const joinLinks = new Map<string, string>();
  if (claims?.claims?.sub && onlineIds.length) {
    const { data: l } = await supabase.from('events').select('id, link').in('id', onlineIds);
    for (const r of l ?? []) if (r.link) joinLinks.set(r.id, r.link);
  }
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

  const head = (eyebrow: string, title: string, sub?: string, extra?: React.ReactNode) => (
    <div className="tile-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {extra}
    </div>
  );

  const blocks: Record<string, React.ReactNode> = {
    welcome: (
      <div className="t-welcome-in">
        <span className="eyebrow">እንኳን ደህና መጡ</span>
        <h2>{s?.welcome_title || `እንኳን ወደ ${SCHOOL_NAME} በሰላም መጡ።`}</h2>
        <p style={{ whiteSpace: 'pre-line' }}>{s?.welcome_text || 'ለመመዝገብ ወደ ቢሮ ቁጥር 7 በአካል ይሂዱ።'}</p>
        <div className="btn-row">
          {regOpen === true && <Link href="/register" className="btn green">📝 አባል ይሁኑ</Link>}
          <Link href="/login" className="btn">የአባል መግቢያ</Link>
          <Link href="/feedback" className="btn secondary">አስተያየት ይስጡ</Link>
        </div>
      </div>
    ),
    donate: (
      <div className="t-donate-in">
        <span className="donate-icon" aria-hidden>🤲</span>
        <h2>አገልግሎታችንን ይደግፉ</h2>
        <p>በTelebirr ወይም በCBE የሚያደርጉት እርዳታ ለትምህርት፣ ለዝማሬ እና ለበጎ አድራጎት አገልግሎቶች ይውላል።</p>
        <Link href="/donate" className="btn light">ለመርዳት →</Link>
      </div>
    ),
    about: (
      <div id="about" className="t-about-in">
        <div className="about-title">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={72} height={72} />
          <div>
            <span className="eyebrow">ስለ እኛ</span>
            <h2>{s?.about_title || SCHOOL_NAME}</h2>
          </div>
        </div>
        {s?.about_text && <p className="about-text">{s.about_text}</p>}
        <div className="about-stats">
          <div><b>{years}ኛ</b><span>የምሥረታ ዓመት</span></div>
          <div><b>2000</b><span>ዓ.ም ተመሠረተ</span></div>
          <div><b>{DEPARTMENTS.length}</b><span>ክፍሎች</span></div>
        </div>
        <div className="btn-row">
          <Link href="/history" className="btn">ሙሉ ታሪካችንን ያንብቡ →</Link>
          <Link href="/departments" className="btn secondary">ክፍሎቻችን</Link>
        </div>
      </div>
    ),
    mission: (s?.mission || s?.vision || values.length > 0) ? (
      <div className="t-mission-in">
        {head('ማንነታችን', 'ተልዕኮ፣ ራዕይ እና እሴቶች')}
        <div className="mvv-list">
          {s?.mission && <div className="mvv-item"><span className="mvv-icon">🎯</span><div><h3>ተልዕኮ</h3><p>{s.mission}</p></div></div>}
          {s?.vision && <div className="mvv-item"><span className="mvv-icon">👁️</span><div><h3>ራዕይ</h3><p style={{ whiteSpace: 'pre-line' }}>{s.vision}</p></div></div>}
          {values.length > 0 && (
            <div className="mvv-item"><span className="mvv-icon">❤️</span><div><h3>እሴቶች</h3>
              <div className="value-chips">{values.map((v) => <span key={v}>{v}</span>)}</div></div>
            </div>
          )}
        </div>
      </div>
    ) : null,
    departments: (
      <div id="departments">
        {head('አገልግሎቶች', 'ክፍሎቻችን እና አገልግሎቶቻችን', 'በሰንበት ትምህርት ቤታችን የሚሰጡ ዋና ዋና ትምህርቶችና የአገልግሎት ክፍሎች።',
          <Link href="/departments" className="btn sm secondary">ሁሉም ክፍሎች →</Link>)}
        <div className="service-cards">
          {SERVICES.map((x) => (
            <Link key={x.href} href={x.href} className="service-card">
              <span className="mvv-icon">{x.icon}</span>
              <h3>{x.title}</h3>
              <p className="muted">{x.text}</p>
              <span className="more">ተጨማሪ ያንብቡ →</span>
            </Link>
          ))}
        </div>
        <div className="dept-chips">
          {DEPARTMENTS.map((d) => <Link key={d.code} href="/departments">{d.name}</Link>)}
        </div>
      </div>
    ),
    contact: (
      <div id="contact">
        {head('ያግኙን', 'አድራሻችን', 'ለማንኛውም ጥያቄ ይደውሉልን፣ ይጻፉልን ወይም በአካል ይጎብኙን።')}
        <div className="contact-split">
          <div className="contact-list">
            <a className="contact-row" href={`tel:${phone.replace(/\s/g, '')}`}><span className="mvv-icon">📞</span><span><b>ስልክ</b><span dir="ltr">{phone}</span></span></a>
            <a className="contact-row" href={`mailto:${email}`}><span className="mvv-icon">✉️</span><span><b>ኢሜይል</b><span dir="ltr">{email}</span></span></a>
            <div className="contact-row"><span className="mvv-icon">📍</span><span><b>አድራሻ</b><span>{address}</span><span className="small muted">{CHURCH_NAME}</span></span></div>
            {links.length > 0 && (
              <div className="contact-social">
                <b>ይከተሉን</b>
                <SocialButtons links={links} />
              </div>
            )}
          </div>
          {Number.isFinite(lat) && Number.isFinite(lng) && (
            <div className="map-card">
              <iframe
                title="ካርታ"
                src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a className="btn secondary" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
                በGoogle Maps ይክፈቱ ↗
              </a>
            </div>
          )}
        </div>
      </div>
    ),
    social: links.length > 0 && !sections.some((x) => x.key === 'contact') ? (
      <div>
        {head('ይከተሉን', 'ማኅበራዊ ሚዲያ')}
        <SocialButtons links={links} />
      </div>
    ) : null,
  };

  // Bento layout: tiles side by side in pairs; a tile takes the full row when its partner is hidden.
  const shown = new Set<string>(sections.map((x) => x.key).filter((k) => blocks[k]));
  const PAIRS: [string, string, number][] = [['welcome', 'donate', 8], ['about', 'mission', 7]];
  const tile = (key: string, span: number) => (
    <section key={key} className={`tile t-${key} span-${span} reveal`}>{blocks[key]}</section>
  );
  const tiles: React.ReactNode[] = [];
  for (const [a, b, wide] of PAIRS) {
    if (shown.has(a)) tiles.push(tile(a, shown.has(b) ? wide : 12));
    if (shown.has(b)) tiles.push(tile(b, shown.has(a) ? 12 - wide : 12));
  }
  for (const k of ['departments', 'contact', 'social']) if (shown.has(k)) tiles.push(tile(k, 12));

  return (
    <>
      <PublicHeader />
      {s?.announcement_active && s.announcement && (
        <div className="announce-bar" role="status">📢 {s.announcement}</div>
      )}
      <section className={`hero ${hero ? 'has-photo' : ''}`} style={hero ? { backgroundImage: `url("${hero}")` } : undefined}>
        <div className="hero-top">
          <h1>{SCHOOL_NAME}</h1>
          <p className="hero-en">{SCHOOL_NAME_EN}</p>
          <TodayGreeting items={greetings} />
        </div>
        <div className="hero-grid hero-split">
          <aside className="week-panel glass-panel" aria-labelledby="week-title">
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
                        <span dir="ltr">{fmtTime(e.event_time)}</span>
                      </div>
                      <b>{e.kind ? `${EVENT_KINDS[e.kind]}፦ ` : ''}{e.title}</b>
                      {(e.mode === 'online' || e.place) && (
                        <span className="week-where">
                          {e.mode === 'online'
                            ? <>💻 {platformName(e.platform) || 'ኦንላይን'}{joinLinks.get(e.id) && <> · <a href={joinLinks.get(e.id)!} target="_blank" rel="noopener noreferrer">ተቀላቀል ↗</a></>}</>
                            : <>📍 {e.place}</>}
                        </span>
                      )}
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
          <HolidaysPanel />
        </div>
        <div className="hero-buttons hero-contacts">
          <a className="glass" href={`tel:${phone.replace(/\s/g, '')}`} dir="ltr">📞 {phone}</a>
          <a className="glass solid" href="#about">ስለ እኛ</a>
          <a className="glass" href="#departments">አገልግሎቶች</a>
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
      <section className="serve-band reveal" aria-labelledby="serve-title">
        <div className="serve-head">
          <span className="eyebrow">አገልግሎት</span>
          <h2 id="serve-title">በምን ማገልገል ይፈልጋሉ?</h2>
          <p className="muted">አንዱን ይምረጡ — በአባል መግቢያዎ ገብተው “የእኔ ምደባ” ላይ ይልካሉ፤ ክፍሎቹ አይተው ይመድቡዎታል።</p>
        </div>
        <div className="serve-chips">
          {[['teach_course', '📘 የኮርስ መምህር'], ['teach_abnet', '📜 የአብነት መምህር'], ...DUTIES.map((d) => [d, d])].map(([v, l]) => (
            <Link key={v} href={`/login?next=${encodeURIComponent(`/student?v=duty&pick=${v}`)}`}>{l}</Link>
          ))}
        </div>
      </section>
      <main className="bento">{tiles}</main>
      <ScrollReveal />
    </>
  );
}
