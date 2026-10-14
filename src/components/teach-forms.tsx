'use client';
import { useActionState, useState } from 'react';
import { saveMarks, saveClassAttendance } from '@/lib/actions/teaching';
import { COMPONENTS, type ComponentKey } from '@/lib/education';
import { EcDatePicker } from './ec-date-picker';
import type { FormState } from '@/components/media-form';

type Student = { id: string; full_name: string; reg_no: string };
type Marks = Partial<Record<ComponentKey, number | null>>;

type MarkRow = Marks & { absent?: boolean; note?: string | null };

export function MarksGrid({ offeringId, students, marks, weights, locked, attendance = {}, barred = [], makeup = [], passMark = 50 }: {
  offeringId: string; students: Student[]; marks: Record<string, MarkRow>; passMark?: number;
  weights: Record<ComponentKey, number>; locked: boolean;
  attendance?: Record<string, number | null>; barred?: string[]; makeup?: string[];
}) {
  const makeupMode = locked && makeup.length > 0;
  const [state, action, pending] = useActionState<FormState, FormData>(saveMarks, {});
  // Live values so totals and over-the-limit warnings update while typing.
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(students.flatMap((s) =>
    COMPONENTS.map((c) => [`${c.key}_${s.id}`, marks[s.id]?.[c.key] == null ? '' : String(marks[s.id]![c.key])]))));
  const [absent, setAbsent] = useState<Record<string, boolean>>(() => Object.fromEntries(students.map((s) => [s.id, !!marks[s.id]?.absent])));
  const over = (k: ComponentKey, id: string) => { const v = vals[`${k}_${id}`]; return v !== '' && v != null && Number(v) > weights[k]; };
  const overCount = students.reduce((t, s) => t + COMPONENTS.filter((c) => over(c.key, s.id)).length, 0);
  const totalOf = (id: string) => COMPONENTS.reduce((t, c) => t + (absent[id] && c.key === 'final' ? 0 : Number(vals[`${c.key}_${id}`] || 0)), 0);
  return (
    <form action={action}>
      <input type="hidden" name="offering_id" value={offeringId} />
      {makeupMode && <input type="hidden" name="makeup_only" value="1" />}
      <div className="table-wrap">
        <table className="marks-grid">
          <thead>
            <tr>
              <th>ተማሪ</th><th className="num">ክትትል</th>
              {COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}<div className="small muted">/{weights[c.key]}</div></th>)}
              <th className="num">ቀሪ<div className="small muted">ዋና ፈተና</div></th>
              <th className="num">ድምር<div className="small muted">/100</div></th>
              <th>ማስታወሻ</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const total = totalOf(s.id);
              const anyMark = COMPONENTS.some((c) => vals[`${c.key}_${s.id}`] !== '');
              return (
                <tr key={s.id} className={absent[s.id] ? 'is-absent' : ''}>
                  <td>
                    {s.full_name}<input type="hidden" name="member_id" value={s.id} /><div className="small muted">{s.reg_no}</div>
                    {barred.includes(s.id) && <div className="small neg">ክትትል ዝቅተኛ — ዋና ፈተና በትምህርት ክፍል ፈቃድ ብቻ</div>}
                    {makeup.includes(s.id) && <div className="small" style={{ color: 'var(--green)' }}>ድጋሚ ፈተና ተፈቅዷል</div>}
                  </td>
                  <td className="num">{attendance[s.id] == null ? '—' : `${attendance[s.id]}%`}</td>
                  {COMPONENTS.map((c) => {
                    const open = makeupMode ? c.key === 'final' && makeup.includes(s.id) : !locked;
                    const name = `${c.key}_${s.id}`;
                    const finalOff = c.key === 'final' && (barred.includes(s.id) || absent[s.id]);
                    return (
                      <td key={c.key} className="num">
                        <input name={name} type="number" min={0} step="0.25" inputMode="decimal"
                          value={finalOff && absent[s.id] ? '0' : vals[name] ?? ''} disabled={!open} readOnly={finalOff}
                          onChange={(e) => setVals({ ...vals, [name]: e.target.value })}
                          className={over(c.key, s.id) ? 'over' : ''} title={over(c.key, s.id) ? `ከ${weights[c.key]} መብለጥ የለበትም` : undefined}
                          style={{ width: 70 }} aria-label={`${s.full_name} ${c.label}`} />
                      </td>
                    );
                  })}
                  <td className="num">
                    <input type="checkbox" name={`absent_${s.id}`} checked={!!absent[s.id]} disabled={locked}
                      onChange={(e) => setAbsent({ ...absent, [s.id]: e.target.checked })} aria-label={`${s.full_name} ዋና ፈተና ቀሪ`} />
                  </td>
                  <td className="num"><b className={anyMark && total < passMark ? 'neg' : ''}>{anyMark || absent[s.id] ? Math.round(total * 100) / 100 : '—'}</b></td>
                  <td><input name={`note_${s.id}`} defaultValue={marks[s.id]?.note ?? ''} disabled={locked} maxLength={300} placeholder="አማራጭ" style={{ minWidth: 120 }} /></td>
                </tr>
              );
            })}
            {students.length === 0 && <tr><td colSpan={COMPONENTS.length + 5} className="muted">በዚህ ክፍል የተመደበ ተማሪ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      {(!locked || makeupMode) && students.length > 0 && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn secondary" disabled={pending || overCount > 0}>{pending ? '…' : '💾 ረቂቅ አስቀምጥ'}</button>
          <span className="small muted">ረቂቁ በኋላ መቀየር ይቻላል። ለትምህርት ክፍል ሲላክ ይቆለፋል።</span>
          {overCount > 0 && <span className="alert error" style={{ margin: 0 }}>{overCount} ነጥብ(ቦች) ከተፈቀደው በላይ ነው — በቀይ የተመለከቱትን ያስተካክሉ።</span>}
          {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
          {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
        </div>
      )}
    </form>
  );
}

export function ClassAttendanceForm({ offeringId, students, today, initial = {} }: {
  offeringId: string; students: Student[]; today: string; initial?: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<FormState & { n?: number }, FormData>(
    async (prev, fd) => { const r = await saveClassAttendance(prev, fd); return { ...r, n: (prev.n ?? 0) + (r.ok ? 1 : 0) }; }, {});
  return (
    <form action={action} key={state.n}>
      <input type="hidden" name="offering_id" value={offeringId} />
      <div className="field"><span className="label">ቀን (ዓ.ም)</span><EcDatePicker name="session_date" defaultIso={today} yearsBack={1} yearsForward={0} required /></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ተማሪ</th><th>ተገኝቷል</th><th>ግማሽ</th><th>ቀሪ</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name}<input type="hidden" name="member_id" value={s.id} /></td>
                <td><input type="radio" name={`att_${s.id}`} value="present" defaultChecked={(initial[s.id] ?? 'present') === 'present'} aria-label="ተገኝቷል" /></td>
                <td><input type="radio" name={`att_${s.id}`} value="half" defaultChecked={initial[s.id] === 'half'} aria-label="ግማሽ" /></td>
                <td><input type="radio" name={`att_${s.id}`} value="absent" defaultChecked={initial[s.id] === 'absent'} aria-label="ቀሪ" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn" disabled={pending || students.length === 0}>{pending ? '…' : 'ክትትል አስቀምጥ'}</button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
