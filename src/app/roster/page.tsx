import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'የአባላት ምደባ' };

type Row = { id: string; full_name: string; duty: string; duty_date: string; occasion: string; dept: string };

export default async function PublicRoster({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_duty_roster', { p_from: todayIsoAddis() });
  const needle = q?.trim();
  const rows = ((data ?? []) as Row[]).filter((r) => !needle || r.full_name.includes(needle));

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">የአባላት ምደባ</h1>
        <form className="toolbar" action="/roster">
          <div className="field">
            <label htmlFor="q">ስምዎትን ይፈልጉ</label>
            <input id="q" name="q" defaultValue={needle} placeholder="ሙሉ ስም" />
          </div>
          <button className="btn sm">ፈልግ</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ስም</th><th>ምድብ</th><th>ቀን</th><th>ምክንያት</th><th>የመደበው ክፍል</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.duty}</td>
                  <td>{formatEc(r.duty_date, { weekday: true })}</td>
                  <td>{r.occasion}</td>
                  <td>{DEPT_NAME[r.dept]}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="muted">{needle ? 'በዚህ ስም የሚመጣ ምደባ የለም።' : 'የሚመጣ ምደባ የለም።'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <PublicFooter />
      </main>
    </>
  );
}
