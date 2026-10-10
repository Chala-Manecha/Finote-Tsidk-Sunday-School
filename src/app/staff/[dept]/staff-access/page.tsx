import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDept } from '@/lib/auth';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { grantAdmin, revokeAdmin } from '@/lib/actions/staff-access';

/** የሲስተሙ አስተዳዳሪዎች: who can see and manage every department. */
export default async function SystemAdmins({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const staff = await requireDept('office');
  const supabase = await createClient();
  const [{ data: admins }, { data: members }] = await Promise.all([
    supabase.from('staff_profiles').select('user_id, full_name, username, member_id').eq('is_admin', true).eq('is_active', true).order('full_name'),
    staff.isAdmin ? supabase.from('members').select('full_name, reg_no').eq('is_active', true).order('full_name') : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የሲስተሙ አስተዳዳሪዎች</h2>
      <p className="muted small">
        ሁሉም ሰው በመለያ ቁጥሩና በመግቢያ ኮዱ ይገባል። የክፍል ኃላፊዎች ክፍላቸውን የሚያገኙት በ“ክፍል ኃላፊዎች” ነው።
        እዚህ የሚጨመሩት ሁሉንም ክፍሎች የሚያዩና የሚያስተዳድሩ የሲስተሙ አስተዳዳሪዎች ብቻ ናቸው።
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ስም</th><th>መግቢያ</th><th /></tr></thead>
          <tbody>
            {(admins ?? []).map((a) => (
              <tr key={a.user_id}>
                <td>{a.full_name}</td>
                <td className="small">{a.member_id ? 'መለያ ቁጥር + ኮድ' : `የተጠቃሚ ስም (${a.username})`}</td>
                <td>{staff.isAdmin && a.user_id !== staff.userId && (
                  <ActionButton action={revokeAdmin.bind(null, a.user_id)} label="አስወግድ" className="btn sm danger" confirmText={`${a.full_name} ከአስተዳዳሪነት ይነሱ?`} />
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {staff.isAdmin ? (
        <div style={{ marginTop: 14 }}>
          <datalist id="admin-member-names">{(members ?? []).map((m) => <option key={m.reg_no} value={m.full_name}>{m.reg_no}</option>)}</datalist>
          <MediaForm action={grantAdmin} submitLabel="+ አስተዳዳሪ ጨምር">
            <div className="field" style={{ maxWidth: 420 }}>
              <label>የአባሉ ሙሉ ስም</label>
              <input name="full_name" list="admin-member-names" required autoComplete="off" />
            </div>
          </MediaForm>
        </div>
      ) : <p className="small muted">አስተዳዳሪ መጨመር ወይም ማስወገድ የሚችለው የሲስተሙ አስተዳዳሪ ብቻ ነው።</p>}
    </>
  );
}
