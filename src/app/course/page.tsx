import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicHeader } from '@/components/public-header';
import { CLASS_LEVELS, classLabel, semesterLabel } from '@/lib/education';
import { WEEKDAYS_AM, formatEc } from '@/lib/ethiopian-calendar';

export const metadata: Metadata = { title: 'ኮርስ' };

type Row = {
  class_level: string; course: string; teachers: string | null; days: number[]; time_text: string | null;
  ec_year: number; semester_no: number; starts_on: string | null; ends_on: string | null;
  mid_exam_on: string | null; final_exam_on: string | null;
};

/** Public: this semester's courses per class, with teachers, schedule and exam dates (ትምህርት ክፍል data). */
export default async function CoursePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_course_catalog');
  const rows = (data ?? []) as Row[];
  const s = rows[0];
  const byClass = CLASS_LEVELS.map((c) => [c, rows.filter((r) => r.class_level === c)] as const).filter(([, r]) => r.length > 0);
  const days = (d: number[]) => (d.length ? [...d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((x) => WEEKDAYS_AM[x]).join('፣ ') : '—');

  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ኮርስ</h1>
        {!s ? (
          <p className="muted">የዚህ ሴሚስተር ኮርሶች በቅርቡ ይገለጻሉ።</p>
        ) : (
          <>
            <p className="muted">{s.ec_year} ዓ.ም · {semesterLabel(s.semester_no)}</p>
            <div className="summary-grid">
              <div><span>የሚጀምርበት</span><b>{s.starts_on ? formatEc(s.starts_on) : '—'}</b></div>
              <div><span>አጋማሽ ፈተና</span><b>{s.mid_exam_on ? formatEc(s.mid_exam_on) : '—'}</b></div>
              <div><span>ዋና ፈተና</span><b>{s.final_exam_on ? formatEc(s.final_exam_on) : '—'}</b></div>
              <div><span>የሚያበቃበት</span><b>{s.ends_on ? formatEc(s.ends_on) : '—'}</b></div>
            </div>
            {byClass.map(([c, list]) => (
              <section key={c}>
                <h2 className="section">{classLabel(c)}</h2>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ኮርስ</th><th>መምህር</th><th>ቀን</th><th>ሰዓት</th></tr></thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.course}>
                          <td>{r.course}</td><td>{r.teachers ?? '—'}</td><td>{days(r.days)}</td><td>{r.time_text ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
        <p className="small" style={{ marginTop: 18 }}>
          ተማሪ ነዎት? ውጤትዎን ለማየት <Link className="link" href="/student">የተማሪ መግቢያ →</Link>
        </p>
      </main>
    </>
  );
}
