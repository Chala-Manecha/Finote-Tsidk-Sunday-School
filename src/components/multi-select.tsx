'use client';
import { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };

/** Field that looks like a text input and opens a list of check boxes (values submitted under `name`). */
export function MultiSelect({
  name, options, defaultValue = [], max, placeholder = 'ይምረጡ', id,
}: {
  name: string;
  options: readonly Option[];
  defaultValue?: string[];
  max?: number;
  placeholder?: string;
  id?: string;
}) {
  const [picked, setPicked] = useState<string[]>(defaultValue.filter((v) => options.some((o) => o.value === v)));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string, on: boolean) => setPicked(on ? [...picked, v] : picked.filter((x) => x !== v));

  return (
    <div className={`multi-select ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" id={id} className="multi-select-box" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={picked.length ? '' : 'muted'}>{picked.length ? picked.map(label).join('፣ ') : placeholder}</span>
        <span aria-hidden className="caret">▾</span>
      </button>
      {open && (
        <div className="multi-select-list">
          {max && <div className="small muted" style={{ padding: '2px 8px 6px' }}>ቢበዛ {max} ({picked.length}/{max})</div>}
          {options.map((o) => {
            const on = picked.includes(o.value);
            return (
              <label key={o.value} className="check" style={{ margin: 0 }}>
                <input type="checkbox" checked={on} disabled={!on && !!max && picked.length >= max} onChange={(e) => toggle(o.value, e.target.checked)} />
                {o.label}
              </label>
            );
          })}
        </div>
      )}
      {picked.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
    </div>
  );
}
