import { SCHOOL_NAME } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_PLATFORMS, type SocialLink } from '@/lib/site';

/** Fixed bottom bar on every page: rolling verse + address and contact line. */
export async function SiteFooter() {
  // Social links are managed by የውስጥ ግንኙነት.
  const supabase = await createClient();
  const { data } = await supabase.from('social_links').select('id, platform, url, label, sort').order('sort').order('created_at');
  const links = (data ?? []) as SocialLink[];
  return (
    <footer className="site-footer">
      <div className="ticker" aria-label="ቃለ እግዚአብሔር">
        <span>
          ተፈሣሕኩ እስመ ይቤሉኒ ቤተ እግዚአብሔር ነሐውር።
          <i aria-hidden>✦</i>
          Gara mana waqayoo ni deemna na jennaan nan gammade.
          <i aria-hidden>✦</i>
          ወደ እግዚአብሔር ቤት እንሂድ ባሉኝ ጊዜ ደስ አለኝ።
        </span>
      </div>
      <div className="footer-info">
        <span className="footer-address">
          📍 አቃቂ ቃሊቲ፣ ወረዳ-1፣ ደብረ ጽጌ ቅዱስ ሩፋኤል ቤተክርስቲያን፣ ኢትዮጵያ
          <span className="footer-en"> · Akaki Kaliti, Woreda 1, Debre Tsige St. Rufael Church, Ethiopia</span>
        </span>
        <span className="footer-line">
          <a href="https://t.me/make_living" target="_blank" rel="noreferrer">Telegram: @make_living</a>
          <span className="sep">|</span>
          {links.length > 0 && (
            <>
              <span className="footer-social">
                {links.map((l, i) => (
                  <span key={l.id}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noopener noreferrer">{SOCIAL_PLATFORMS[l.platform]}</a></span>
                ))}
              </span>
              <span className="sep">|</span>
            </>
          )}
          <span>© {new Date().getFullYear()} {SCHOOL_NAME}</span>
        </span>
      </div>
    </footer>
  );
}
