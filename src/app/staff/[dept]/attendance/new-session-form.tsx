'use client';
import { EcDatePicker } from '@/components/ec-date-picker';
import { SESSION_TYPES, type SessionType } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';

export function NewSessionForm({ dept, types }: { dept: string; types: SessionType[] }) {
  return (
    <form className="card toolbar" action={`/staff/${dept}/attendance/new`} method="get">
      <div className="field">
        <label htmlFor="type">የክፍለ ጊዜ አይነት</label>
        <select id="type" name="type" defaultValue={types[0]}>
          {types.map((t) => <option key={t} value={t}>{SESSION_TYPES[t].label}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="label">ቀን (ዓ.ም)</span>
        <EcDatePicker name="date" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={0} required />
      </div>
      <div className="field">
        <label htmlFor="time">ሰዓት</label>
        <input id="time" name="time" type="time" />
      </div>
      <button className="btn">+ ክትትል ጨምር</button>
    </form>
  );
}
