import Link from 'next/link';
import { SCHOOL_NAME } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Public home. More public pages (ኮርስ, ዜማ, ታሪካችን …) come in a later phase.
export default async function Home() {
  const today = todayIsoAddis();
  const supabase = await createClient();
  const { data: week } = await supabase
    .from('events')
    .select('id, title, event_date, event_time')
    .eq('status', 'approved')
    .gte('event_date', today)
    .lte('event_date', addDays(today, 7))
    .order('event_date')
    .order('event_time');

  return (
    <>
      <header className="topbar">
        <span className="brand">{SCHOOL_NAME}</span>
        <span className="spacer" />
        <nav>
          <Link href="/staff">ሁሉም ክፍሎች (9)</Link>
        </nav>
      </header>
      <main className="page">
        <div className="card" style={{ marginTop: 30 }}>
          <h1 className="title">እንኳን ወደ {SCHOOL_NAME} በሰላም መጡ።</h1>
          <p>ለመመዝገብ ወደ ቢሮ ቁጥር 9 በአካል ይሂዱ።</p>
        </div>

        <h2 className="section">የሳምንቱ መርሓ ግብራት</h2>
        {week && week.length > 0 ? (
          <div className="table-wrap">
            <table>
              <tbody>
                {week.map((e) => (
                  <tr key={e.id}>
                    <td>{formatEc(e.event_date, { weekday: true })}</td>
                    <td dir="ltr">{e.event_time.slice(0, 5)}</td>
                    <td>{e.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">በሚቀጥሉት 7 ቀናት የተያዘ መርሓ ግብር የለም።</p>
        )}

        <p className="muted small" style={{ marginTop: 30 }}>
          አቃቂ ቃሊቲ, ወረዳ-1, ደብረ ጽጌ ቅዱስ ሩፋኤል ቤተክርስቲያን, ኢትዮጵያ · Telegram @make_living
        </p>
      </main>
    </>
  );
}
