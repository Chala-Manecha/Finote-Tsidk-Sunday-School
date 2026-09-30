'use client';
import { useMemo, useState } from 'react';
import {
  EC_MONTHS, daysInEcMonth, ecToIso, isoToEc, todayEc,
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

/** Ethiopian-calendar date input: ቀን / ወር / ዓ.ም dropdowns → hidden ISO value. */
export function EcDatePicker({
  name, id, defaultIso, yearsBack = 5, yearsForward = 2, required, onChange,
}: Props) {
  const init = defaultIso ? isoToEc(defaultIso) : null;
  const [day, setDay] = useState<number | ''>(init?.day ?? '');
  const [month, setMonth] = useState<number | ''>(init?.month ?? '');
  const [year, setYear] = useState<number | ''>(init?.year ?? '');

  const thisYear = todayEc().year;
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = thisYear + yearsForward; y >= thisYear - yearsBack; y--) ys.push(y);
    return ys;
  }, [thisYear, yearsBack, yearsForward]);

  const maxDay = month ? daysInEcMonth(year || thisYear, month) : 30;
  const safeDay = day && day > maxDay ? '' : day;
  const iso = safeDay && month && year ? ecToIso({ year, month, day: safeDay }) : '';

  const update = (d: number | '', m: number | '', y: number | '') => {
    setDay(d); setMonth(m); setYear(y);
    const max = m ? daysInEcMonth(y || thisYear, m) : 30;
    const dd = d && d > max ? '' : d;
    onChange?.(dd && m && y ? ecToIso({ year: y, month: m, day: dd }) : null);
  };

  const num = (v: string) => (v ? Number(v) : '') as number | '';

  return (
    <div className="ec-picker">
      <select id={id} aria-label="ቀን" value={safeDay} required={required}
        onChange={(e) => update(num(e.target.value), month, year)}>
        <option value="">ቀን</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select aria-label="ወር" value={month} required={required}
        onChange={(e) => update(day, num(e.target.value), year)}>
        <option value="">ወር</option>
        {EC_MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select aria-label="ዓ.ም" value={year} required={required}
        onChange={(e) => update(day, month, num(e.target.value))}>
        <option value="">ዓ.ም</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}
