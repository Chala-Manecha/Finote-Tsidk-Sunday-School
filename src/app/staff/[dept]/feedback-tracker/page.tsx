import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS } from '@/lib/constants';

export default async function OfficeFeedbackTracker({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('feedback').select('dept, status');
  const count = (d: string, s: string) => (data ?? []).filter((r) => r.dept === d && r.status === s).length;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የአስተያየት ክትትል</h2>
      <p className="muted small">ጽሕፈት ቤት ቁጥሮቹን ብቻ ያያል፤ መልስ የሚሰጠው የሚመለከተው ክፍል ነው።</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ክፍል</th><th className="num">አልታየም</th><th className="num">ታይቷል</th></tr></thead>
          <tbody>
            {DEPARTMENTS.map((d) => {
              const u = count(d.code, 'unseen');
              return (
                <tr key={d.code}>
                  <td>{d.name}</td>
                  <td className="num">{u > 0 ? <span className="pill absent">{u}</span> : 0}</td>
                  <td className="num">{count(d.code, 'seen')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
