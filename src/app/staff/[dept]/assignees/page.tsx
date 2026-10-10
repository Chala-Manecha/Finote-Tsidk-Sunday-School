import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, SEX } from '@/lib/constants';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveAssignee, deleteAssignee } from '@/lib/actions/office';

type A = { dept: string; full_name: string; sex: 'male' | 'female'; member_id: string | null };

/** ጽሕፈት ቤት: each department's head is a registered member; they open the department with their own login. */
export default async function OfficeAssignees({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase.from('dept_assignees').select('dept, full_name, sex, member_id'),
    supabase.from('members').select('full_name, reg_no').eq('is_active', true).order('full_name'),
  ]);
  const byDept = new Map(((rows ?? []) as A[]).map((r) => [r.dept, r]));

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ክፍል ኃላፊዎች</h2>
      <p className="muted small">
        ኃላፊው የተመዘገበ አባል መሆን አለበት — ሙሉ ስሙን ይጻፉ (ከዝርዝሩ ይምረጡ)። ፎቶው ከምዝገባው ይወሰዳል።
        ኃላፊው በራሱ መለያ ቁጥርና መግቢያ ኮድ ሲገባ የክፍሉን ገጽ ያያል — የተለየ ፈቃድ አያስፈልግም።
      </p>
      <datalist id="member-names">
        {(members ?? []).map((m) => <option key={m.reg_no} value={m.full_name}>{m.reg_no}</option>)}
      </datalist>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ክፍል</th><th>ኃላፊ</th><th>ፆታ</th><th></th></tr></thead>
          <tbody>
            {DEPARTMENTS.map((d) => {
              const a = byDept.get(d.code);
              return (
                <tr key={d.code}>
                  <td>{d.name}</td>
                  <td>
                    {a?.full_name ?? <span className="muted">አልተመደበም</span>}
                    {a && !a.member_id && <div className="small neg">ከአባላት ዝርዝር ጋር አልተያያዘም — እንደገና ይመድቡ</div>}
                  </td>
                  <td>{a ? SEX[a.sex] : ''}</td>
                  <td>
                    <div className="btn-row">
                      <details>
                        <summary className="btn sm secondary">{a ? 'ቀይር' : '+ መድብ'}</summary>
                        <div style={{ marginTop: 8, minWidth: 300 }}>
                          <MediaForm action={saveAssignee} submitLabel="አስቀምጥ" resetOnSuccess={false}>
                            <input type="hidden" name="dept" value={d.code} />
                            <div className="field">
                              <label>ሙሉ ስም</label>
                              <input name="full_name" list="member-names" required autoComplete="off" defaultValue={a?.member_id ? a.full_name : ''} placeholder="የአባሉን ሙሉ ስም ይጻፉ" />
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
