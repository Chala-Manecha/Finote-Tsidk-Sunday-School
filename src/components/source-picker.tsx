'use client';
import { useId, useState } from 'react';
import { PROPERTY_SOURCES } from '@/lib/constants';

const OTHER = '__other';

/** ምንጭ: one of the usual sources, or "ሌላ" with a text box. Submits `source`. */
export function SourcePicker({ defaultValue = 'አዲስ በክፍሉ የገዛ' }: { defaultValue?: string }) {
  const id = useId();
  const known = (PROPERTY_SOURCES as readonly string[]).includes(defaultValue);
  const [pick, setPick] = useState(known ? defaultValue : OTHER);
  const [other, setOther] = useState(known ? '' : defaultValue);
  return (
    <div className="field">
      <label htmlFor={id}>ምንጭ</label>
      <select id={id} value={pick} onChange={(e) => setPick(e.target.value)}>
        {PROPERTY_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value={OTHER}>ሌላ (ይጻፉ)</option>
      </select>
      {pick === OTHER && (
        <input value={other} onChange={(e) => setOther(e.target.value)} required placeholder="ምንጩን ይጻፉ" aria-label="ሌላ ምንጭ" style={{ marginTop: 6 }} />
      )}
      <input type="hidden" name="source" value={pick === OTHER ? other : pick} />
    </div>
  );
}
