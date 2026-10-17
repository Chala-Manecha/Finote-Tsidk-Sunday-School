import Link from 'next/link';
import { bahireHasab } from '@/lib/bahire-hasab';
import { EC_MONTHS, todayEc, todayIsoAddis } from '@/lib/ethiopian-calendar';

/** ባሕረ ሃሳብ for one year: the working (ዓመተ ዓለም → … → ነነዌ) and the year's fasts and feasts. */
export function BahireHasabView({ year, href }: { year?: number; href: (y: number) => string }) {
  const y = year && year > 1000 && year < 3000 ? year : todayEc().year;
  const b = bahireHasab(y);
  const today = todayIsoAddis();
  const next = b.feasts.find((f) => f.iso >= today);
  const steps: [string, string | number, string][] = [
    ['ዓመተ ዓለም', b.ameteAlem, `5500 + ${y}`],
    ['ወንጌላዊ', b.evangelist, `${b.ameteAlem} ÷ 4 → ቀሪ ${b.evangelistRemainder} (0 ዮሐንስ · 1 ማቴዎስ · 2 ማርቆስ · 3 ሉቃስ)`],
    ['መጠነ ራብዒት', b.meteneRabiet, `${b.ameteAlem} ÷ 4 (ድርሻው)`],
    ['መባቻ (መስከረም 1)', b.mebacha, `(${b.ameteAlem} + ${b.meteneRabiet}) ÷ 7 → ቀሪ ${b.mebachaRemainder} (0 ሰኞ … 6 እሁድ)`],
    ['መደብ', b.medeb, `${b.ameteAlem} ÷ 19 → ቀሪ`],
    ['ወንበር', b.wenber, `መደብ − 1${b.medeb === 0 ? ' (መደብ 0 ሲሆን 18)' : ''}`],
    ['አበቅቴ', b.abekte, `(ወንበር × 11) ÷ 30 → ቀሪ`],
    ['መጥቅዕ', b.metqi, `(ወንበር × 19) ÷ 30 → ቀሪ · ${b.metqi > 14 || b.metqi === 0 ? 'ከ14 በላይ → መስከረም' : 'ከ14 በታች → ጥቅምት'} · አበቅቴ + መጥቅዕ = 30`],
    ['በዓለ መጥቅዕ', `${b.metqiDate.label} (${b.metqiDate.weekday})`, 'መጥቅዕ የዋለበት ቀን'],
    ['የዕለት ተውሳክ', b.tewsak, `${b.metqiDate.weekday} — (እሁድ 7 · ሰኞ 6 · ማክሰኞ 5 · ረቡዕ 4 · ሐሙስ 3 · አርብ 2 · ቅዳሜ 8)`],
    ['ጾመ ነነዌ', b.feasts[0].label, `መጥቅዕ + ተውሳክ = ${b.metqiDate.ec.day} + ${b.tewsak} = ${b.metqiDate.ec.day + b.tewsak} → ${b.metqiDate.ec.month === 1 ? 'ጥር' : 'የካቲት'}${b.metqiDate.ec.day + b.tewsak > 30 ? ' (ከ30 በላይ → −30፣ ቀጣዩ ወር)' : ''}`],
  ];
  return (
    <div className="bh">
      <div className="bh-year no-print">
        <Link className="btn sm secondary" href={href(y - 1)} scroll={false}>← {y - 1}</Link>
        <b>{y} ዓ.ም · ዘመነ {b.evangelist}</b>
        <Link className="btn sm secondary" href={href(y + 1)} scroll={false}>{y + 1} →</Link>
      </div>
      <section className="card">
        <div className="card-head"><b>🧮 አቆጣጠሩ</b></div>
        <div className="bh-steps">
          {steps.map(([k, v, how]) => (
            <div key={k} className="bh-step"><span className="small muted">{k}</span><b>{v}</b><span className="small">{how}</span></div>
          ))}
        </div>
      </section>
      <section className="card">
        <div className="card-head"><b>📅 አጽዋማትና በዓላት — {y} ዓ.ም</b></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>በዓል / ጾም</th><th className="num">ተውሳክ</th><th>ቀን</th><th>ዕለት</th><th>በፈረንጅ</th></tr></thead>
            <tbody>
              {b.feasts.map((f) => (
                <tr key={f.key} className={f.key === next?.key ? 'row-next' : f.iso < today ? 'row-past' : ''}>
                  <td><b>{f.name}</b>{f.key === next?.key && <span className="pill present" style={{ marginInlineStart: 6 }}>ቀጣይ</span>}</td>
                  <td className="num">{f.key === 'nineveh' ? '—' : f.tewsak}</td>
                  <td>{f.label}</td>
                  <td>{f.weekday}</td>
                  <td className="small muted" dir="ltr">{f.iso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>ተውሳክ፦ ከጾመ ነነዌ በኋላ ያሉት ቀናት (ሙሉ 30ዎቹ ወራት ተቀንሰው)። ቀኑ ከነነዌ ተቆጥሮ ይገኛል።</p>
      </section>
    </div>
  );
}

/** Home page: the year's main holidays with ወንጌላዊ and መባቻ. */
export function HolidaysPanel() {
  const today = todayIsoAddis();
  let b = bahireHasab(todayEc().year);
  if (!b.feasts.some((f) => f.iso >= today)) b = bahireHasab(b.year + 1);
  const SHOW = new Set(['abiy', 'debrezeit', 'hosanna', 'siklet', 'tinsae', 'erget', 'paraclete', 'hawariat', 'dihnet']);
  const list = b.feasts.filter((f) => SHOW.has(f.key));
  const next = list.find((f) => f.iso >= today);
  return (
    <aside className="week-panel glass-panel holiday-panel" aria-label="በዓላት">
      <h2>📅 የ{b.year} ዓ.ም በዓላትና አጽዋማት</h2>
      <div className="hp-meta">
        <span><small>ወንጌላዊ</small><b>{b.evangelist}</b></span>
        <span><small>መባቻ</small><b>{b.mebacha}</b></span>
      </div>
      <ul className="hp-list">
        {list.map((f) => (
          <li key={f.key} className={f.key === next?.key ? 'next' : f.iso < today ? 'past' : ''}>
            <span>{f.name}</span>
            <span><b>{EC_MONTHS[f.ec.month - 1]} {f.ec.day}</b> <small>{f.weekday}</small></span>
          </li>
        ))}
      </ul>
      <Link className="hp-more" href="/abnet?v=bahire">ባሕረ ሃሳቡን ይመልከቱ →</Link>
    </aside>
  );
}
