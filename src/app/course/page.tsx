import { fmtTimeRange } from '@/lib/ethiopian-calendar';
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

  const teachers = new Set(rows.flatMap((r) => (r.teachers ?? '').split('፣').map((x) => x.trim()).filter(Boolean)));
  const timeline: [string, string | null][] = s ? [
    ['የሚጀምርበት', s.starts_on], ['አጋማሽ ፈተና', s.mid_exam_on], ['ዋና ፈተና', s.final_exam_on], ['የሚያበቃበት', s.ends_on],
  ] : [];

  return (
    <>
      <PublicHeader />
      <main className="page course-page">
        <section className="course-hero">
          <div>
            <span className="eyebrow">ትምህርት ክፍል</span>
            <h1>የኮርስ ትምህርት</h1>
            <p>
              ለሕፃናት፣ ለወጣቶችና ለጎልማሶች በክፍል ደረጃ የሚሰጡ ተከታታይ መንፈሳዊ ትምህርቶች — ዶግማ፣ ሥርዓተ ቤተ ክርስቲያን፣
              የቤተ ክርስቲያን ታሪክ፣ መጽሐፍ ቅዱስ፣ ሥነ ምግባር እና ሌሎችም። እያንዳንዱ ዓመት ሁለት ሴሚስተሮች አሉት፤ ተማሪዎች
              በክትትል፣ በፈተናና በተግባር ይመዘናሉ፤ በዓመቱ መጨረሻ ውጤታቸውን አይተው ወደ ቀጣዩ ክፍል ይዛወራሉ።
            </p>
            {s && <span className="hero-pill-dark">📅 {s.ec_year} ዓ.ም · {semesterLabel(s.semester_no)}</span>}
          </div>
          {s && (
            <div className="course-stats">
              <div><b>{byClass.length}</b><span>ክፍሎች</span></div>
              <div><b>{rows.length}</b><span>ኮርሶች</span></div>
              <div><b>{teachers.size}</b><span>መምህራን</span></div>
            </div>
          )}
        </section>

        {!s ? (
          <p className="muted card">የዚህ ሴሚስተር ኮርሶች በቅርቡ ይገለጻሉ።</p>
        ) : (
          <>
            <ol className="course-timeline">
              {timeline.map(([k, v]) => (
                <li key={k} className={v ? '' : 'tbd'}><span>{k}</span><b>{v ? formatEc(v) : 'ገና አልተወሰነም'}</b></li>
              ))}
            </ol>

            <h2 className="section">ክፍሎችና ኮርሶች <span className="small muted">— ክፍሉን ሲጫኑ ኮርሶቹ ይታያሉ</span></h2>
            <div className="class-cards">
              {byClass.map(([c, list]) => (
                <details key={c} className="class-card">
                  <summary>
                    <span className="class-badge">{c === 'kids' ? '👶' : c}</span>
                    <span><b>{classLabel(c)}</b><span className="small muted">{list.length} ኮርሶች</span></span>
                  </summary>
                  <ul>
                    {list.map((r) => (
                      <li key={r.course}>
                        <b>📘 {r.course}</b>
                        <span className="small">👤 {r.teachers ?? 'መምህር ገና አልተመደበም'}</span>
                        <span className="small muted">🗓 {days(r.days)}{r.time_text ? ` · ${fmtTimeRange(r.time_text)}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
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
