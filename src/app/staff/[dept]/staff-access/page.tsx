import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireDept } from '@/lib/auth';
import { DEPARTMENTS, DEPT_NAME } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { MultiSelect } from '@/components/multi-select';
import { ActionButton } from '@/components/action-button';
import { grantStaffAccess, revokeStaffAccess } from '@/lib/actions/staff-access';

type P = { user_id: string; username: string; full_name: string; is_admin: boolean; is_active: boolean; member_id: string | null; staff_departments: { dept: string }[] };
const DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d.code, label: d.name }));

/** ጽሕፈት ቤት: which members may open which department pages (they log in with their own number + PIN). */
export default async function StaffAccess({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  await requireDept('office');
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('staff_profiles')
    .select('user_id, username, full_name, is_admin, is_active, member_id, staff_departments(dept)').order('full_name');
  const staff = ((profiles ?? []) as P[]).filter((p) => p.is_active);

  let found: { id: string; full_name: string; reg_no: string; has_account: boolean }[] = [];
  if (q && q.trim().length >= 2) {
    const code = q.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let query = supabase.from('members').select('id, full_name, reg_no').eq('is_active', true).order('full_name').limit(15);
    query = /\d/.test(code) && code.length >= 3 ? query.ilike('reg_key', `%${code}%`) : query.ilike('full_name', `%${q.trim()}%`);
    const { data } = await query;
    // Office can't read member_accounts directly (education-only); the count is fetched server-side.
    const admin = createAdminClient();
    const ids = (data ?? []).map((m) => m.id);
    const { data: accts } = ids.length ? await admin.from('member_accounts').select('member_id').in('member_id', ids) : { data: [] };
    const has = new Set((accts ?? []).map((a) => a.member_id));
    found = (data ?? []).map((m) => ({ ...m, has_account: has.has(m.id) }));
  }
  const byMember = new Map(staff.filter((s) => s.member_id).map((s) => [s.member_id!, s]));

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የአመራሮች መግቢያ ፈቃድ</h2>
      <p className="muted small">
        ሁሉም ሰው በአንድ ገጽ በ<b>መለያ ቁጥሩ እና በ6 አሃዝ ፒኑ</b> ይገባል። እዚህ ፈቃድ የተሰጠው አባል ሲገባ የተሰጡትን ክፍሎች ገጾች ያያል።
        መምህራንን ትምህርት ክፍል በ“ኮርሶችና መምህራን” ይመድባል።
      </p>

      <form className="toolbar" action="/staff/office/staff-access">
        <div className="field"><label htmlFor="q">አባል ፈልግ (ስም ወይም መለያ ቁ.)</label><input id="q" name="q" defaultValue={q} /></div>
        <button className="btn sm">ፈልግ</button>
      </form>
      {found.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>አባል</th><th>ፒን</th><th>ክፍሎች</th></tr></thead>
            <tbody>
              {found.map((m) => (
                <tr key={m.id}>
                  <td>{m.full_name}<div className="small muted">{m.reg_no}</div></td>
                  <td>{m.has_account ? <span className="pill present">ፈጥሯል</span> : <span className="pill absent">ገና</span>}</td>
                  <td style={{ minWidth: 300 }}>
                    <MediaForm action={grantStaffAccess} submitLabel="ፈቃድ ስጥ" card={false} resetOnSuccess={false}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <MultiSelect name="depts" options={DEPT_OPTIONS} defaultValue={byMember.get(m.id)?.staff_departments.map((d) => d.dept) ?? []} placeholder="ክፍሎችን ይምረጡ" />
                    </MediaForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q && found.length === 0 && <p className="muted">አልተገኘም።</p>}

      <h3 className="section">ፈቃድ ያላቸው</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ስም</th><th>ክፍሎች</th><th>መግቢያ</th><th /></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.user_id}>
                <td>{s.full_name}</td>
                <td className="small">{s.is_admin ? 'ሁሉም (አስተዳዳሪ)' : s.staff_departments.map((d) => DEPT_NAME[d.dept]).join('፣ ') || '—'}</td>
                <td className="small">{s.member_id ? 'መለያ ቁ. + ፒን' : `የተጠቃሚ ስም (${s.username})`}</td>
                <td>{s.member_id && !s.is_admin && (
                  <ActionButton action={revokeStaffAccess.bind(null, s.user_id)} label="ፈቃድ አንሳ" className="btn sm danger" confirmText={`${s.full_name} ፈቃዱ ይነሳ?`} />
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">በተጠቃሚ ስም የሚገቡ የቀድሞ መለያዎች በሲስተም አስተዳዳሪው ይቀየራሉ።</p>
    </>
  );
}
