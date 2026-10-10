import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ageFromIso } from '@/lib/ethiopian-calendar';
import {
  DEPT_NAME, MEMBER_STATUS, SEX, WORK_STATUS, TITLES, memberTypeLabel,
} from '@/lib/constants';
import { PrintButton } from './print-button';

type Filters = { q?: string; status?: string; work?: string; dept?: string; group?: string; inactive?: string };

type Row = {
  id: string;
  reg_no: string;
  full_name: string;
  title: keyof typeof TITLES | null;
  sex: keyof typeof SEX;
  dob: string | null;
  phone: string | null;
  work_status: keyof typeof WORK_STATUS;
  member_status: keyof typeof MEMBER_STATUS;
  member_type: string;
  member_type_other: string | null;
  age_group: string | null;
  all_depts: { dept: string }[];
};

/**
 * Member list used by: a department's የክፍሉ ንዑሳን (fixedDept),
 * HR's all-member view and ጽሕፈት ቤት's የአባላት ዝርዝር (filterable dept).
 */
export async function MemberTable({
  basePath,
  filters,
  fixedDept,
  linkToDetail,
}: {
  basePath: string;
  filters: Filters;
  fixedDept?: string;
  linkToDetail: boolean;
}) {
  const supabase = await createClient();
  const dept = fixedDept;

  let query = supabase
    .from('members')
    .select(
      dept
        ? 'id, reg_no, full_name, title, sex, dob, phone, work_status, member_status, member_type, member_type_other, age_group, all_depts:member_departments(dept), f:member_departments!inner(dept)'
        : 'id, reg_no, full_name, title, sex, dob, phone, work_status, member_status, member_type, member_type_other, age_group, all_depts:member_departments(dept)',
    )
    .eq('is_active', filters.inactive !== '1')
    .order('full_name');

  if (dept) query = query.eq('f.dept', dept);
  if (filters.q) {
    // A registration code (letters+digits, e.g. 7K3M or ፍጽ-7K3M-Q9XD) → search reg_key; otherwise the name.
    const code = filters.q.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    query = /\d/.test(code) && code.length >= 3 ? query.ilike('reg_key', `%${code}%`) : query.ilike('full_name', `%${filters.q}%`);
  }
  if (filters.status) query = query.eq('member_status', filters.status);
  if (filters.work) query = query.eq('work_status', filters.work);
  if (filters.group) query = filters.group === 'none' ? query.is('age_group', null) : query.eq('age_group', filters.group);

  const [{ data, error }, { data: groups }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.from('age_groups').select('code, name').order('sort'),
  ]);
  const groupName = new Map((groups ?? []).map((g) => [g.code as string, g.name as string]));

  return (
    <>
      <form className="toolbar no-print" action={basePath}>
        <div className="field">
          <label htmlFor="q">ስም / መለያ ቁ.</label>
          <input id="q" name="q" defaultValue={filters.q} placeholder="ስም ወይም መለያ ቁጥር" />
        </div>
        <div className="field">
          <label htmlFor="status">ሁኔታ</label>
          <select id="status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">ሁሉም</option>
            {Object.entries(MEMBER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="group">ክፍል (በዕድሜ)</label>
          <select id="group" name="group" defaultValue={filters.group ?? ''}>
            <option value="">ሁሉም</option>
            {(groups ?? []).map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
            <option value="none">ያልተመደቡ (የትውልድ ቀን የሌላቸው)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="work">የስራ ሁኔታ</label>
          <select id="work" name="work" defaultValue={filters.work ?? ''}>
            <option value="">ሁሉም</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <label className="check" style={{ margin: 0, alignSelf: 'center' }}>
          <input type="checkbox" name="inactive" value="1" defaultChecked={filters.inactive === '1'} /> የተሰረዙ (ያልነቁ) ብቻ
        </label>
        <button className="btn sm">አጣራ</button>
        <span style={{ flex: 1 }} />
        <PrintButton />
      </form>

      {error && <div className="alert error">{error.message}</div>}
      <p className="muted small">{data?.length ?? 0} አባላት</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>መለያ ቁ.</th>
              <th>ሙሉ ስም</th>
              <th>ፆታ</th>
              <th>ዕድሜ</th>
              <th>ክፍል</th>
              <th>ስልክ</th>
              <th>የስራ ሁኔታ</th>
              <th>የአባልነት ሁኔታ</th>
              <th>ሁኔታ</th>
              <th>የመረጡት ክፍል</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((m, i) => (
              <tr key={m.id}>
                <td className="small" title={String(i + 1)}>{m.reg_no}</td>
                <td>
                  {m.title ? `${TITLES[m.title]} ` : ''}
                  {linkToDetail ? (
                    <Link className="link" href={`/staff/members/${m.id}`}>{m.full_name}</Link>
                  ) : (
                    m.full_name
                  )}
                </td>
                <td>{SEX[m.sex]}</td>
                <td>{ageFromIso(m.dob) ?? '—'}</td>
                <td className="small">{m.age_group ? groupName.get(m.age_group) ?? '—' : '—'}</td>
                <td dir="ltr">{m.phone ?? '—'}</td>
                <td>{WORK_STATUS[m.work_status]}</td>
                <td>{memberTypeLabel(m.member_type, m.member_type_other)}</td>
                <td>{MEMBER_STATUS[m.member_status]}</td>
                <td className="small">{m.all_depts.map((d) => DEPT_NAME[d.dept]).join('፣ ') || '—'}</td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={10} className="muted">ምንም አባል አልተገኘም።</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
