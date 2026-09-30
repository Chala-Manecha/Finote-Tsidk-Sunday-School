import { WEEK_ORDER } from '@/lib/constants';
import { WEEKDAYS_AM } from '@/lib/ethiopian-calendar';

export function DayChecks({ name, selected = [] }: { name: string; selected?: number[] }) {
  return (
    <div className="check-grid">
      {WEEK_ORDER.map((d) => (
        <label key={d} className="check" style={{ margin: 0 }}>
          <input type="checkbox" name={name} value={d} defaultChecked={selected.includes(d)} /> {WEEKDAYS_AM[d]}
        </label>
      ))}
    </div>
  );
}

export const dayNames = (days: number[] | null | undefined) =>
  [...(days ?? [])].sort((a, b) => WEEK_ORDER.indexOf(a as never) - WEEK_ORDER.indexOf(b as never))
    .map((d) => WEEKDAYS_AM[d]).join('፣ ') || '—';
