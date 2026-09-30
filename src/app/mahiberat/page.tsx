import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'ማኅበራት' };

export default async function MahiberatPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('mahiberat').select('*')
    .gte('event_date', todayIsoAddis()).order('event_date').order('event_time');
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ማኅበራት</h1>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ማኅበር</th><th>ቀን</th><th>ሰዓት</th><th></th></tr></thead>
            <tbody>
              {(data ?? []).map((m) => (
                <tr key={m.id}>
                  <td>{m.association_name}</td>
                  <td>{formatEc(m.event_date, { weekday: true })}</td>
                  <td dir="ltr">{m.event_time?.slice(0, 5) ?? '—'}</td>
                  <td>{m.rescheduled && <span className="pill half">ተሸጋሽጓል</span>}</td>
                </tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={4} className="muted">የሚመጣ የማኅበር መርሐ ግብር የለም።</td></tr>}
            </tbody>
          </table>
        </div>
        <PublicFooter />
      </main>
    </>
  );
}
