import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, SEX } from '@/lib/constants';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveAssignee, deleteAssignee } from '@/lib/actions/office';

type A = { dept: string; full_name: string; sex: 'male' | 'female'; photo_path: string | null; user_id: string | null };

export default async function OfficeAssignees({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const [{ data: rows }, { data: staff }] = await Promise.all([
    supabase.from('dept_assignees').select('dept, full_name, sex, photo_path, user_id'),
    supabase.from('staff_profiles').select('user_id, username, full_name').eq('is_active', true).order('full_name'),
  ]);
  const byDept = new Map(((rows ?? []) as A[]).map((r) => [r.dept, r]));

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ክፍል ኃላፊዎች</h2>
      <p className="muted small">
        ኃላፊው ከሠራተኛ መለያ ጋር ሲያያዝ፣ ያ ሰው ሲገባ በክፍሉ ገጽ ላይ ፎቶው እና &quot;ውድ … እንኳን በሰላም መጣህ/ሽ&quot; ይታያል።
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ክፍል</th><th>ፎቶ</th><th>ኃላፊ</th><th>ፆታ</th><th></th></tr></thead>
          <tbody>
            {DEPARTMENTS.map((d) => {
              const a = byDept.get(d.code);
              const photo = mediaUrl(supabase, a?.photo_path);
              return (
                <tr key={d.code}>
                  <td>{d.name}</td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td>{photo ? <img src={photo} alt="" className="avatar" /> : '—'}</td>
                  <td>{a?.full_name ?? <span className="muted">አልተመደበም</span>}</td>
                  <td>{a ? SEX[a.sex] : ''}</td>
                  <td>
                    <div className="btn-row">
                      <details>
                        <summary className="btn sm secondary">{a ? 'አርም' : '+ መድብ'}</summary>
                        <div style={{ marginTop: 8, minWidth: 300 }}>
                          <MediaForm action={saveAssignee} fileField="photo" folder="assignees" resize submitLabel="አስቀምጥ" resetOnSuccess={false}>
                            <input type="hidden" name="dept" value={d.code} />
                            <div className="field">
                              <label>ሙሉ ስም</label>
                              <input name="full_name" required defaultValue={a?.full_name} />
                            </div>
                            <div className="field">
                              <label>ፆታ</label>
                              <select name="sex" required defaultValue={a?.sex ?? ''}>
                                <option value="" disabled>ይምረጡ</option>
                                {Object.entries(SEX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </div>
                            <div className="field">
                              <label>የሠራተኛ መለያ (አማራጭ)</label>
                              <select name="user_id" defaultValue={a?.user_id ?? ''}>
                                <option value="">—</option>
                                {(staff ?? []).map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.username})</option>)}
                              </select>
                            </div>
                            <div className="field">
                              <label>ፎቶ</label>
                              <input name="photo" type="file" accept="image/*" />
                            </div>
                          </MediaForm>
                        </div>
                      </details>
                      {a && (
                        <ActionButton action={deleteAssignee.bind(null, d.code)} label="አስወግድ" className="btn sm danger"
                          confirmText={`የ${d.name} ኃላፊን ማስወገድ ይፈልጋሉ?`} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
