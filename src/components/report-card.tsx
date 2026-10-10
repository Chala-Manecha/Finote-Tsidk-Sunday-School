import { CHURCH_NAME, CHURCH_NAME_EN, SCHOOL_ADDRESS, SCHOOL_NAME, SEX, STUDY_MODE } from '@/lib/constants';
import { DECISION, THANKSGIVING, classLabel, type Decision } from '@/lib/education';

export type CardLine = { course: string; teachers: string[]; s1: number | null; s2: number | null };
type Stat = { average: number | null; rank: number | null; size: number } | null;
export type CardData = {
  draft: boolean; ecYear: number; promoteMin: number; passMark: number; decision: Decision | null; photo: string | null;
  student: { fullName: string; regNo: string; sex: string; classLevel: string; studyMode: string };
  lines: CardLine[]; s1: Stat; s2: Stat; year: (Stat & { remark?: string | null }) | null;
};

const avg = (a: number | null, b: number | null) => {
  const v = [a, b].filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((t, x) => t + x, 0) / v.length) * 100) / 100 : null;
};

/** The two A4 pages of the year report card. */
export function ReportCardSheets({ data: d }: { data: CardData }) {
  const st = d.student;
  const { draft, decision, photo, passMark, s1, s2, year: y } = d;
  const passed = decision === 'promoted';
  return (
    <>
      {/* ---------- Page 1 ---------- */}
      <article className="doc-sheet report-card rc-cover">
        {draft && <div className="doc-void"><span>ረቂቅ</span></div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rc-logo" src="/logo.png" alt="" width={110} height={110} />
        <div className="rc-church">{CHURCH_NAME}</div>
        <div className="small muted">{CHURCH_NAME_EN}</div>
        <div className="rc-school serif">{SCHOOL_NAME}</div>
        <div className="small muted">{SCHOOL_ADDRESS}</div>
        <h1 className="rc-title serif">የተማሪ የዓመት ውጤት መግለጫ ካርድ</h1>
        <div className="rc-year">{d.ecYear} ዓ.ም የትምህርት ዘመን</div>

        <div className="rc-student">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo ? <img className="cert-photo" src={photo} alt="" /> : <div className="cert-photo" />}
          <dl className="doc-rows rc-rows">
            <div><dt>ሙሉ ስም</dt><dd><b>{st.fullName}</b></dd></div>
            <div><dt>የመመዝገቢያ ቁጥር</dt><dd>{st.regNo}</dd></div>
            <div><dt>ፆታ</dt><dd>{SEX[st.sex as keyof typeof SEX] ?? '—'}</dd></div>
            <div><dt>ክፍል</dt><dd>{classLabel(st.classLevel)} · {STUDY_MODE[st.studyMode as keyof typeof STUDY_MODE]}</dd></div>
          </dl>
        </div>

        <div className={`rc-status ${decision ? (passed ? 'pass' : 'fail') : ''}`}>
          <span>የዓመቱ ውጤት</span>
          <b>{decision ? (passed ? 'አልፈዋል' : 'አላለፉም') : '—'}</b>
          <small>{decision ? DECISION[decision] : ''}{y?.average != null ? ` · የዓመት አማካይ ${y.average}` : ''}{y?.rank ? ` · ደረጃ ${y.rank} ከ${y.size}` : ''}</small>
        </div>
        {y?.remark && <p className="small" style={{ textAlign: 'center' }}>ማስታወሻ፦ {y.remark}</p>}

        <div className="statement-signs rc-signs">
          {['የክፍል መምህር', 'የትምህርት ክፍል ኃላፊ', 'የሰንበት ትምህርት ቤቱ ሰብሳቢ', 'የወላጅ / አሳዳጊ'].map((r) => (
            <div key={r}><div className="sign-line" /><div className="small">{r}</div><div className="small muted">ስም፣ ፊርማ እና ቀን</div></div>
          ))}
        </div>

        <p className="rc-thanks serif">{THANKSGIVING}</p>
        <p className="rc-thanks-sub">
          ዓመቱን ሙሉ በትጋት ስለተማሩ እናመሰግናለን። በሚቀጥለው ዓመትም በሰንበት ትምህርት ቤታችን እንድንገናኝ እግዚአብሔር ይርዳን።
        </p>
      </article>

      {/* ---------- Page 2 ---------- */}
      <article className="doc-sheet report-card rc-results">
        {draft && <div className="doc-void"><span>ረቂቅ</span></div>}
        <header className="rc-head">
          <div><b>{st.fullName}</b> <span className="small muted">· {st.regNo}</span></div>
          <div className="small">{classLabel(st.classLevel)} · {d.ecYear} ዓ.ም</div>
        </header>
        <h2 className="serif rc-h2">የትምህርት ውጤት</h2>
        <table className="rc-table">
          <thead>
            <tr>
              <th>ተ.ቁ</th><th>ኮርስ</th><th>መምህር</th>
              <th className="num">1ኛ ሴሚስተር</th><th className="num">2ኛ ሴሚስተር</th><th className="num">አማካይ</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => {
              const a = avg(l.s1, l.s2);
              const bad = (v: number | null) => (v !== null && v < passMark ? 'neg' : '');
              return (
                <tr key={l.course}>
                  <td>{i + 1}</td>
                  <td>{l.course}</td>
                  <td className="small">{l.teachers.join('፣ ') || '—'}</td>
                  <td className={`num ${bad(l.s1)}`}>{l.s1 ?? '—'}</td>
                  <td className={`num ${bad(l.s2)}`}>{l.s2 ?? '—'}</td>
                  <td className={`num ${bad(a)}`}><b>{a ?? '—'}</b></td>
                </tr>
              );
            })}
            {d.lines.length === 0 && <tr><td colSpan={6} className="muted">ውጤት የለም።</td></tr>}
          </tbody>
          <tbody className="rc-sum">
            <tr>
              <th colSpan={3}>አማካይ</th>
              <td className="num"><b>{s1?.average ?? '—'}</b></td>
              <td className="num"><b>{s2?.average ?? '—'}</b></td>
              <td className="num"><b>{y?.average ?? '—'}</b></td>
            </tr>
            <tr>
              <th colSpan={3}>ደረጃ</th>
              <td className="num">{s1 ? `${s1.rank} ከ${s1.size}` : '—'}</td>
              <td className="num">{s2 ? `${s2.rank} ከ${s2.size}` : '—'}</td>
              <td className="num"><b>{y?.rank ? `${y.rank} ከ${y.size}` : '—'}</b></td>
            </tr>
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 8 }}>
          ማለፊያ ውጤት {passMark}/100 · ቀይ = አላለፈም · የመዛወሪያ ዝቅተኛ የዓመት አማካይ {d.promoteMin}
        </p>
      </article>
    </>
  );
}
