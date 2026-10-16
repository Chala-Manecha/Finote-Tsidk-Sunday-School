'use client';
import { useState } from 'react';
import { DUTIES, OCCASIONS } from '@/lib/constants';

/** ምድብ (from the list, or typed in under “ሌላ”) and በአል. */
export function DutyFields({ duty, occasion, sfx = 'new' }: { duty?: string; occasion?: string; sfx?: string }) {
  const known = !duty || (DUTIES as readonly string[]).includes(duty);
  const [pick, setPick] = useState(known ? duty ?? '' : 'other');
  return (
    <>
      <div className="field">
        <label htmlFor={`d-${sfx}`}>ምድብ <span className="req">*</span></label>
        <select id={`d-${sfx}`} name="duty" required value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="" disabled>ምድብ ይምረጡ</option>
          {DUTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value="other">ሌላ (ይጻፉ)…</option>
        </select>
      </div>
      {pick === 'other' && (
        <div className="field">
          <label htmlFor={`do-${sfx}`}>የምድቡ ስም <span className="req">*</span></label>
          <input id={`do-${sfx}`} name="duty_other" required maxLength={80} defaultValue={known ? '' : duty} placeholder="ለምሳሌ፦ ጽዳት" />
        </div>
      )}
      <div className="field">
        <label htmlFor={`o-${sfx}`}>በአል <span className="req">*</span></label>
        <select id={`o-${sfx}`} name="occasion" required defaultValue={occasion ?? ''}>
          <option value="" disabled>በአል ይምረጡ</option>
          {OCCASIONS.map((o) => <option key={o}>{o}</option>)}
          {occasion && !(OCCASIONS as readonly string[]).includes(occasion) && <option>{occasion}</option>}
        </select>
      </div>
    </>
  );
}
