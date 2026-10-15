'use client';
import { useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');
function split(v?: string | null) {
  if (!v || !/^\d{1,2}:\d{2}/.test(v)) return null;
  const [h, m] = v.split(':').map(Number);
  return { h12: h % 12 === 0 ? 12 : h % 12, m, pm: h >= 12 };
}

/** Hour · minute · AM/PM — submits HH:MM (24 h) under `name`. Empty unless required or a value is given. */
export function TimePicker({ name, defaultValue, required, id, label = 'ሰዓት' }: {
  name: string; defaultValue?: string | null; required?: boolean; id?: string; label?: string;
}) {
  const init = split(defaultValue);
  const [h, setH] = useState<number | ''>(init?.h12 ?? (required ? 8 : ''));
  const [m, setM] = useState<number>(init?.m ?? 0);
  const [pm, setPm] = useState<boolean>(init?.pm ?? false);
  const minutes = [...new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, m])].sort((a, b) => a - b);
  const value = h === '' ? '' : `${pad((h % 12) + (pm ? 12 : 0))}:${pad(m)}`;
  return (
    <span className="tpick" role="group" aria-label={label}>
      <select id={id} value={h} onChange={(e) => setH(e.target.value === '' ? '' : Number(e.target.value))} aria-label="ሰዓት" required={required}>
        {!required && <option value="">--</option>}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <b aria-hidden>:</b>
      <select value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="ደቂቃ" disabled={h === ''}>
        {minutes.map((x) => <option key={x} value={x}>{pad(x)}</option>)}
      </select>
      <span className="tpick-ampm">
        <button type="button" className={!pm ? 'on' : ''} onClick={() => setPm(false)} disabled={h === ''}>AM</button>
        <button type="button" className={pm ? 'on' : ''} onClick={() => setPm(true)} disabled={h === ''}>PM</button>
      </span>
      <input type="hidden" name={name} value={value} />
    </span>
  );
}
