'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EC_MONTHS, WEEKDAYS_AM, daysInEcMonth, ecToIso, formatEc, isoToEc, todayEc, todayIsoAddis, weekdayOf,
} from '@/lib/ethiopian-calendar';

type Props = {
  /** Name of the hidden input that carries the Gregorian ISO date */
  name: string;
  id?: string;
  defaultIso?: string | null;
  /** Years back from today to offer (birth dates use ~100) */
  yearsBack?: number;
  yearsForward?: number;
  required?: boolean;
  onChange?: (iso: string | null) => void;
};

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // ሰኞ … እሑድ

/**
 * Ethiopian-calendar date input: a field that opens a month calendar (month / year jump, ዛሬ, አጽዳ).
 * Submits the Gregorian ISO date in a hidden input called `name`.
 */
export function EcDatePicker({
  name, id, defaultIso, yearsBack = 5, yearsForward = 2, required, onChange,
}: Props) {
  const [iso, setIso] = useState<string>(defaultIso ?? '');
  const today = todayEc();
  const start = iso ? isoToEc(iso) : today;
  const [view, setView] = useState({ year: start.year, month: start.month });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = today.year + yearsForward; y >= today.year - yearsBack; y--) ys.push(y);
    return ys;
  }, [today.year, yearsBack, yearsForward]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (v: string) => { setIso(v); onChange?.(v || null); setOpen(false); };
  const move = (n: number) => setView((v) => {
    let m = v.month + n, y = v.year;
    if (m < 1) { m = 13; y -= 1; }
    if (m > 13) { m = 1; y += 1; }
    return { year: y, month: m };
  });

  const days = daysInEcMonth(view.year, view.month);
  const lead = WEEK.indexOf(weekdayOf(ecToIso({ year: view.year, month: view.month, day: 1 })));
  const todayIso = todayIsoAddis();

  return (
    <div className="ecal" ref={box}>
      <button type="button" id={id} className={`ecal-field ${iso ? '' : 'empty'}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <span aria-hidden>📅</span>
        <span>{iso ? formatEc(iso, { weekday: true }) : 'ቀን ይምረጡ'}</span>
      </button>
      {/* carries the value; the second input lets the browser stop a required, empty date */}
      <input type="hidden" name={name} value={iso} />
      {required && <input className="ecal-req" tabIndex={-1} aria-hidden required value={iso} onChange={() => {}} />}
      {open && (
        <div className="ecal-pop" role="dialog" aria-label="ቀን ምረጥ">
          <div className="ecal-head">
            <button type="button" onClick={() => move(-1)} aria-label="ያለፈው ወር">‹</button>
            <select value={view.month} onChange={(e) => setView({ ...view, month: Number(e.target.value) })} aria-label="ወር">
              {EC_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={view.year} onChange={(e) => setView({ ...view, year: Number(e.target.value) })} aria-label="ዓ.ም">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" onClick={() => move(1)} aria-label="የሚቀጥለው ወር">›</button>
          </div>
          <div className="ecal-grid">
            {WEEK.map((d) => <span key={d} className="ecal-wd">{WEEKDAYS_AM[d].slice(0, 2)}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const d = ecToIso({ year: view.year, month: view.month, day: i + 1 });
              return (
                <button type="button" key={d} onClick={() => pick(d)}
                  className={`${d === iso ? 'on' : ''} ${d === todayIso ? 'today' : ''}`}>{i + 1}</button>
              );
            })}
          </div>
          <div className="ecal-foot">
            <button type="button" className="link small" onClick={() => { setView({ year: today.year, month: today.month }); pick(todayIso); }}>ዛሬ</button>
            {!required && iso && <button type="button" className="link small" onClick={() => pick('')}>አጽዳ</button>}
          </div>
        </div>
      )}
    </div>
  );
}
