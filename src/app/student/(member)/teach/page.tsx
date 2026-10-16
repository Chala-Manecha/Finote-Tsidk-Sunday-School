import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireMember } from '@/lib/member-auth';
import { classLabel, semesterLabel } from '@/lib/education';
import { bandOf, loadBands } from '@/lib/participation';
import { ownPhoto } from '@/lib/member-photo';

const STATUS: Record<string, string> = { draft: 'ነጥብ በመሙላት ላይ', submitted: 'ለማጽደቅ ተልኳል', approved: 'ጸድቋል' };
type O = {
  id: string; name: string; class_level: string; status: string;
  semesters: { no: number; year_id: string; academic_years: { ec_year: number; is_active: boolean } };
};

/** መምህር view: this year's courses as cards (students, sessions held, my own attendance), past years folded. */
export default async function TeacherHome() {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data }, { data: prof }, bands, photo] = await Promise.all([
    supabase.from('offering_teachers')
      .select('course_offerings(id, name, class_level, status, semesters(no, year_id, academic_years(ec_year, is_active)))').eq('member_id', me.memberId),
    supabase.rpc('my_member_profile'),
    loadBands(supabase),
    ownPhoto(me.photoPath),
  ]);
  const female = ((prof ?? []) as { sex: string | null }[])[0]?.sex === 'female';
  const all = ((data ?? []) as unknown as { course_offerings: O | null }[]).map((t) => t.course_offerings).filter((o): o is O => !!o);
  const current = all.filter((o) => o.semesters.academic_years.is_active)
    .sort((a, b) => a.semesters.no - b.semesters.no || a.class_level.localeCompare(b.class_level));
  const past = all.filter((o) => !o.semesters.academic_years.is_active)
    .sort((a, b) => b.semesters.academic_years.ec_year - a.semesters.academic_years.ec_year);

  const ids = current.map((o) => o.id);
  const [{ data: sessions }, { data: myAtt }, counts] = await Promise.all([
    ids.length ? supabase.from('class_sessions').select('offering_id').in('offering_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('teacher_attendance').select('offering_id, status').eq('member_id', me.memberId).in('offering_id', ids) : Promise.resolve({ data: [] }),
    Promise.all(current.map(async (o) => {
      const { count } = await supabase.from('enrollments').select('member_id', { count: 'exact', head: true })
        .eq('year_id', o.semesters.year_id).eq('class_level', o.class_level);
      return [o.id, count ?? 0] as const;
    })),
  ]);
  const students = new Map(counts);
  const held = new Map<string, number>();
  for (const s of (sessions ?? []) as { offering_id: string }[]) held.set(s.offering_id, (held.get(s.offering_id) ?? 0) + 1);
  const att = (myAtt ?? []) as { offering_id: string; status: string }[];
  const missed = (id: string) => att.filter((a) => a.offering_id === id && a.status === 'absent').length;
  const late = (id: string) => att.filter((a) => a.offering_id === id && a.status === 'late').length;
  const counted = att.filter((a) => a.status !== 'excused');
  const myPct = counted.length
    ? Math.round((counted.reduce((t, a) => t + (a.status === 'present' ? 1 : a.status === 'late' ? 0.5 : 0), 0) / counted.length) * 100)
    : null;
  const myBand = bandOf(myPct, bands);
  const totalHeld = [...held.values()].reduce((t, n) => t + n, 0);
  const first = me.fullName.replace(/^(ቀሲስ|ዲያቆን|ዶክተር|መምህር|መምህርት) /, '').split(' ')[0];

  return (
    <>
      <section className="me-strip">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="me-avatar" src={photo} alt="" />
          : <span className="me-avatar empty" aria-hidden>📖</span>}
        <div className="me-strip-text">
          <b className="serif">{female ? 'መምህርት' : 'መምህር'} {me.fullName}</b>
          <span className="small">{female ? `ሰላም ${first}፤ ስለ አገልግሎትሽ እናመሰግናለን።` : `ሰላም ${first}፤ ስለ አገልግሎትህ እናመሰግናለን።`} · መለያ ቁ. {me.regNo}</span>
        </div>
        <div className="me-strip-stats">
          <span><b>{current.length}</b>ኮርሶች</span>
          <span><b>{totalHeld}</b>ክፍለ ጊዜዎች</span>
          <span><b>{myPct !== null ? `${myPct}%` : '—'}</b>የእኔ ክትትል{myBand && <em className={`band b-${myBand.key}`}>{myBand.label}</em>}</span>
        </div>
      </section>

      <div className="card-head"><b>የዚህ ዓመት ኮርሶች</b><span className="count-badge">{current.length}</span></div>
      {current.length === 0 ? <p className="muted card">በዚህ የትምህርት ዘመን የተመደቡበት ኮርስ የለም። ትምህርት ክፍል ይመድባል።</p> : (
        <div className="teach-cards">
          {current.map((o) => (
            <Link key={o.id} href={`/student/teach/${o.id}`} className={`teach-card st-${o.status}`}>
              <div className="row"><span>{semesterLabel(o.semesters.no)} · {o.semesters.academic_years.ec_year} ዓ.ም</span><span className="pill">{STATUS[o.status] ?? o.status}</span></div>
              <h3>{o.name}</h3>
              <div className="small muted">{classLabel(o.class_level)}</div>
              <div className="nums">
                <div><b>{students.get(o.id) ?? 0}</b>ተማሪዎች</div>
                <div><b>{held.get(o.id) ?? 0}</b>ክፍለ ጊዜ</div>
                <div><b className={missed(o.id) ? 'neg' : ''}>{missed(o.id)}{late(o.id) ? <small> +{late(o.id)}</small> : null}</b>የቀረሁት{late(o.id) ? ' / አርፍጄ' : ''}</div>
              </div>
              <span className="small link">ክትትልና ውጤት ለመሙላት ክፈት →</span>
            </Link>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="card fold-card" style={{ marginTop: 18 }}>
          <summary><b>ያለፉ ዓመታት</b> <span className="small muted">({past.length} ኮርሶች)</span></summary>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>ኮርስ</th><th>ክፍል</th><th>ሴሚስተር</th><th>ሁኔታ</th></tr></thead>
              <tbody>
                {past.map((o) => (
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
        </details>
      )}
    </>
  );
}
