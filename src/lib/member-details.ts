// Repeatable rows on the member form (stored as jsonb arrays on members).
export type EducationEntry = {
  level: string; field: string; institution: string;
  start_year: number | null; end_year: number | null; current: boolean;
  evidence_path?: string | null;   // certificate / transcript file for this entry
  _k?: string;                     // client-only row key
};
export type WorkEntry = {
  field: string; workplace: string;
  start_year: number | null; end_year: number | null; current: boolean;
};

let seq = 0;
export const rowKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;
export const emptyEducation = (): EducationEntry => ({ level: '', field: '', institution: '', start_year: null, end_year: null, current: false, evidence_path: null, _k: rowKey() });
export const emptyWork = (): WorkEntry => ({ field: '', workplace: '', start_year: null, end_year: null, current: false });

const txt = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 120) : '');
const year = (v: unknown) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : null;
};
const parse = (raw: string | null): Record<string, unknown>[] => {
  try {
    const a = JSON.parse(raw ?? '[]');
    return Array.isArray(a) ? a.slice(0, 10).filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
};

/** Server-side clean-up of the hidden JSON field; empty rows are dropped. */
export function cleanEducation(raw: string | null): EducationEntry[] {
  return parse(raw).map((e) => ({
    level: txt(e.level), field: txt(e.field), institution: txt(e.institution),
    start_year: year(e.start_year), current: e.current === true,
    end_year: e.current === true ? null : year(e.end_year),
    evidence_path: typeof e.evidence_path === 'string' && /^(members|applications)\//.test(e.evidence_path) ? e.evidence_path : null,
  })).filter((e) => e.level || e.field || e.institution);
}
export function cleanWork(raw: string | null): WorkEntry[] {
  return parse(raw).map((e) => ({
    field: txt(e.field), workplace: txt(e.workplace),
    start_year: year(e.start_year), current: e.current === true,
    end_year: e.current === true ? null : year(e.end_year),
  })).filter((e) => e.field || e.workplace);
}

export const yearsLabel = (e: { start_year: number | null; end_year: number | null; current: boolean }) =>
  e.start_year || e.end_year || e.current
    ? `${e.start_year ?? '?'} – ${e.current ? 'አሁን' : (e.end_year ?? '?')} ዓ.ም`
    : '';
