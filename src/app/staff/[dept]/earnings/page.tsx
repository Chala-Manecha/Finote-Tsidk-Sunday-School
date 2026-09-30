import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, EARNING_STATUS, STATUS_PILL, formatBirr, type EarningStatus } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { ActionButton } from '@/components/action-button';
import { decideEarning } from '@/lib/actions/money';

type E = {
  id: string; dept: string; amount: number; source: string; earned_on: string;
  status: EarningStatus; submitted_at: string; decided_at: string | null;
};

export default async function FinanceEarnings({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'finance') notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from('earnings')
    .select('id, dept, amount, source, earned_on, status, submitted_at, decided_at')
    .order('status')
    .order('submitted_at', { ascending: false });
  const rows = (data ?? []) as E[];
  const pending = rows.filter((r) => r.status === 'pending');

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የተገኘ ገንዘብ ለማጸደቅ ({pending.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ክፍል</th><th className="num">መጠን</th><th>ምንጭ</th><th>የተገኘበት</th><th>የጠየቀበት ቀን</th><th>የጸደቀበት ቀን</th><th>ሁኔታ</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{DEPT_NAME[e.dept]}</td>
                <td className="num">{formatBirr(e.amount)}</td>
                <td>{e.source}</td>
                <td>{formatEc(e.earned_on)}</td>
                <td>{formatEc(e.submitted_at)}</td>
                <td>{e.decided_at ? formatEc(e.decided_at) : '—'}</td>
                <td><span className={`pill ${STATUS_PILL[e.status]}`}>{EARNING_STATUS[e.status]}</span></td>
                <td>
                  {e.status === 'pending' && (
                    <div className="btn-row">
                      <ActionButton action={decideEarning.bind(null, e.id, 'approved')} label="አጽድቅ" className="btn sm green" />
                      <ActionButton action={decideEarning.bind(null, e.id, 'rejected')} label="ከልክል" className="btn sm secondary"
                        confirmText="ይህን ገቢ መከልከል ይፈልጋሉ?" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">ምንም የገቢ ሪፖርት የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
