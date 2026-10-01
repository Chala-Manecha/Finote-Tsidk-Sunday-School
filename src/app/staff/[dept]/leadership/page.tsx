import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, LEADER_ROLE, LEADER_ROLES, type LeaderRole } from '@/lib/constants';
import { termLabel, type Term } from '@/lib/periods';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveLeaderRole, deleteLeaderRole } from '@/lib/actions/people';

type RoleRow = { id: string; dept: string; role: LeaderRole; member_id: string; members: { full_name: string; reg_no: string } | null };

/** HR enters each department's ኃላፊ / ምክትል / ጸሐፊ after every election. */
export default async function Leadership({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ t?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const { t } = await searchParams;
  const supabase = await createClient();
  const [{ data: termsData }, { data: members }] = await Promise.all([
    supabase.from('leadership_terms').select('*').order('starts_on', { ascending: false }),
    supabase.from('members').select('id, full_name, reg_no').eq('is_active', true).order('full_name'),
  ]);
  const terms = (termsData ?? []) as Term[];
  const term = terms.find((x) => x.id === t) ?? terms.find((x) => x.is_active) ?? terms[0];
  if (!term) {
    return <p className="muted">መጀመሪያ ጽሕፈት ቤት የአመራር ቡድኑን (ዘመኑን) መመዝገብ አለበት።</p>;
  }
  const { data: rolesData } = await supabase.from('leadership_roles')
    .select('id, dept, role, member_id, members(full_name, reg_no)').eq('term_id', term.id);
  const roles = (rolesData ?? []) as unknown as RoleRow[];
  const who = (d: string, r: LeaderRole) => roles.find((x) => x.dept === d && x.role === r);

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የክፍላት አመራሮች</h2>
      <p className="muted small">ከእያንዳንዱ ምርጫ በኋላ የእያንዳንዱን ክፍል ኃላፊ፣ ምክትል ኃላፊ እና ጸሐፊ ይመዝግቡ። ይህ መዝገብ በመልቀቂያ ምስክር ወረቀት ላይ ይታተማል።</p>
      <form className="toolbar" action="/staff/hr/leadership">
        <div className="field">
          <label htmlFor="t">የአመራር ቡድን</label>
          <select id="t" name="t" defaultValue={term.id}>
            {terms.map((x) => <option key={x.id} value={x.id}>{termLabel(x)}{x.is_active ? ' (ንቁ)' : ''}</option>)}
          </select>
        </div>
        <button className="btn sm">ቀይር</button>
      </form>

      <MediaForm action={saveLeaderRole} submitLabel="መዝግብ">
        <input type="hidden" name="term_id" value={term.id} />
        <div className="form-grid">
          <div className="field">
            <label>ክፍል</label>
            <select name="dept" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ሚና</label>
            <select name="role" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {LEADER_ROLES.map((r) => <option key={r} value={r}>{LEADER_ROLE[r]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>አባል</label>
            <select name="member_id" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {(members ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.reg_no}</option>)}
            </select>
          </div>
        </div>
      </MediaForm>

      <div className="table-wrap">
        <table>
          <thead><tr><th>ክፍል</th>{LEADER_ROLES.map((r) => <th key={r}>{LEADER_ROLE[r]}</th>)}</tr></thead>
          <tbody>
            {DEPARTMENTS.map((d) => (
              <tr key={d.code}>
                <td>{d.name}</td>
                {LEADER_ROLES.map((r) => {
                  const x = who(d.code, r);
                  return (
                    <td key={r}>
                      {x ? (
                        <div className="btn-row">
                          <span>{x.members?.full_name}</span>
                          <ActionButton action={deleteLeaderRole.bind(null, x.id)} label="×" className="btn sm secondary" confirmText="ይህን ምደባ ማጥፋት ይፈልጋሉ?" />
                        </div>
                      ) : <span className="muted small">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
