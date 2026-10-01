import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDept, canAccess } from '@/lib/auth';
import { SEX } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import {
  COMPONENTS, CONDUCT, THANKSGIVING, classLabel, gradeOf, semesterLabel,
  type Conduct, type ResultRow, type Semester,
} from '@/lib/education';
import { DocHeader, DocRows, DocSigns, QrCode, verifyUrl } from '@/components/doc-sheet';
import { DocPrintButton } from '@/components/doc-print-button';
import { markTranscriptPrinted } from '@/lib/actions/education-admin';

/** Semester transcript: student details, every course with its breakdown, teacher, attendance, rank. */
export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireDept('education', 'audit');
  const supabase = await createClient();
  const { data: t } = await supabase.from('transcripts').select('id, code, semester_id, member_id, print_count, issued_at').eq('id', id).maybeSingle();
  if (!t) notFound();
  const { data: sem } = await supabase.from('semesters').select('*, academic_years(ec_year)').eq('id', t.semester_id).single();
  const s = sem as Semester & { academic_years: { ec_year: number } };
  const [{ data: m }, { data: enr }, { data: cond }] = await Promise.all([
    supabase.from('members').select('full_name, reg_no, sex, title, photo_path, joined_year').eq('id', t.member_id).single(),
    supabase.from('enrollments').select('class_level').eq('year_id', s.year_id).eq('member_id', t.member_id).single(),
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
        <p className="serif" style={{ textAlign: 'center', fontSize: '1.05rem', margin: '0 0 14px', color: '#7A1F2B' }}>{THANKSGIVING}</p>
        <div className="cert-body">
          <DocRows rows={[
            ['ሙሉ ስም', <b key="n">{m.full_name}</b>],
            ['የመመዝገቢያ ቁጥር', m.reg_no],
            ['ፆታ', SEX[m.sex as keyof typeof SEX]],
            ['ክፍል', classLabel(enr.class_level)],
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
                    <td>{r.course}</td>
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
