import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { termLabel, type Term } from '@/lib/periods';
import { MediaForm } from '@/components/media-form';
import { Modal } from '@/components/modal';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { PrintButton } from '@/components/print-button';
import { saveTerm, setActiveTerm, deleteTerm, saveTermTags } from '@/lib/actions/office';

type Score = {
  term_id: string; new_members: number; departures: number; sessions: number; attendance_pct: number | null;
  events: number; income: number; donations: number; spent: number;
  property_added: number; property_lost: number; property_maintained: number;
  duties_done: number; duties_missed: number; feedback: number;
};
type Metric = { key: string; label: string; get: (s: Score) => number | null; fmt?: (n: number) => string; better: 'high' | 'low' };
const birr = (n: number) => formatBirr(n);
const GROUPS: { icon: string; title: string; metrics: Metric[] }[] = [
  { icon: '👥', title: 'አባላት', metrics: [
    { key: 'new', label: 'አዲስ አባላት', get: (s) => s.new_members, better: 'high' },
    { key: 'dep', label: 'የለቀቁ', get: (s) => s.departures, better: 'low' },
    { key: 'ses', label: 'ክትትል የተያዘባቸው ክፍለ ጊዜዎች', get: (s) => s.sessions, better: 'high' },
    { key: 'att', label: 'አማካይ ተገኝነት', get: (s) => s.attendance_pct === null ? null : Number(s.attendance_pct), fmt: (n) => `${n}%`, better: 'high' },
  ] },
  { icon: '💵', title: 'ገንዘብ', metrics: [
    { key: 'inc', label: 'ገቢ', get: (s) => Number(s.income), fmt: birr, better: 'high' },
    { key: 'don', label: 'እርዳታ', get: (s) => Number(s.donations), fmt: birr, better: 'high' },
    { key: 'out', label: 'ወጪ', get: (s) => Number(s.spent), fmt: birr, better: 'low' },
    { key: 'net', label: 'የተጣራ (ትርፍ / ኪሳራ)', get: (s) => Number(s.income) + Number(s.donations) - Number(s.spent), fmt: birr, better: 'high' },
  ] },
  { icon: '📦', title: 'ንብረት', metrics: [
    { key: 'padd', label: 'የተጨመረ ንብረት', get: (s) => Number(s.property_added), fmt: birr, better: 'high' },
    { key: 'plost', label: 'የጠፋ ንብረት', get: (s) => Number(s.property_lost), fmt: birr, better: 'low' },
    { key: 'pfix', label: 'የተጠገነ', get: (s) => s.property_maintained, better: 'high' },
  ] },
  { icon: '🧭', title: 'አገልግሎት', metrics: [
    { key: 'ev', label: 'የተካሄዱ ዝግጅቶች', get: (s) => s.events, better: 'high' },
    { key: 'dd', label: 'የተፈጸሙ ስራ ምደባዎች', get: (s) => s.duties_done, better: 'high' },
    { key: 'dm', label: 'ያልተፈጸሙ ስራ ምደባዎች', get: (s) => s.duties_missed, better: 'low' },
    { key: 'fb', label: 'አስተያየቶች', get: (s) => s.feedback, better: 'high' },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.metrics);

/** ጽሕፈት ቤት: leadership teams — each team's results, side-by-side comparison, strengths and weaknesses, tags. */
export default async function Terms({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const [{ data }, { data: sc }] = await Promise.all([
    supabase.from('leadership_terms').select('*').order('starts_on', { ascending: true }),
    supabase.rpc('term_scorecard'),
  ]);
  const terms = (data ?? []) as (Term & { tags: string[] | null })[];
  const score = new Map(((sc ?? []) as Score[]).map((s) => [s.term_id, s]));
  const scored = terms.filter((t) => score.has(t.id));

  // best / worst per metric (only when two or more teams can be compared)
  const best = new Map<string, string[]>(); const worst = new Map<string, string[]>();
  const spread = new Map<string, number>();   // how clearly a metric separates the teams (0–1)
  if (scored.length > 1) {
    for (const m of ALL) {
      const vals = scored.map((t) => ({ id: t.id, v: m.get(score.get(t.id)!) })).filter((x): x is { id: string; v: number } => x.v !== null);
      if (vals.length < 2) continue;
      const nums = vals.map((x) => x.v);
      const hi = Math.max(...nums), lo = Math.min(...nums);
      if (hi === lo) continue;
      const top = m.better === 'high' ? hi : lo, bottom = m.better === 'high' ? lo : hi;
      spread.set(m.key, (hi - lo) / Math.max(Math.abs(hi), Math.abs(lo), 1));
      for (const x of vals) {
        if (x.v === top) best.set(x.id, [...(best.get(x.id) ?? []), m.key]);
        if (x.v === bottom) worst.set(x.id, [...(worst.get(x.id) ?? []), m.key]);
      }
    }
  }
  const cellTone = (id: string, key: string) => best.get(id)?.includes(key) ? 'tc-best' : worst.get(id)?.includes(key) ? 'tc-worst' : '';
  const labelOf = (k: string) => ALL.find((m) => m.key === k)?.label ?? k;
  // on the cards: the three clearest strengths and weaknesses only
  const top3 = (keys: string[] | undefined) => [...(keys ?? [])].sort((a, b) => (spread.get(b) ?? 0) - (spread.get(a) ?? 0)).slice(0, 3);

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>የአመራር ቡድን</h2>
        <span className="count-badge">{terms.length}</span>
        <span className="spacer" />
        <PrintButton />
        <Modal label="+ ቡድን መዝግብ" title="አዲስ የአመራር ቡድን">
          <MediaForm action={saveTerm} submitLabel="+ ቡድን መዝግብ" card={false}>
            <div className="field"><label>የቡድኑ ስም</label><input name="name" required placeholder="ለምሳሌ፦ አትናቴዎስ" /></div>
            <div className="field"><label>የቡድን ቁጥር</label><input name="team_no" type="number" min={1} step={1} placeholder="11" /></div>
            <div className="field"><span className="label">የጀመረበት (ዓ.ም)</span><EcDatePicker name="starts_on" defaultIso={todayIsoAddis()} yearsBack={10} yearsForward={1} required /></div>
            <div className="field"><span className="label">የሚያበቃበት (ዓ.ም፣ ካለ)</span><EcDatePicker name="ends_on" yearsBack={10} yearsForward={5} /></div>
          </MediaForm>
        </Modal>
      </div>
      <p className="small muted">አዲስ የሚመዘገብ ሁሉ (አባላት፣ ክትትል፣ ገንዘብ፣ ንብረት፣ ዝግጅት…) በንቁው ቡድን ስም ይያዛል — ስለዚህ እያንዳንዱ ቡድን ያስመዘገበው ውጤት ከዚህ በታች ይነጻጸራል።</p>

      {terms.length === 0 ? <p className="muted card">እስካሁን ቡድን አልተመዘገበም።</p> : (
        <div className="term-cards">
          {[...terms].reverse().map((t) => {
            const s = score.get(t.id);
            const net = s ? Number(s.income) + Number(s.donations) - Number(s.spent) : 0;
            return (
              <article key={t.id} className={`term-card ${t.is_active ? 'active' : ''}`}>
                <div className="tc-head">
                  <div><b>{termLabel(t)}</b><div className="small muted">{t.starts_on ? formatEc(t.starts_on) : '—'} – {t.ends_on ? formatEc(t.ends_on) : t.is_active ? 'አሁን' : '—'}</div></div>
                  {t.is_active ? <span className="pill present">ንቁ</span> : <span className="pill">ያለፈ</span>}
                </div>
                {s && (
                  <div className="tc-nums">
                    <span><b>{s.new_members}</b>አዲስ አባላት</span>
                    <span><b>{s.attendance_pct ?? '—'}{s.attendance_pct !== null ? '%' : ''}</b>ተገኝነት</span>
                    <span><b className={net < 0 ? 'neg' : 'pos'}>{formatBirr(net)}</b>የተጣራ ገንዘብ</span>
                    <span><b className={Number(s.property_lost) ? 'neg' : ''}>{formatBirr(Number(s.property_added) - Number(s.property_lost))}</b>ንብረት (+/−)</span>
                  </div>
                )}
                {(best.get(t.id)?.length || worst.get(t.id)?.length) ? (
                  <div className="tc-tags">
                    {top3(best.get(t.id)).map((k) => <span key={`b${k}`} className="tag good">💪 {labelOf(k)}</span>)}
                    {top3(worst.get(t.id)).map((k) => <span key={`w${k}`} className="tag weak">⚠ {labelOf(k)}</span>)}
                  </div>
                ) : null}
                {(t.tags ?? []).length > 0 && <div className="tc-tags">{(t.tags ?? []).map((x) => <span key={x} className="tag own">#{x}</span>)}</div>}
                <div className="btn-row tc-actions no-print">
                  <Modal label="🏷 መለያ" title="የቡድኑ መለያዎች (tags)" sub={termLabel(t)} btnClass="btn xs secondary" size="sm">
                    <MediaForm action={saveTermTags} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
                      <input type="hidden" name="id" value={t.id} />
                      <div className="field"><label>መለያዎች (በኮማ ይለዩ)</label><input name="tags" defaultValue={(t.tags ?? []).join('፣ ')} placeholder="ለምሳሌ፦ ጠንካራ ገቢ፣ ብዙ አዲስ አባላት" /></div>
                    </MediaForm>
                  </Modal>
                  {!t.is_active && <ActionButton action={setActiveTerm.bind(null, t.id)} label="ንቁ አድርግ" className="btn xs green" confirmText={`${termLabel(t)} ንቁ ቡድን ይሁን?`} />}
                  <ActionButton action={deleteTerm.bind(null, t.id)} label="አጥፋ" className="btn xs danger" confirmText="ማጥፋት ይፈልጋሉ? የተመዘገቡ መረጃዎች አይጠፉም፤ የቡድን መለያቸው ብቻ ይነሳል።" />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {scored.length > 0 && (
        <>
          <h3 className="section">📊 የቡድኖች ንጽጽር</h3>
          <p className="small muted" style={{ marginTop: 0 }}>💪 አረንጓዴ = በዚህ ረገድ ከቡድኖቹ የተሻለ · ⚠ ቀይ = ደካማ{scored.length < 2 ? ' (ለማነጻጸር ቢያንስ ሁለት ቡድኖች ያስፈልጋሉ)' : ''}።</p>
          <div className="table-wrap">
            <table className="term-compare">
              <thead><tr><th>መለኪያ</th>{scored.map((t) => <th key={t.id} className="num">{termLabel(t)}{t.is_active ? ' •' : ''}</th>)}</tr></thead>
              <tbody>
                {GROUPS.map((g) => (
                  <Fragment key={g.title}>
                    <tr className="tg-row"><td colSpan={scored.length + 1}>{g.icon} {g.title}</td></tr>
                    {g.metrics.map((m) => (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        {scored.map((t) => {
                          const v = m.get(score.get(t.id)!);
                          return <td key={t.id} className={`num ${cellTone(t.id, m.key)}`}>{v === null ? '—' : m.fmt ? m.fmt(v) : v}</td>;
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
