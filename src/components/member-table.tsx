import { createClient } from '@/lib/supabase/server';
import { ageFromIso } from '@/lib/ethiopian-calendar';
import {
  DEPT_NAME, MEMBER_STATUS, SEX, WORK_STATUS, TITLES, memberTypeLabel, MEMBER_TYPE,
} from '@/lib/constants';
import { FILTER_KEYS, type MemberFilters } from '@/lib/member-export';
import { loadMembers, photoUrls } from '@/lib/member-load';
import { MemberList, type ListRow } from './member-list';

/**
 * Member list used by: a department's የክፍሉ ንዑሳን (fixedDept),
 * HR's all-member view and ጽሕፈት ቤት's የአባላት ዝርዝር.
 */
export async function MemberTable({
  basePath, filters, fixedDept, linkToDetail,
}: {
  basePath: string;
  filters: MemberFilters & Record<string, string | undefined>;
  fixedDept?: string;
  linkToDetail: boolean;
}) {
  const supabase = await createClient();
  const [loaded, { data: groups }] = await Promise.all([
    loadMembers(supabase, { scope: 'filtered', filters, dept: fixedDept, limit: 3000 })
      .then((rows) => ({ rows, error: null as string | null }), (e: Error) => ({ rows: [], error: e.message })),
    supabase.from('age_groups').select('code, name').order('sort'),
  ]);
  const { rows, error } = loaded;
  const photos = await photoUrls(supabase, rows.map((r) => r.photo_path));
  const groupName = new Map((groups ?? []).map((g) => [g.code as string, g.name as string]));
  const list: ListRow[] = rows.map((m) => ({
    id: m.id, regNo: m.reg_no, photo: m.photo_path ? photos.get(m.photo_path) ?? null : null,
    name: `${m.title ? `${TITLES[m.title as keyof typeof TITLES]} ` : ''}${m.full_name}`,
    sex: SEX[m.sex], age: ageFromIso(m.dob), group: m.age_group ? groupName.get(m.age_group) ?? '' : '',
    phone: (m.phone as string | null) ?? '', work: WORK_STATUS[m.work_status as keyof typeof WORK_STATUS] ?? '',
    type: memberTypeLabel(m.member_type as string, m.member_type_other as string | null),
    status: m.member_status as string, statusLabel: MEMBER_STATUS[m.member_status as keyof typeof MEMBER_STATUS] ?? '',
    depts: m.depts.map((d) => DEPT_NAME[d]).join('፣ '),
  }));
  const active = Object.fromEntries(FILTER_KEYS.filter((k) => filters[k]).map((k) => [k, filters[k] as string]));

  return (
    <>
      <form className="toolbar no-print member-filters" action={basePath}>
        <div className="field grow">
          <label htmlFor="q">ፈልግ</label>
          <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="🔍 በስም ወይም በመለያ ቁጥር…" />
        </div>
        <div className="field">
          <label htmlFor="status">ሁኔታ</label>
          <select id="status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">ሁሉም</option>
            {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="group">የዕድሜ ክፍል</label>
          <select id="group" name="group" defaultValue={filters.group ?? ''}>
            <option value="">ሁሉም</option>
            {(groups ?? []).map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
            <option value="none">ያልተመደቡ</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="type">የአባልነት ሁኔታ</label>
          <select id="type" name="type" defaultValue={filters.type ?? ''}>
            <option value="">ሁሉም</option>
            {Object.entries(MEMBER_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="work">የስራ ሁኔታ</label>
          <select id="work" name="work" defaultValue={filters.work ?? ''}>
            <option value="">ሁሉም</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <label className="check" style={{ margin: 0, alignSelf: 'center' }}>
          <input type="checkbox" name="inactive" value="1" defaultChecked={filters.inactive === '1'} /> የተሰረዙ ብቻ
        </label>
        <button className="btn sm">አጣራ</button>
        {Object.keys(active).length > 0 && <a className="link small" href={basePath}>አጽዳ</a>}
      </form>

      {error && <div className="alert error">{error}</div>}
      <MemberList rows={list} linkToDetail={linkToDetail} dept={fixedDept ?? ''} filters={active} />
    </>
  );
}
