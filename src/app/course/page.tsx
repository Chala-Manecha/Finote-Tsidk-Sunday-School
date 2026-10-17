import { fmtTimeRange } from '@/lib/ethiopian-calendar';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicHeader } from '@/components/public-header';
import { CLASS_LEVELS, classLabel, semesterLabel } from '@/lib/education';
import { WEEKDAYS_AM } from '@/lib/ethiopian-calendar';

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
      <main className="page course-page">
        <div className="page-bar">
          <h1 className="title" style={{ margin: 0 }}>የክፍሎች መርሐ ግብር</h1>
          {s && <span className="hero-pill-dark">📅 {s.ec_year} ዓ.ም · {semesterLabel(s.semester_no)}</span>}
        </div>
        {!s ? (
          <p className="muted card">የዚህ ሴሚስተር ኮርሶች በቅርቡ ይገለጻሉ።</p>
        ) : (
          <>

            <div className="table-wrap course-table">
              <table>
                <thead><tr><th>ክፍል</th><th>ኮርስ</th><th>መምህር</th><th>ቀን</th><th>ሰዓት</th></tr></thead>
                <tbody>
                  {byClass.flatMap(([c, list]) => list.map((r, i) => (
                    <tr key={`${c}-${r.course}`} className={i === 0 ? 'class-first' : ''}>
                      {i === 0 && (
                        <td rowSpan={list.length} className="class-cell">
                          <span className="class-badge">{c === 'kids' ? '👶' : c}</span>
                          <span><b>{classLabel(c)}</b><span className="small muted">{list.length} ኮርሶች</span></span>
                        </td>
                      )}
                      <td><b>📘 {r.course}</b></td>
                      <td className="small">{r.teachers ?? <span className="muted">ገና አልተመደበም</span>}</td>
                      <td className="small">{days(r.days)}</td>
                      <td className="small">{r.time_text ? fmtTimeRange(r.time_text) : '—'}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="small" style={{ marginTop: 18 }}>
          ተማሪ ነዎት? ውጤትዎን ለማየት <Link className="link" href="/login">ይግቡ →</Link>
        </p>
      </main>
    </>
  );
}
