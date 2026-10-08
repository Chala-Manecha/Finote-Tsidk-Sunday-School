import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { classLabel, semesterLabel } from '@/lib/education';

const STATUS: Record<string, string> = { draft: 'ነጥብ በመሙላት ላይ', submitted: 'ለማጽደቅ ተልኳል', approved: 'ጸድቋል' };

/** መምህር view: the courses this member teaches this year. */
export default async function TeacherHome() {
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from('offering_teachers')
    .select('course_offerings(id, name, class_level, status, semesters(no, academic_years(ec_year, is_active)))').eq('member_id', me.memberId);
  type O = { id: string; name: string; class_level: string; status: string; semesters: { no: number; academic_years: { ec_year: number; is_active: boolean } } };
  const all = ((data ?? []) as unknown as { course_offerings: O | null }[]).map((t) => t.course_offerings).filter((o): o is O => !!o);
  const current = all.filter((o) => o.semesters.academic_years.is_active);
  const past = all.filter((o) => !o.semesters.academic_years.is_active);

  const list = (rows: O[]) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>ኮርስ</th><th>ክፍል</th><th>ወሰነ ትምህርት</th><th>ሁኔታ</th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td><Link className="link" href={`/student/teach/${o.id}`}>{o.name}</Link></td>
              <td>{classLabel(o.class_level)}</td>
              <td>{semesterLabel(o.semesters.no)} · {o.semesters.academic_years.ec_year} ዓ.ም</td>
              <td className="small">{STATUS[o.status] ?? o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <h1 className="title" style={{ marginTop: 0 }}>የማስተምራቸው ክፍሎች</h1>
      <p className="muted small">{me.fullName} · መለያ ቁ. {me.regNo}</p>
      {current.length ? list(current) : <p className="muted">በዚህ የትምህርት ዘመን የተመደቡበት ኮርስ የለም። ትምህርት ክፍል ይመድባል።</p>}
      {past.length > 0 && (<><h2 className="section">ያለፉ ዓመታት</h2>{list(past)}</>)}
    </>
  );
}
