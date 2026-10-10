'use client';
import { useActionState, useMemo, useState } from 'react';
import { STUDY_MODE } from '@/lib/constants';
import { CLASS_LEVELS, classLabel } from '@/lib/education';
import { bulkAssignClass } from '@/lib/actions/education-admin';
import type { FormState } from './media-form';

export type AssignRow = { id: string; name: string; regNo: string; classLevel: string | null; mode: string; self: boolean };

/** Tick students (or all shown), pick a class and/or መደበኛ/የርቀት, apply once. */
export function ClassAssigner({ rows }: { rows: AssignRow[] }) {
  const [state, run, pending] = useActionState<FormState, FormData>(bulkAssignClass, {});
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => `${r.name} ${r.regNo}`.toLowerCase().includes(t)) : rows;
  }, [rows, q]);
  const allShown = shown.length > 0 && shown.every((r) => picked.has(r.id));
  const toggle = (id: string, on: boolean) => {
    const n = new Set(picked);
    if (on) n.add(id); else n.delete(id);
    setPicked(n);
  };
  const toggleAll = (on: boolean) => {
    const n = new Set(picked);
    for (const r of shown) { if (on) n.add(r.id); else n.delete(r.id); }
    setPicked(n);
  };

  return (
    <form action={(fd) => { run(fd); setPicked(new Set()); }}>
      <div className="assign-bar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="በስም ወይም በምዝገባ ቁ. ፈልግ…" aria-label="ፈልግ" />
        <span className="small"><b>{picked.size}</b> ተመርጠዋል</span>
        <select name="class_level" defaultValue="keep" aria-label="ክፍል">
          <option value="keep">ክፍል — እንዳለ</option>
          {CLASS_LEVELS.map((c) => <option key={c} value={c}>ወደ {classLabel(c)}</option>)}
          <option value="none">ከክፍል አውጣ (ያልተመደበ)</option>
        </select>
        <select name="study_mode" defaultValue="keep" aria-label="መርሐ ግብር">
          <option value="keep">መርሐ ግብር — እንዳለ</option>
          {Object.entries(STUDY_MODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn sm green" disabled={pending || picked.size === 0}>{pending ? '…' : 'ለተመረጡት ተግብር'}</button>
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
      {[...picked].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" checked={allShown} onChange={(e) => toggleAll(e.target.checked)} aria-label="ሁሉንም ምረጥ" /></th>
              <th>ተማሪ</th><th>ክፍል</th><th>መርሐ ግብር</th><th>ምዝገባ</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={picked.has(r.id) ? 'picked' : ''} onClick={() => toggle(r.id, !picked.has(r.id))} style={{ cursor: 'pointer' }}>
                <td><input type="checkbox" checked={picked.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} onClick={(e) => e.stopPropagation()} aria-label={r.name} /></td>
                <td>{r.name}<div className="small muted">{r.regNo}</div></td>
                <td>{r.classLevel ? classLabel(r.classLevel) : <span className="pill half">ያልተመደበ</span>}</td>
                <td>{STUDY_MODE[r.mode as keyof typeof STUDY_MODE] ?? r.mode}</td>
                <td className="small muted">{r.self ? 'በራሱ' : 'በትምህርት ክፍል'}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="muted">የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </form>
  );
}
