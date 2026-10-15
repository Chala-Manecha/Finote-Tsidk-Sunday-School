import { WEEK_ORDER } from '@/lib/constants';
import { WEEKDAYS_AM } from '@/lib/ethiopian-calendar';
/** The week as seven toggle days (ሰኞ … እሑድ); ticked days are submitted under `name`. */
export function DayChecks({ name, selected = [] }: { name: string; selected?: number[] }) {
  const on = new Set(selected ?? []);
  return (
    <div className="week-pick" role="group" aria-label="ቀናት">
      {WEEK_ORDER.map((d) => (
        <label key={d} className={d === 0 || d === 6 ? 'we' : ''}>
          <input type="checkbox" name={name} value={d} defaultChecked={on.has(d)} />
          <span>{WEEKDAYS_AM[d]}</span>
        </label>
      ))}
    </div>
  );
}

export const dayNames = (days: number[] | null | undefined) =>
  [...(days ?? [])].sort((a, b) => WEEK_ORDER.indexOf(a as never) - WEEK_ORDER.indexOf(b as never))
    .map((d) => WEEKDAYS_AM[d]).join('፣ ') || '—';
