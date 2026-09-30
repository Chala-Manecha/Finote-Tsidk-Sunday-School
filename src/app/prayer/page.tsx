import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { dayNames } from '@/components/day-checks';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'የጸሎት መርኀ ግብራት' };

export default async function PrayerPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('prayer_schedule').select('id, program, days, times').order('created_at');
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">የጸሎት መርኀ ግብራት</h1>
        <div className="table-wrap">
          <table>
            <thead><tr><th>መርኀ ግብር</th><th>ቀናት</th><th>ሰዓት</th></tr></thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id}><td>{p.program}</td><td>{dayNames(p.days)}</td><td>{(p.times ?? []).join('፣ ') || '—'}</td></tr>
              ))}
              {data?.length === 0 && <tr><td colSpan={3} className="muted">ምንም የለም።</td></tr>}
            </tbody>
          </table>
        </div>
        <PublicFooter />
      </main>
    </>
  );
}
