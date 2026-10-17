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
export default async function CoursePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: pickedClass } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_course_catalog');
  const rows = (data ?? []) as Row[];
  const s = rows[0];
  const byClass = CLASS_LEVELS.map((c) => [c, rows.filter((r) => r.class_level === c)] as const).filter(([, r]) => r.length > 0);
  const [cls, list] = byClass.find(([c]) => c === pickedClass) ?? byClass[0] ?? [null, []];
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
          <div className="split course-split">
            <nav className="rail" aria-label="ክፍሎች">
              <span className="rail-title">ክፍሎች</span>
              {byClass.map(([c, l]) => (
                <Link key={c} href={`/course?c=${c}`} scroll={false} className={c === cls ? 'on' : ''}>
                  <span>{c === 'kids' ? '👶 ' : ''}{classLabel(c)}</span><b>{l.length}</b>
                </Link>
              ))}
            </nav>
            <section className="card">
              <div className="card-head">
                <span className="class-badge">{cls === 'kids' ? '👶' : cls}</span>
                <b>{cls ? classLabel(cls) : ''}</b><span className="count-badge">{list.length} ኮርሶች</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>ኮርስ</th><th>መምህር</th><th>ቀን</th><th>ሰዓት</th></tr></thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.course}>
                        <td><b>📘 {r.course}</b></td>
                        <td className="small">{r.teachers ?? <span className="muted">ገና አልተመደበም</span>}</td>
                        <td className="small">{days(r.days)}</td>
                        <td className="small">{r.time_text ? fmtTimeRange(r.time_text) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        <p className="small" style={{ marginTop: 18 }}>
          ተማሪ ነዎት? ውጤትዎን ለማየት <Link className="link" href="/login">ይግቡ →</Link>
        </p>
      </main>
    </>
  );
}
