'use client';
import { useState } from 'react';
import { CHURCH_NAME, SCHOOL_NAME } from '@/lib/constants';

export type CardPerson = {
  id: string; name: string; christianName: string; regNo: string; sex: string; cls: string; type: string;
  depts: string; registered: string; photo: string | null; qr: string;
};

const FIELDS = {
  photo: 'ፎቶ', name: 'ሙሉ ስም', christianName: 'የክርስትና ስም', regNo: 'የምዝገባ ቁጥር', sex: 'ፆታ', cls: 'ክፍል (ትምህርት)',
  type: 'የአባልነት ሁኔታ', depts: 'የመረጡት ክፍል', registered: 'የምዝገባ ቀን', valid: 'የሚያገለግልበት ዘመን', qr: 'QR ኮድ',
} as const;
type Field = keyof typeof FIELDS;
const DEFAULT: Field[] = ['photo', 'name', 'christianName', 'regNo', 'sex', 'cls', 'type', 'valid', 'qr'];

/** Live-preview designer + printable A4 sheet of member ID cards. */
export function CardStudio({ people, year }: { people: CardPerson[]; year: number | null }) {
  const [on, setOn] = useState<Set<Field>>(new Set(DEFAULT));
  const [portrait, setPortrait] = useState(false);
  const [title, setTitle] = useState('የአባልነት መታወቂያ');
  const [valid, setValid] = useState(year ? `${year} ዓ.ም` : '');
  const [preview, setPreview] = useState(0);
  const has = (f: Field) => on.has(f);
  const toggle = (f: Field) => { const n = new Set(on); if (n.has(f)) n.delete(f); else n.add(f); setOn(n); };

  const card = (p: CardPerson) => {
    const rows: [string, string][] = ([
      ['christianName', 'የክርስትና ስም'], ['regNo', 'መለያ ቁ.'], ['sex', 'ፆታ'], ['cls', 'ክፍል'], ['type', 'አባልነት'],
      ['depts', 'አገልግሎት'], ['registered', 'የተመዘገበ'],
    ] as [Field, string][]).filter(([f]) => has(f) && p[f as keyof CardPerson]).map(([f, l]) => [l, String(p[f as keyof CardPerson])]);
    return (
      <div key={p.id} className={`id-card ${portrait ? 'portrait' : ''}`}>
        <div className="id-card-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-192.png" alt="" />
          <div><b>{SCHOOL_NAME}</b><span>{CHURCH_NAME}</span></div>
        </div>
        <div className="id-card-title">{title}</div>
        <div className="id-card-body">
          {has('photo') && (p.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="id-photo" src={p.photo} alt="" />
            : <div className="id-photo empty">{p.name.slice(0, 1)}</div>)}
          <div className="id-info">
            {has('name') && <b className="id-name">{p.name}</b>}
            <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </div>
          {has('qr') && <div className="id-qr" dangerouslySetInnerHTML={{ __html: p.qr }} />}
        </div>
        {has('valid') && valid && <div className="id-card-foot">የሚያገለግለው፦ {valid}</div>}
      </div>
    );
  };

  const sample = people[preview] ?? null;
  return (
    <>
      <section className="card-studio no-print">
        <div className="card-preview">
          <div className="small muted" style={{ marginBottom: 8 }}>ቅድመ እይታ · {portrait ? '54 × 85.6 ሚሜ' : '85.6 × 54 ሚሜ'}</div>
          {sample ? card(sample) : <p className="muted">ምንም አባል አልተመረጠም።</p>}
          {people.length > 1 && (
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button type="button" className="btn sm secondary" onClick={() => setPreview((preview - 1 + people.length) % people.length)}>‹</button>
              <span className="small">{preview + 1} / {people.length}</span>
              <button type="button" className="btn sm secondary" onClick={() => setPreview((preview + 1) % people.length)}>›</button>
            </div>
          )}
        </div>
        <div className="card-settings">
          <h3>የመታወቂያ ቅንብር</h3>
          <div className="form-grid">
            <div className="field"><label htmlFor="ct">ርዕስ</label><input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="field"><label htmlFor="cv">የሚያገለግልበት ዘመን</label><input id="cv" value={valid} onChange={(e) => setValid(e.target.value)} placeholder="2019 ዓ.ም" /></div>
            <div className="field">
              <label htmlFor="co">አቀማመጥ</label>
              <select id="co" value={portrait ? 'p' : 'l'} onChange={(e) => setPortrait(e.target.value === 'p')}>
                <option value="l">አግድም (85.6 × 54 ሚሜ)</option>
                <option value="p">ቁመት (54 × 85.6 ሚሜ)</option>
              </select>
            </div>
          </div>
          <span className="label">በመታወቂያው ላይ የሚታዩ</span>
          <div className="field-chips">
            {(Object.keys(FIELDS) as Field[]).map((f) => (
              <label key={f} className={`chip-check ${has(f) ? 'on' : ''}`}>
                <input type="checkbox" checked={has(f)} onChange={() => toggle(f)} /> {FIELDS[f]}
              </label>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button type="button" className="btn green" disabled={!people.length} onClick={() => window.print()}>🖨 {people.length} መታወቂያዎችን አትም</button>
            <button type="button" className="btn sm secondary" onClick={() => { setOn(new Set(DEFAULT)); setPortrait(false); }}>ወደ መደበኛው መልስ</button>
          </div>
          <p className="small muted">በአንድ A4 ገጽ {portrait ? 9 : 10} መታወቂያዎች ይታተማሉ። QR ኮዱ ሲቃኝ የ“ሰነድ ማረጋገጫ” ገጽ አባልነቱን ያረጋግጣል። “Save as PDF” በመምረጥ PDF ማውረድ ይቻላል።</p>
        </div>
      </section>

      <div className={`card-sheet ${portrait ? 'portrait' : ''}`}>
        {people.map((p) => card(p))}
      </div>
    </>
  );
}
