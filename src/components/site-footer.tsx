import { SCHOOL_NAME } from '@/lib/constants';

// Social accounts aren't set up yet (spec §14) — shown as labels until real links exist.
const SOCIAL = ['TikTok', 'Telegram', 'Facebook', 'YouTube', 'Instagram'];

/** Fixed bottom bar on every page: rolling verse + address and contact line. */
export function SiteFooter() {
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
          <span className="footer-social">{SOCIAL.join(' · ')}</span>
          <span className="sep">|</span>
          <span>© {new Date().getFullYear()} {SCHOOL_NAME}</span>
        </span>
      </div>
    </footer>
  );
}
