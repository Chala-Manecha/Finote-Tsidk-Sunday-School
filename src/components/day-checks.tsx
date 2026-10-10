import { WEEK_ORDER } from '@/lib/constants';
import { WEEKDAYS_AM } from '@/lib/ethiopian-calendar';
import { MultiSelect } from './multi-select';

const DAY_OPTIONS = WEEK_ORDER.map((d) => ({ value: String(d), label: WEEKDAYS_AM[d] }));

/** Days of the week as a drop-down of check boxes (values submitted under `name`). */
export function DayChecks({ name, selected = [] }: { name: string; selected?: number[] }) {
  return <MultiSelect name={name} options={DAY_OPTIONS} defaultValue={(selected ?? []).map(String)} placeholder="ቀን(ናት) ይምረጡ" />;
}

export const dayNames = (days: number[] | null | undefined) =>
  [...(days ?? [])].sort((a, b) => WEEK_ORDER.indexOf(a as never) - WEEK_ORDER.indexOf(b as never))
    .map((d) => WEEKDAYS_AM[d]).join('፣ ') || '—';
