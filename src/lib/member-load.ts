import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MEMBER_COLS, applyMemberFilters, type MemberFilters, type MemberRow } from './member-export';

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Members for the list, the export and the ID cards (RLS decides what the signed-in staff may see).
 * scope 'all' ignores the search filters, 'selected' uses `ids`; `dept` limits to one department's members.
 */
export async function loadMembers(supabase: SupabaseClient, opts: {
  scope: 'all' | 'filtered' | 'selected'; filters: MemberFilters; dept?: string; ids?: string[]; limit?: number;
}): Promise<MemberRow[]> {
  const out: MemberRow[] = [];
  const page = 1000;
  const max = opts.limit ?? 20000;
  const ids = (opts.ids ?? []).filter((x) => UUID_RE.test(x));
  if (opts.scope === 'selected' && ids.length === 0) return [];
  for (let from = 0; from < max; from += page) {
    const sel: string = `${MEMBER_COLS}, all_depts:member_departments(dept)${opts.dept ? ', f:member_departments!inner(dept)' : ''}`;
    let q = supabase.from('members').select(sel)
      .order('full_name').range(from, Math.min(from + page, max) - 1);
    if (opts.dept) q = q.eq('f.dept', opts.dept);
    if (opts.scope === 'selected') q = q.in('id', ids);
    else if (opts.scope === 'filtered') q = applyMemberFilters(q, opts.filters);
    else q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as (Record<string, unknown> & { all_depts: { dept: string }[] })[];
    for (const r of rows) out.push({ ...r, depts: r.all_depts.map((d) => d.dept) } as unknown as MemberRow);
    if (rows.length < page) break;
  }
  return out;
}

/** Signed URLs (1 hour) for member photos, keyed by storage path. */
export async function photoUrls(supabase: SupabaseClient, paths: (string | null)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  for (let i = 0; i < list.length; i += 100) {
    const { data } = await supabase.storage.from('member-docs').createSignedUrls(list.slice(i, i + 100), 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  }
  return map;
}

export function filtersFrom(sp: Record<string, string | string[] | undefined>): MemberFilters {
  const g = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  return { q: g('q'), status: g('status'), work: g('work'), group: g('group'), type: g('type'), inactive: g('inactive') };
}
