import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME } from '@/lib/constants';
import { CreateAccountForm, EditAccountForm } from './forms';

type Profile = {
  user_id: string; username: string; full_name: string; is_admin: boolean; is_active: boolean;
  staff_departments: { dept: string }[];
};

export default async function AccountsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('user_id, username, full_name, is_admin, is_active, staff_departments(dept)')
    .order('username')
    .returns<Profile[]>();

  return (
    <>
      <h1 className="title">የሠራተኞች መለያዎች</h1>
      <p className="muted small">
        ሠራተኞች በተጠቃሚ ስም እና የይለፍ ቃል ይገባሉ። የይለፍ ቃል ሲረሱ እዚህ አዲስ ያስቀምጡላቸው።
      </p>
      <h2 className="section">አዲስ መለያ</h2>
      <CreateAccountForm />

      <h2 className="section">ያሉ መለያዎች ({staff?.length ?? 0})</h2>
      {(staff ?? []).map((s) => (
        <details key={s.user_id} className="card" style={{ marginBottom: 10 }}>
          <summary style={{ cursor: 'pointer' }}>
            <b dir="ltr">{s.username}</b> — {s.full_name}
            {s.is_admin && <span className="pill" style={{ marginInlineStart: 8 }}>አስተዳዳሪ</span>}
            {!s.is_active && <span className="pill absent" style={{ marginInlineStart: 8 }}>ታግዷል</span>}
            <span className="muted small" style={{ marginInlineStart: 8 }}>
              {s.staff_departments.map((d) => DEPT_NAME[d.dept]).join('፣ ')}
            </span>
          </summary>
          <div style={{ marginTop: 12 }}>
            <EditAccountForm
              userId={s.user_id}
              depts={s.staff_departments.map((d) => d.dept)}
              isAdmin={s.is_admin}
              isActive={s.is_active}
            />
          </div>
        </details>
      ))}
    </>
  );
}
