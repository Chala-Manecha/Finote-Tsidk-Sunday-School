'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EXPORT_COLUMNS, EXPORT_TEMPLATES } from '@/lib/member-export';

export type ListRow = {
  id: string; regNo: string; photo: string | null; name: string; sex: string; age: number | null; group: string;
  phone: string; work: string; type: string; status: string; statusLabel: string; depts: string;
};

const MAX_LINK = 150; // selected ids travel in the link for the PDF table and the ID cards

/** The member table: photo, tick boxes, and the export window (Excel / PDF / QR) + ID cards. */
export function MemberList({ rows, linkToDetail, dept, filters }: {
  rows: ListRow[]; linkToDetail: boolean; dept: string; filters: Record<string, string>;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };

  const cardsHref = useMemo(() => {
    const p = new URLSearchParams(picked.size ? { scope: 'selected', ids: [...picked].slice(0, MAX_LINK).join(',') } : { scope: 'filtered', ...filters });
    if (dept) p.set('dept', dept);
    return `/staff/cards?${p}`;
  }, [picked, filters, dept]);

  return (
    <>
      <div className="list-bar no-print">
        <span className="small"><b>{rows.length}</b> አባላት{picked.size > 0 && <> · <b>{picked.size}</b> ተመርጠዋል <button type="button" className="link small" onClick={() => setPicked(new Set())}>አንሳ</button></>}</span>
        <span style={{ flex: 1 }} />
        <Link className="btn sm secondary" href={cardsHref}>🪪 መታወቂያ{picked.size ? ` (${picked.size})` : ''}</Link>
        <button type="button" className="btn sm" onClick={() => setOpen(true)}>⬇ ላክ / Export</button>
        <button type="button" className="btn sm secondary" onClick={() => window.print()}>🖨 አትም</button>
      </div>

      <div className="table-wrap">
        <table className="member-list">
          <thead>
            <tr>
              <th className="no-print" style={{ width: 34 }}>
                <input type="checkbox" checked={all} aria-label="ሁሉንም ምረጥ"
                  onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
              </th>
              <th>አባል</th><th>ፆታ</th><th className="num">ዕድሜ</th><th>የዕድሜ ክፍል</th><th>ስልክ</th>
              <th>የአባልነት ሁኔታ</th><th>ሁኔታ</th><th>የመረጡት ክፍል</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className={picked.has(m.id) ? 'picked' : ''}>
                <td className="no-print"><input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m.id)} aria-label={m.name} /></td>
                <td>
                  <div className="who">
                    {m.photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="avatar" src={m.photo} alt="" loading="lazy" />
                      : <span className="avatar empty" aria-hidden>{m.name.replace(/^(ቀሲስ|ዲያቆን|ዶክተር) /, '').slice(0, 1)}</span>}
                    <span>
                      {linkToDetail ? <Link className="link" href={`/staff/members/${m.id}`}>{m.name}</Link> : <b className="nm">{m.name}</b>}
                      <span className="small muted reg">{m.regNo}</span>
                    </span>
                  </div>
                </td>
                <td>{m.sex}</td>
                <td className="num">{m.age ?? '—'}</td>
                <td className="small">{m.group || '—'}</td>
                <td dir="ltr" className="small">{m.phone || '—'}</td>
                <td className="small">{m.type}</td>
                <td><span className={`pill st-${m.status}`}>{m.statusLabel}</span></td>
                <td className="small">{m.depts || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="muted">ምንም አባል አልተገኘም።</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <ExportDialog onClose={() => setOpen(false)} picked={[...picked]} dept={dept} filters={filters} total={rows.length} />}
    </>
  );
}

function ExportDialog({ onClose, picked, dept, filters, total }: {
  onClose: () => void; picked: string[]; dept: string; filters: Record<string, string>; total: number;
}) {
  const [format, setFormat] = useState<'xlsx' | 'pdf' | 'qr'>('xlsx');
  const [scope, setScope] = useState<'all' | 'filtered' | 'selected'>(picked.length ? 'selected' : 'filtered');
  const [tpl, setTpl] = useState('basic');
  const [cols, setCols] = useState<string[]>(EXPORT_TEMPLATES[0].cols);
  const [err, setErr] = useState('');
  const groups = [...new Set(EXPORT_COLUMNS.map((c) => c.group))];

  const pickTemplate = (k: string) => { setTpl(k); setCols(EXPORT_TEMPLATES.find((t) => t.key === k)!.cols); };
  const toggleCol = (k: string) => { setTpl(''); setCols(cols.includes(k) ? cols.filter((x) => x !== k) : [...cols, k]); };

  function go() {
    setErr('');
    if (format !== 'qr' && cols.length === 0) return setErr('ቢያንስ አንድ አምድ ይምረጡ።');
    if (scope === 'selected' && picked.length === 0) return setErr('መጀመሪያ ከዝርዝሩ አባላትን ይምረጡ።');
    const fields: [string, string][] = [['format', format], ['scope', scope]];
    if (dept) fields.push(['dept', dept]);
    if (scope === 'filtered') for (const [k, v] of Object.entries(filters)) fields.push([k, v]);
    if (scope === 'selected') for (const id of picked) fields.push(['ids', id]);
    for (const c of cols) fields.push(['cols', c]);
    if (format === 'pdf') {
      if (scope === 'selected' && picked.length > MAX_LINK) return setErr(`ለPDF ቢበዛ ${MAX_LINK} የተመረጡ አባላት — ወይም “የተጣራው ዝርዝር”ን ይጠቀሙ።`);
      window.open(`/staff/export/members/print?${new URLSearchParams(fields)}`, '_blank');
    } else {
      // Excel / QR: posted so a long selection still fits; the browser downloads the file.
      const f = document.createElement('form');
      f.method = 'POST'; f.action = '/staff/export/members'; f.target = '_blank';
      for (const [k, v] of fields) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); }
      document.body.appendChild(f); f.submit(); f.remove();
    }
    onClose();
  }

  const opt = <T extends string>(cur: T, set: (v: T) => void, v: T, title: string, sub: string, disabled = false) => (
    <button type="button" className={`opt-card ${cur === v ? 'on' : ''}`} onClick={() => set(v)} disabled={disabled}>
      <b>{title}</b><span>{sub}</span>
    </button>
  );

  return (
    <div className="xmodal-back no-print" role="dialog" aria-modal="true" aria-labelledby="exp-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="xmodal">
        <div className="xmodal-head">
          <div><h2 id="exp-title">⬇ የአባላት መረጃ ላክ</h2><span className="small muted">Excel፣ PDF ሠንጠረዥ ወይም የQR ምስሎች</span></div>
          <button type="button" className="xmodal-x" onClick={onClose} aria-label="ዝጋ">×</button>
        </div>
        <div className="xmodal-body">
          <h3>1. ቅርጸት</h3>
          <div className="opt-grid">
            {opt(format, setFormat, 'xlsx', '📊 Excel (.xlsx)', 'በአማርኛ ርዕሶችና የኢትዮጵያ ቀን')}
            {opt(format, setFormat, 'pdf', '📄 PDF ሠንጠረዥ', 'ለሕትመት የተዘጋጀ (A4 አግድም)')}
            {opt(format, setFormat, 'qr', '🔳 QR ምስሎች (.zip)', 'ለእያንዳንዱ አባል የማረጋገጫ QR')}
          </div>
          <h3>2. የትኞቹ አባላት</h3>
          <div className="opt-grid">
            {opt(scope, setScope, 'all', 'ሁሉም አባላት', dept ? 'የዚህ ክፍል ንቁ አባላት በሙሉ' : 'ንቁ አባላት በሙሉ')}
            {opt(scope, setScope, 'filtered', 'የተጣራው ዝርዝር', `አሁን የሚታዩት (${total})`)}
            {opt(scope, setScope, 'selected', `የተመረጡ (${picked.length})`, 'ምልክት የተደረገባቸው ብቻ', picked.length === 0)}
          </div>
          {format !== 'qr' && (
            <>
              <h3>3. የመረጃ አይነት</h3>
              <div className="field-chips">
                {EXPORT_TEMPLATES.map((t) => (
                  <button type="button" key={t.key} className={`chip-check ${tpl === t.key ? 'on' : ''}`} onClick={() => pickTemplate(t.key)}>{t.label}</button>
                ))}
              </div>
              <div className="btn-row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                <h3 style={{ margin: 0 }}>4. አምዶች ({cols.length})</h3>
                <span className="btn-row">
                  <button type="button" className="link small" onClick={() => { setTpl(''); setCols(EXPORT_COLUMNS.map((c) => c.key)); }}>ሁሉንም ምረጥ</button>
                  <button type="button" className="link small" onClick={() => { setTpl(''); setCols([]); }}>አጽዳ</button>
                </span>
              </div>
              <div className="col-picker">
                {groups.map((g) => (
                  <div key={g}>
                    <div className="col-group">{g}</div>
                    {EXPORT_COLUMNS.filter((c) => c.group === g).map((c) => (
                      <label key={c.key} className="check"><input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}</label>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="xmodal-foot">
          {err && <span className="alert error small" style={{ margin: 0 }}>{err}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn secondary" onClick={onClose}>ተው</button>
          <button type="button" className="btn green" onClick={go}>⬇ አዘጋጅ</button>
        </div>
      </div>
    </div>
  );
}
