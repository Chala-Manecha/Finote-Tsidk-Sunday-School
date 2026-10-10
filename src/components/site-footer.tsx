import Link from 'next/link';
import { CHURCH_NAME, CHURCH_NAME_EN, SCHOOL_NAME } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { SITE_DEFAULTS, SOCIAL_PLATFORMS, type SocialLink } from '@/lib/site';

/** Footer on every page (like eotcssu.et) + the thin rolling-verse bar fixed at the bottom. */
export async function SiteFooter() {
  // Contacts and social links are managed by የውስጥ ግንኙነት.
  const supabase = await createClient();
  const [{ data }, { data: s }] = await Promise.all([
    supabase.from('social_links').select('id, platform, url, label, sort').order('sort').order('created_at'),
    supabase.from('site_settings').select('contact_phone, contact_email, contact_address').maybeSingle(),
  ]);
  const links = (data ?? []) as SocialLink[];
  const phone = s?.contact_phone || SITE_DEFAULTS.contact_phone;
  const email = s?.contact_email || SITE_DEFAULTS.contact_email;
  const address = s?.contact_address || SITE_DEFAULTS.contact_address;
  return (
    <>
      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-192.png" alt="" width={56} height={56} />
            <div>
              <b>{SCHOOL_NAME}</b>
              <div className="small">{CHURCH_NAME}</div>
              <div className="small muted">{CHURCH_NAME_EN}</div>
            </div>
          </div>
          <div>
            <b className="footer-h">ያግኙን</b>
            <a href={`tel:${phone.replace(/\s/g, '')}`} dir="ltr">📞 {phone}</a>
            <a href={`mailto:${email}`} dir="ltr">✉️ {email}</a>
            <span>📍 {address}</span>
          </div>
          <div>
            <b className="footer-h">ፈጣን ሊንኮች</b>
            <Link href="/history">ታሪካችን</Link>
            <Link href="/departments">ክፍሎቻችን</Link>
            <Link href="/donate">ለመርዳት</Link>
            <Link href="/verify">ሰነድ ማረጋገጫ</Link>
            <Link href="/student/leave" className="small muted">መልቀቂያ ለመጠየቅ</Link>
          </div>
          {links.length > 0 && (
            <div>
              <b className="footer-h">ይከተሉን</b>
              {links.map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer">{l.label || SOCIAL_PLATFORMS[l.platform]}</a>
              ))}
            </div>
          )}
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} {SCHOOL_NAME}</div>
      </footer>
      <div className="verse-bar" aria-label="ቃለ እግዚአብሔር">
        <span>
          ተፈሣሕኩ እስመ ይቤሉኒ ቤተ እግዚአብሔር ነሐውር።
          <i aria-hidden>✦</i>
          Gara mana waqayoo ni deemna na jennaan nan gammade.
          <i aria-hidden>✦</i>
          ወደ እግዚአብሔር ቤት እንሂድ ባሉኝ ጊዜ ደስ አለኝ።
        </span>
      </div>
    </>
  );
}
