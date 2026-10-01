import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AcademicYear, Semester } from '@/lib/education';

/** Years (newest first) with their semesters; picks the requested or active semester. */
export async function loadTerms(supabase: SupabaseClient, semesterId?: string) {
  const [{ data: y }, { data: s }] = await Promise.all([
    supabase.from('academic_years').select('id, ec_year, is_active').order('ec_year', { ascending: false }),
    supabase.from('semesters').select('*').order('no'),
  ]);
  const years = (y ?? []) as AcademicYear[];
  const semesters = (s ?? []) as Semester[];
  const semester = semesters.find((x) => x.id === semesterId)
    ?? semesters.find((x) => x.is_active)
    ?? semesters.find((x) => x.year_id === years.find((yy) => yy.is_active)?.id)
    ?? semesters[0];
  const year = semester ? years.find((x) => x.id === semester.year_id) : years.find((x) => x.is_active) ?? years[0];
  return { years, semesters, semester, year };
}
