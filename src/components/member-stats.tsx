import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MEMBER_TYPE } from '@/lib/constants';

/** ጽሕፈት ቤት dashboard: active members by የአባልነት ሁኔታ and by የዕድሜ ክፍል (each card filters the list). */
export async function MemberStats({ basePath }: { basePath: string }) {
  const supabase = await createClient();
  const base = () => supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { data: groups } = await supabase.from('age_groups').select('code, name, min_age, max_age').order('sort');
  const types = Object.keys(MEMBER_TYPE) as (keyof typeof MEMBER_TYPE)[];
  const [total, ...rest] = await Promise.all([
    base().then((r) => r.count ?? 0),
    ...types.map((t) => base().eq('member_type', t).then((r) => r.count ?? 0)),
    ...(groups ?? []).map((g) => base().eq('age_group', g.code).then((r) => r.count ?? 0)),
    base().is('age_group', null).then((r) => r.count ?? 0),
  ]);
  const typeCounts = rest.slice(0, types.length);
  const groupCounts = rest.slice(types.length, types.length + (groups ?? []).length);
  const noGroup = rest[rest.length - 1];
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '');

  return (
    <div className="member-stats chips no-print">
      <Link className="stat-card total" href={basePath}><b>{total}</b>ንቁ አባላት</Link>
      <span className="chip-sep" aria-hidden />
      {types.map((t, i) => (
        <Link key={t} className="stat-card" href={`${basePath}?type=${t}`} title={pct(typeCounts[i])}><b>{typeCounts[i]}</b>{MEMBER_TYPE[t]}</Link>
      ))}
      <span className="chip-sep" aria-hidden />
      {(groups ?? []).map((g, i) => (
        <Link key={g.code} className="stat-card" href={`${basePath}?group=${g.code}`} title={`${g.max_age == null ? `${g.min_age}+` : `${g.min_age}–${g.max_age}`} ዓመት · ${pct(groupCounts[i])}`}>
          <b>{groupCounts[i]}</b>{g.name}
        </Link>
      ))}
      {noGroup > 0 && <Link className="stat-card" href={`${basePath}?group=none`} title="የትውልድ ቀን የሌላቸው"><b>{noGroup}</b>ያልተመደቡ</Link>}
    </div>
  );
}
