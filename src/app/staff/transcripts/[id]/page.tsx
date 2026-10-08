import { STUDY_MODE } from '@/lib/constants';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDept, canAccess } from '@/lib/auth';
import { SEX } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import {
  COMPONENTS, CONDUCT, DECISION, THANKSGIVING, classLabel, gradeOf, semesterLabel,
  type Conduct, type Decision, type ResultRow, type Semester, type YearRow,
} from '@/lib/education';
import { DocHeader, DocRows, DocSigns, QrCode, verifyUrl } from '@/components/doc-sheet';
import { DocPrintButton } from '@/components/doc-print-button';
import { markTranscriptPrinted } from '@/lib/actions/education-admin';

/** Semester transcript: student details, every course with its breakdown, teacher, attendance, rank. */
export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireDept('education', 'audit');
  const supabase = await createClient();
  const { data: t } = await supabase.from('transcripts').select('id, code, semester_id, year_id, member_id, print_count, issued_at').eq('id', id).maybeSingle();
  if (!t) notFound();
  if (!t.semester_id) return <YearTranscript t={t} canPrint={canAccess(staff, 'education')} />;
  const { data: sem } = await supabase.from('semesters').select('*, academic_years(ec_year)').eq('id', t.semester_id).single();
  const s = sem as Semester & { academic_years: { ec_year: number } };
  const [{ data: m }, { data: enr }, { data: cond }] = await Promise.all([
    supabase.from('members').select('full_name, reg_no, sex, title, photo_path, joined_year').eq('id', t.member_id).single(),
    supabase.from('enrollments').select('class_level, study_mode').eq('year_id', s.year_id).eq('member_id', t.member_id).single(),
    supabase.from('semester_conduct').select('conduct, remark').eq('semester_id', s.id).eq('member_id', t.member_id).maybeSingle(),
  ]);
  if (!m || !enr?.class_level) notFound();
  const { data: res } = await supabase.rpc('semester_results', { p_semester: s.id, p_class: enr.class_level });
  const rows = ((res ?? []) as ResultRow[]).filter((r) => r.member_id === t.member_id);
  const { data: teach } = await supabase.from('offering_teachers').select('offering_id, members(full_name)')
    .in('offering_id', rows.map((r) => r.offering_id));
  const teacherOf = (o: string) => ((teach ?? []) as unknown as { offering_id: string; members: { full_name: string } | null }[])
    .filter((x) => x.offering_id === o).map((x) => x.members?.full_name).join('፣ ') || '—';
  const photo = m.photo_path ? (await supabase.storage.from('member-docs').createSignedUrl(m.photo_path, 600)).data?.signedUrl : null;
  const { data: mk } = await supabase.from('marks').select('offering_id').eq('member_id', t.member_id).eq('makeup', true)
    .in('offering_id', rows.map((r) => r.offering_id));
  const makeup = new Set((mk ?? []).map((x) => x.offering_id));

  const first = rows[0];
  const attended = rows.reduce((a, r) => a + r.attended, 0);
  const held = rows.reduce((a, r) => a + r.sessions, 0);
  const failed = rows.filter((r) => !gradeOf(Number(r.total), s.pass_mark).passed).length;
  const mark = t.print_count > 0 ? 'ቅጂ (COPY)' : null;

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href={`/staff/education/results?s=${s.id}&c=${enr.class_level}`}>← ተመለስ</Link>
        {canAccess(staff, 'education') && <DocPrintButton action={markTranscriptPrinted.bind(null, t.id)} />}
      </div>
      <article className="doc-sheet">
        <DocHeader title="የትምህርት ማስረጃ (ትራንስክሪፕት)" code={t.code} mark={mark} />
        <p className="serif" style={{ textAlign: 'center', fontSize: '1.05rem', margin: '0 0 14px', color: '#1B3D55' }}>{THANKSGIVING}</p>
        <div className="cert-body">
          <DocRows rows={[
            ['ሙሉ ስም', <b key="n">{m.full_name}</b>],
            ['የመመዝገቢያ ቁጥር', m.reg_no],
            ['ፆታ', SEX[m.sex as keyof typeof SEX]],
            ['ክፍል', `${classLabel(enr.class_level)} · ${STUDY_MODE[(enr.study_mode ?? 'regular') as keyof typeof STUDY_MODE]}`],
            ['የትምህርት ዘመን', `${s.academic_years.ec_year} ዓ.ም`],
            ['ወሰነ ትምህርት', semesterLabel(s.no)],
            ['የተቀላቀሉበት ዓመት', m.joined_year ? `${m.joined_year} ዓ.ም` : '—'],
            ['የተሰጠበት', formatEc(t.issued_at)],
          ]} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img className="cert-photo" src={photo} alt="" /> : <div className="cert-photo" />}
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>ኮርስ</th><th>መምህር</th>
                {COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}<div className="small muted">/{s[c.weight]}</div></th>)}
                <th className="num">ድምር<div className="small muted">/100</div></th><th>ደረጃ</th><th className="num">ክትትል</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gradeOf(Number(r.total), s.pass_mark);
                return (
                  <tr key={r.offering_id}>
                    <td>{r.course}{makeup.has(r.offering_id) && <span className="small muted"> (ድጋሚ ፈተና)</span>}</td>
                    <td className="small">{teacherOf(r.offering_id)}</td>
                    {COMPONENTS.map((c) => <td key={c.key} className="num">{r[c.key] ?? '—'}</td>)}
                    <td className="num"><b>{r.total}</b></td>
                    <td className={g.passed ? '' : 'neg'}>{g.label}</td>
                    <td className="num">{r.sessions ? `${Math.round((r.attended / r.sessions) * 100)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="summary-grid">
          <div><span>አማካይ ውጤት</span><b>{first?.average ?? '—'}</b></div>
          <div><span>ደረጃ በክፍል</span><b>{first ? `${first.rank} ከ${first.class_size}` : '—'}</b></div>
          <div><span>አጠቃላይ ክትትል</span><b>{held ? `${Math.round((attended / held) * 100)}%` : '—'}</b></div>
          <div><span>ጠባይ</span><b>{cond?.conduct ? CONDUCT[cond.conduct as Conduct] : '—'}</b></div>
        </div>
        <p className="small" style={{ margin: '4px 0' }}>
          <b>ውሳኔ፦</b> {failed === 0 ? 'ሁሉንም ኮርሶች አልፈዋል።' : `${failed} ኮርስ(ሶች) አላለፉም።`}
          {cond?.remark ? ` · ${cond.remark}` : ''}
        </p>
        <p className="small muted" style={{ margin: '4px 0 0' }}>
          የውጤት አያያዝ፦ ፈተና {s.w_quiz} + ደብተር {s.w_notebook} + ተሣትፎ {s.w_participation} + አጋማሽ {s.w_mid} + ዋና {s.w_final} = 100 · ማለፊያ {s.pass_mark}
        </p>

        <div className="doc-foot">
          <DocSigns roles={['የትምህርት ክፍል ኃላፊ', 'የሰንበት ትምህርት ቤቱ ሰብሳቢ']} />
          <div className="doc-stamp">ማኅተም</div>
          <div style={{ textAlign: 'center' }}>
            <QrCode text={await verifyUrl(t.code)} />
            <div className="small muted" style={{ marginTop: 4 }}>ትክክለኛነቱን ያረጋግጡ</div>
          </div>
        </div>
      </article>
    </>
  );
}

type T = { id: string; code: string; year_id: string | null; member_id: string; print_count: number; issued_at: string };

/** Year transcript: both semesters, yearly average, rank, promotion, earlier years. */
async function YearTranscript({ t, canPrint }: { t: T; canPrint: boolean }) {
  const supabase = await createClient();
  const { data: yr } = await supabase.from('academic_years').select('id, ec_year').eq('id', t.year_id!).single();
  const [{ data: m }, { data: enr }, { data: sems }, { data: cond }, { data: hist }] = await Promise.all([
    supabase.from('members').select('full_name, reg_no, sex, photo_path, joined_year').eq('id', t.member_id).single(),
    supabase.from('enrollments').select('class_level, study_mode').eq('year_id', t.year_id!).eq('member_id', t.member_id).single(),
    supabase.from('semesters').select('*').eq('year_id', t.year_id!).order('no'),
    supabase.from('semester_conduct').select('semester_id, conduct').eq('member_id', t.member_id),
    supabase.rpc('student_history', { p_member: t.member_id }),
  ]);
  if (!yr || !m || !enr?.class_level) notFound();
  const semesters = (sems ?? []) as Semester[];
  const { data: yrow } = await supabase.rpc('year_results', { p_year: yr.id, p_class: enr.class_level });
  const y = ((yrow ?? []) as YearRow[]).find((r) => r.member_id === t.member_id);
  const perSem = await Promise.all(semesters.map(async (s) => {
    const { data } = await supabase.rpc('semester_results', { p_semester: s.id, p_class: enr.class_level });
    return { s, rows: ((data ?? []) as ResultRow[]).filter((r) => r.member_id === t.member_id) };
  }));
  const photo = m.photo_path ? (await supabase.storage.from('member-docs').createSignedUrl(m.photo_path, 600)).data?.signedUrl : null;
  const all = perSem.flatMap((p) => p.rows);
  const attended = all.reduce((a, r) => a + r.attended, 0);
  const held = all.reduce((a, r) => a + r.sessions, 0);
  const earlier = ((hist ?? []) as { ec_year: number; class_level: string; year_average: number | null; decision: Decision | null }[])
    .filter((h) => h.ec_year < yr.ec_year);
  const condOf = (sid: string) => (cond ?? []).find((c) => c.semester_id === sid)?.conduct as Conduct | undefined;
  const mark = t.print_count > 0 ? 'ቅጂ (COPY)' : null;

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href={`/staff/education/year-end?y=${yr.id}&c=${enr.class_level}`}>← ተመለስ</Link>
        {canPrint && <DocPrintButton action={markTranscriptPrinted.bind(null, t.id)} />}
      </div>
      <article className="doc-sheet">
        <DocHeader title="የዓመት የትምህርት ማስረጃ (ትራንስክሪፕት)" code={t.code} mark={mark} />
        <p className="serif" style={{ textAlign: 'center', fontSize: '1.05rem', margin: '0 0 14px', color: '#1B3D55' }}>{THANKSGIVING}</p>
        <div className="cert-body">
          <DocRows rows={[
            ['ሙሉ ስም', <b key="n">{m.full_name}</b>],
            ['የመመዝገቢያ ቁጥር', m.reg_no],
            ['ፆታ', SEX[m.sex as keyof typeof SEX]],
            ['ክፍል', `${classLabel(enr.class_level)} · ${STUDY_MODE[(enr.study_mode ?? 'regular') as keyof typeof STUDY_MODE]}`],
            ['የትምህርት ዘመን', `${yr.ec_year} ዓ.ም`],
            ['የተቀላቀሉበት ዓመት', m.joined_year ? `${m.joined_year} ዓ.ም` : '—'],
            ['የተሰጠበት', formatEc(t.issued_at)],
            ['ውሳኔ', <b key="d">{y?.decision ? DECISION[y.decision] : '—'}</b>],
          ]} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img className="cert-photo" src={photo} alt="" /> : <div className="cert-photo" />}
        </div>

        {perSem.map(({ s, rows }) => (
          <div key={s.id} style={{ marginTop: 14 }}>
            <h3 className="serif" style={{ margin: '0 0 6px' }}>{semesterLabel(s.no)}</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ኮርስ</th>{COMPONENTS.map((c) => <th key={c.key} className="num">{c.label}<div className="small muted">/{s[c.weight]}</div></th>)}<th className="num">ድምር</th><th>ደረጃ</th><th className="num">ክትትል</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const g = gradeOf(Number(r.total), s.pass_mark);
                    return (
                      <tr key={r.offering_id}>
                        <td>{r.course}</td>
                        {COMPONENTS.map((c) => <td key={c.key} className="num">{r[c.key] ?? '—'}</td>)}
                        <td className="num"><b>{r.total}</b></td>
                        <td className={g.passed ? '' : 'neg'}>{g.label}</td>
                        <td className="num">{r.sessions ? `${Math.round((r.attended / r.sessions) * 100)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small" style={{ margin: '4px 0' }}>አማካይ፦ <b>{rows[0]?.average ?? '—'}</b> · ደረጃ፦ {rows[0]?.rank ? `${rows[0].rank} ከ${rows[0].class_size}` : '—'} · ጠባይ፦ {condOf(s.id) ? CONDUCT[condOf(s.id)!] : '—'}</p>
          </div>
        ))}

        <div className="summary-grid">
          <div><span>የዓመት አማካይ</span><b>{y?.year_average ?? '—'}</b></div>
          <div><span>ደረጃ በክፍል (ዓመት)</span><b>{y?.rank ? `${y.rank} ከ${y.class_size}` : '—'}</b></div>
          <div><span>አጠቃላይ ክትትል</span><b>{held ? `${Math.round((attended / held) * 100)}%` : '—'}</b></div>
          <div><span>ውሳኔ</span><b className={y?.decision === 'repeat' ? 'neg' : 'pos'}>{y?.decision ? DECISION[y.decision] : '—'}</b></div>
        </div>
        {y?.remark && <p className="small">ማስታወሻ፦ {y.remark}</p>}

        {earlier.length > 0 && (
          <>
            <h3 className="serif" style={{ margin: '14px 0 6px' }}>የቀደሙ ዓመታት</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ዓ.ም</th><th>ክፍል</th><th className="num">የዓመት አማካይ</th><th>ውሳኔ</th></tr></thead>
                <tbody>
                  {earlier.map((h) => (
                    <tr key={h.ec_year}><td>{h.ec_year}</td><td>{classLabel(h.class_level)}</td><td className="num">{h.year_average ?? '—'}</td><td>{h.decision ? DECISION[h.decision] : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="doc-foot">
          <DocSigns roles={['የትምህርት ክፍል ኃላፊ', 'የሰንበት ትምህርት ቤቱ ሰብሳቢ']} />
          <div className="doc-stamp">ማኅተም</div>
          <div style={{ textAlign: 'center' }}>
            <QrCode text={await verifyUrl(t.code)} />
            <div className="small muted" style={{ marginTop: 4 }}>ትክክለኛነቱን ያረጋግጡ</div>
          </div>
        </div>
      </article>
    </>
  );
}
