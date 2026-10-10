import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { ActionButton } from '@/components/action-button';
import { unlockAccount, resetAccount } from '@/lib/actions/education-admin';

type A = { member_id: string; failed_attempts: number; locked_at: string | null; last_login_at: string | null; created_at: string; members: { full_name: string; reg_no: string } | null };

/** ትምህርት ክፍል: student/teacher logins — unlock after 5 wrong PINs, or reset a forgotten PIN. */
export default async function StudentAccounts({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('member_accounts')
    .select('member_id, failed_attempts, locked_at, last_login_at, created_at, members(full_name, reg_no)')
    .order('locked_at', { ascending: false, nullsFirst: false });
  let rows = (data ?? []) as unknown as A[];
  if (q) rows = rows.filter((r) => `${r.members?.full_name} ${r.members?.reg_no}`.toLowerCase().includes(q.toLowerCase()));
  const locked = rows.filter((r) => r.locked_at).length;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የመግቢያ ኮድ ድጋፍ</h2>
      <p className="muted small">
        አባላት ሲመዘገቡ በፈጠሩት 6 አሃዝ ኮድ ይገባሉ — እዚህ መለያ መፍጠር አያስፈልግም። ይህ ገጽ ለድጋፍ ብቻ ነው፦
        ኮዱ 5 ጊዜ ከተሳሳተ መለያው ይቆለፋል — “ክፈት” ይጫኑ። ኮዱን የረሳ አባል “ዳግም አስጀምር” ሲጫን በመመዝገቢያ ቁጥሩና በስልኩ አዲስ ኮድ ይፈጥራል (ውጤቱ አይጠፋም)።
      </p>
      <div className="stat-cards"><div className="stat-card"><b>{rows.length}</b>መለያዎች</div><div className="stat-card"><b>{locked}</b>የተቆለፉ</div></div>
      <form className="toolbar" action="/staff/education/student-accounts">
        <div className="field"><label htmlFor="q">ፈልግ</label><input id="q" name="q" defaultValue={q ?? ''} /></div>
        <button className="btn sm">ፈልግ</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>አባል</th><th>የተመዘገበበት</th><th>መጨረሻ የገባበት</th><th>ሁኔታ</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member_id}>
                <td>{r.members?.full_name}<div className="small muted">{r.members?.reg_no}</div></td>
                <td>{formatEc(r.created_at)}</td>
                <td>{r.last_login_at ? formatEc(r.last_login_at) : '—'}</td>
                <td>{r.locked_at ? <span className="pill absent">ተቆልፏል</span> : <span className="pill present">ንቁ</span>}
                  {r.failed_attempts > 0 && !r.locked_at && <div className="small muted">{r.failed_attempts} የተሳሳቱ ሙከራዎች</div>}</td>
                <td>
                  <div className="btn-row">
                    {r.locked_at && <ActionButton action={unlockAccount.bind(null, r.member_id)} label="ክፈት" className="btn sm green" />}
                    <ActionButton action={resetAccount.bind(null, r.member_id)} label="ዳግም አስጀምር" className="btn sm secondary"
                      confirmText="የድሮው ኮድ ይሰረዛል፤ አባሉ በመመዝገቢያ ቁጥሩና በስልኩ እንደገና ይመዘገባል። ይቀጥል?" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">እስካሁን መለያ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
