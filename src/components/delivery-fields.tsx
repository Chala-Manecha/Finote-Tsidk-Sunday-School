'use client';
import { useState } from 'react';
import { PLATFORMS, type Delivery } from '@/lib/constants';

/** “በቤተ ክርስቲያን / ኦንላይን” — when online: the platform and the meeting link. */
export function DeliveryFields({ initial, idPrefix = 'dl' }: { initial?: Partial<Delivery> | null; idPrefix?: string }) {
  const [mode, setMode] = useState(initial?.mode ?? 'physical');
  return (
    <div className="delivery-fields">
      <div className="field">
        <span className="label">የሚካሄድበት</span>
        <div className="seg">
          <label className={mode === 'physical' ? 'on' : ''}>
            <input type="radio" name="mode" value="physical" checked={mode === 'physical'} onChange={() => setMode('physical')} /> 🏛 በቤተ ክርስቲያን
          </label>
          <label className={mode === 'online' ? 'on' : ''}>
            <input type="radio" name="mode" value="online" checked={mode === 'online'} onChange={() => setMode('online')} /> 💻 ኦንላይን
          </label>
        </div>
      </div>
      {mode === 'online' && (
        <>
          <div className="field">
            <label htmlFor={`${idPrefix}-platform`}>መድረክ <span className="req">*</span></label>
            <select id={`${idPrefix}-platform`} name="platform" required defaultValue={initial?.platform ?? 'meet'}>
              {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 260px' }}>
            <label htmlFor={`${idPrefix}-link`}>ማስፈንጠሪያ (link)</label>
            <input id={`${idPrefix}-link`} name="link" type="url" dir="ltr" placeholder="https://meet.google.com/…" defaultValue={initial?.link ?? ''} />
            <span className="small muted">ለአባላትና ለሠራተኞች ብቻ ይታያል።</span>
          </div>
        </>
      )}
    </div>
  );
}
