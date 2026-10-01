'use client';
import { useActionState } from 'react';
import { saveMarks, saveClassAttendance } from '@/lib/actions/teaching';
import { COMPONENTS, type ComponentKey } from '@/lib/education';
import { EcDatePicker } from './ec-date-picker';
import type { FormState } from '@/components/media-form';

type Student = { id: string; full_name: string; reg_no: string };
type Marks = Partial<Record<ComponentKey, number | null>>;

export function MarksGrid({ offeringId, students, marks, weights, locked }: {
  offeringId: string; students: Student[]; marks: Record<string, Marks>;
  weights: Record<ComponentKey, number>; locked: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveMarks, {});
  return (
    <form action={action}>
      <input type="hidden" name="offering_id" value={offeringId} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ተማሪ</th>
              {COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}<div className="small muted">/{weights[c.key]}</div></th>)}
              <th className="num">ድምር</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const m = marks[s.id] ?? {};
              const total = COMPONENTS.reduce((t, c) => t + Number(m[c.key] ?? 0), 0);
              return (
                <tr key={s.id}>
                  <td>{s.full_name}<input type="hidden" name="member_id" value={s.id} /><div className="small muted">{s.reg_no}</div></td>
                  {COMPONENTS.map((c) => (
                    <td key={c.key} className="num">
                      <input name={`${c.key}_${s.id}`} type="number" min={0} max={weights[c.key]} step="0.25"
                        defaultValue={m[c.key] ?? ''} disabled={locked} style={{ width: 72 }} aria-label={`${s.full_name} ${c.label}`} />
                    </td>
                  ))}
                  <td className="num"><b>{total || '—'}</b></td>
                </tr>
              );
            })}
            {students.length === 0 && <tr><td colSpan={COMPONENTS.length + 2} className="muted">በዚህ ክፍል የተመደበ ተማሪ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      {!locked && students.length > 0 && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={pending}>{pending ? '…' : 'ውጤት አስቀምጥ'}</button>
          {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
          {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
        </div>
      )}
    </form>
  );
}

export function ClassAttendanceForm({ offeringId, students, today }: { offeringId: string; students: Student[]; today: string }) {
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
                <td><input type="radio" name={`att_${s.id}`} value="present" defaultChecked aria-label="ተገኝቷል" /></td>
                <td><input type="radio" name={`att_${s.id}`} value="half" aria-label="ግማሽ" /></td>
                <td><input type="radio" name={`att_${s.id}`} value="absent" aria-label="ቀሪ" /></td>
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
