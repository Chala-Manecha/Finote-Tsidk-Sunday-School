'use client';
import { useState } from 'react';
import { EcDatePicker } from '@/components/ec-date-picker';
import { TimePicker } from '@/components/time-picker';
import { SESSION_TYPES, type SessionType } from '@/lib/constants';
import { todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DeliveryFields } from '@/components/delivery-fields';

const ICON: Partial<Record<SessionType, string>> = { mezmur: '🎵', wereb: '🥁', abnet: '📜', meeting: '👥', course: '📘' };

/** Start a new attendance sheet: type, date, time, title (and online / at the church). */
export function NewSessionForm({ dept, types }: { dept: string; types: SessionType[] }) {
  const [type, setType] = useState<SessionType>(types[0]);
  const meeting = type === 'meeting';
  return (
    <form className="card new-session" action={`/staff/${dept}/attendance/new`} method="get">
      <div className="card-head"><b>+ አዲስ ክትትል</b></div>
      {types.length > 1 ? (
        <div className="type-tiles" role="radiogroup" aria-label="የክፍለ ጊዜ አይነት">
          {types.map((t) => (
            <label key={t} className={type === t ? 'on' : ''}>
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />
              <i aria-hidden>{ICON[t]}</i><span>{SESSION_TYPES[t].label}</span>
            </label>
          ))}
        </div>
      ) : <input type="hidden" name="type" value={type} />}
      <div className="field">
        <span className="label">ቀን</span>
        <EcDatePicker name="date" defaultIso={todayIsoAddis()} yearsBack={1} yearsForward={0} required />
      </div>
      <div className="field">
        <label htmlFor="time">ሰዓት <span className="small muted">(አማራጭ)</span></label>
        <TimePicker id="time" name="time" />
      </div>
      <div className="field">
        <label htmlFor="title">{meeting ? 'የስብሰባው ጉዳይ' : 'ርዕስ'} {!meeting && <span className="small muted">(አማራጭ)</span>}</label>
        <input id="title" name="title" maxLength={160} required={meeting} placeholder={meeting ? 'ለምሳሌ፦ የወርሃዊ አጠቃላይ ስብሰባ' : 'ለምሳሌ፦ የመስቀል በዓል ዝግጅት'} />
      </div>
      {type !== 'mezmur' && <DeliveryFields idPrefix="ns" />}
      <button className="btn green" style={{ width: '100%', justifyContent: 'center' }}>ዝርዝሩን ክፈትና ክትትል ያዝ →</button>
    </form>
  );
}
