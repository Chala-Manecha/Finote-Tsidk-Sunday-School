import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classLabel } from './education';

export type AbsItem = { date: string; label: string; note?: string | null };
export type AbsGroup = { memberId: string; name: string; regNo: string; count: number; half: number; items: AbsItem[] };

const PAGE = 1000;
async function all<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

function group(rows: { id: string; name: string; reg: string; half: boolean; item: AbsItem }[]): AbsGroup[] {
  const map = new Map<string, AbsGroup>();
  for (const r of rows) {
    const g = map.get(r.id) ?? { memberId: r.id, name: r.name, regNo: r.reg, count: 0, half: 0, items: [] };
    if (r.half) g.half += 1; else g.count += 1;
    g.items.push(r.half ? { ...r.item, label: `${r.item.label} (ግማሽ)` } : r.item);
    map.set(r.id, g);
  }
  for (const g of map.values()) g.items.sort((a, b) => b.date.localeCompare(a.date));
  return [...map.values()].sort((a, b) => b.count - a.count || b.half - a.half || a.name.localeCompare(b.name));
}

type M = { full_name: string; reg_no: string } | null;

/** Meeting / መዝሙር / ወረብ (the department attendance sheets). */
export async function generalAbsences(supabase: SupabaseClient, types: string[], from: string, to: string, labels: Record<string, string>) {
  type R = { member_id: string; status: string; members: M; attendance_sessions: { session_type: string; session_date: string; title: string | null } };
  const rows = await all<R>((a, b) => supabase.from('attendance')
    .select('member_id, status, members(full_name, reg_no), attendance_sessions!inner(session_type, session_date, title)')
    .in('status', ['absent', 'half']).in('attendance_sessions.session_type', types)
    .gte('attendance_sessions.session_date', from).lte('attendance_sessions.session_date', to)
    .range(a, b) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>);
  return group(rows.map((r) => ({
    id: r.member_id, name: r.members?.full_name ?? '—', reg: r.members?.reg_no ?? '', half: r.status === 'half',
    item: { date: r.attendance_sessions.session_date, label: r.attendance_sessions.title ? `${r.attendance_sessions.title} (${labels[r.attendance_sessions.session_type] ?? ''})` : labels[r.attendance_sessions.session_type] ?? r.attendance_sessions.session_type },
  })));
}

/** Students absent from course classes (taken by the teachers). Optional semester / class. */
export async function classAbsences(supabase: SupabaseClient, opts: { from?: string; to?: string; semesterId?: string; cls?: string }) {
  type R = { member_id: string; status: string; members: M; class_sessions: { session_date: string; course_offerings: { name: string; class_level: string; semester_id: string } } };
  const rows = await all<R>((a, b) => {
    let q = supabase.from('class_attendance')
      .select('member_id, status, members(full_name, reg_no), class_sessions!inner(session_date, course_offerings!inner(name, class_level, semester_id))')
      .in('status', ['absent', 'half']);
    if (opts.from) q = q.gte('class_sessions.session_date', opts.from);
    if (opts.to) q = q.lte('class_sessions.session_date', opts.to);
    if (opts.semesterId) q = q.eq('class_sessions.course_offerings.semester_id', opts.semesterId);
    if (opts.cls) q = q.eq('class_sessions.course_offerings.class_level', opts.cls);
    return q.range(a, b) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>;
  });
  return group(rows.map((r) => ({
    id: r.member_id, name: r.members?.full_name ?? '—', reg: r.members?.reg_no ?? '', half: r.status === 'half',
    item: { date: r.class_sessions.session_date, label: `${r.class_sessions.course_offerings.name} · ${classLabel(r.class_sessions.course_offerings.class_level)}` },
  })));
}

/** Teachers recorded ቀሪ (or አርፍዷል, shown as half) by ትምህርት ክፍል. */
export async function teacherAbsences(supabase: SupabaseClient, opts: { from?: string; to?: string; semesterId?: string }) {
  type R = { member_id: string; status: string; att_date: string; note: string | null; members: M; course_offerings: { name: string; class_level: string; semester_id: string } };
  const rows = await all<R>((a, b) => {
    let q = supabase.from('teacher_attendance')
      .select('member_id, status, att_date, note, members(full_name, reg_no), course_offerings!inner(name, class_level, semester_id)')
      .in('status', ['absent', 'late']);
    if (opts.from) q = q.gte('att_date', opts.from);
    if (opts.to) q = q.lte('att_date', opts.to);
    if (opts.semesterId) q = q.eq('course_offerings.semester_id', opts.semesterId);
    return q.range(a, b) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>;
  });
  return group(rows.map((r) => ({
    id: r.member_id, name: r.members?.full_name ?? '—', reg: r.members?.reg_no ?? '', half: r.status === 'late',
    item: { date: r.att_date, label: `${r.course_offerings.name} · ${classLabel(r.course_offerings.class_level)}${r.status === 'late' ? ' — አርፍዷል' : ''}`, note: r.note },
  }))).map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, label: i.label.replace(' (ግማሽ)', '') })) }));
}
