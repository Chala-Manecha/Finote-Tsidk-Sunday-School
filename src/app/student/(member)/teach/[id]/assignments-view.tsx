import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatEc } from '@/lib/ethiopian-calendar';
import { Modal } from '@/components/modal';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { EcDatePicker } from '@/components/ec-date-picker';
import { deleteAssignment, saveAssignment, saveAssignmentScores } from '@/lib/actions/teaching';

type Asg = { id: string; title: string; instructions: string | null; max_points: number; due_on: string | null; created_at: string };
type Student = { id: string; full_name: string; reg_no: string };

function AssignmentForm({ offeringId, a }: { offeringId: string; a?: Asg }) {
  return (
    <MediaForm action={saveAssignment} submitLabel={a ? 'አስቀምጥ' : '+ አሳይመንት ጨምር'} card={false} resetOnSuccess={!a}>
      <input type="hidden" name="offering_id" value={offeringId} />
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="field"><label htmlFor={`at-${a?.id ?? 'n'}`}>ርዕስ</label><input id={`at-${a?.id ?? 'n'}`} name="title" required minLength={2} maxLength={160} defaultValue={a?.title ?? ''} placeholder="ለምሳሌ፦ ምዕራፍ 2 — የሥርዓተ ቅዳሴ ክፍሎች" /></div>
      <div className="field">
        <label htmlFor={`ai-${a?.id ?? 'n'}`}>መመሪያ / ጥያቄዎች</label>
        <textarea id={`ai-${a?.id ?? 'n'}`} name="instructions" rows={8} maxLength={8000} defaultValue={a?.instructions ?? ''} placeholder="ተማሪዎች ምን እንደሚሠሩ፣ ጥያቄዎቹን እና እንዴት እንደሚያስረክቡ ይጻፉ።" />
      </div>
      <div className="form-grid">
        <div className="field"><label htmlFor={`am-${a?.id ?? 'n'}`}>ነጥብ (ከ)</label><input id={`am-${a?.id ?? 'n'}`} name="max_points" type="number" min={0.5} max={100} step="0.5" defaultValue={a?.max_points ?? 10} required /></div>
        <div className="field"><span className="label">የማስረከቢያ ቀን (አማራጭ)</span><EcDatePicker name="due_on" defaultIso={a?.due_on ?? null} yearsBack={0} yearsForward={1} /></div>
      </div>
    </MediaForm>
  );
}

/** Teacher → course → 📝 አሳይመንት: the list, one assignment's scores, add / edit / delete. */
export async function AssignmentsView({ offeringId, base, students, locked, weight, picked }: {
  offeringId: string; base: string; students: Student[]; locked: boolean; weight: number; picked?: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.from('assignments').select('id, title, instructions, max_points, due_on, created_at')
    .eq('offering_id', offeringId).order('created_at');
  const list = ((data ?? []) as Asg[]).map((a) => ({ ...a, max_points: Number(a.max_points) }));
  const ids = list.map((a) => a.id);
  const { data: sc } = ids.length
    ? await supabase.from('assignment_scores').select('assignment_id, member_id, score, note').in('assignment_id', ids)
    : { data: [] };
  const scores = ((sc ?? []) as { assignment_id: string; member_id: string; score: number | null; note: string | null }[]);
  const one = list.find((a) => a.id === picked);

  if (one) {
    const mine = new Map(scores.filter((x) => x.assignment_id === one.id).map((x) => [x.member_id, x]));
    const marked = students.filter((s) => mine.get(s.id)?.score != null).length;
    return (
      <section className="card">
        <div className="card-head">
          <Link className="back-pill" href={`${base}?v=asg`}>← አሳይመንቶች</Link>
          <b>{one.title}</b><span className="pill">ከ{one.max_points}</span>
          <span className="spacer" />
          <Link className="btn sm secondary" href={`/student/assignment/${one.id}`} target="_blank">📄 PDF እይ</Link>
          {!locked && (
            <>
              <Modal label="✎ አርም" title="አሳይመንት አርም" btnClass="btn sm secondary" size="lg"><AssignmentForm offeringId={offeringId} a={one} /></Modal>
              <ActionButton action={deleteAssignment.bind(null, one.id)} label="አጥፋ" className="btn sm danger" confirmText={`“${one.title}” እና የተሰጡት ነጥቦች ይጥፉ?`} />
            </>
          )}
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {one.due_on ? `ማስረከቢያ፦ ${formatEc(one.due_on, { weekday: true })} · ` : ''}የታረሙ፦ {marked}/{students.length} · ነጥቡ ተማሪዎች ወዲያው ያዩታል (ማጽደቅ አያስፈልግም)።
        </p>
        {one.instructions && <div className="asg-text">{one.instructions}</div>}
        <MediaForm action={saveAssignmentScores} submitLabel="💾 ነጥቦቹን አስቀምጥ" card={false} resetOnSuccess={false}>
          <input type="hidden" name="assignment_id" value={one.id} />
          <input type="hidden" name="max_points" value={one.max_points} />
          <div className="table-wrap">
            <table className="marks-grid">
              <thead><tr><th>ተማሪ</th><th className="num">ነጥብ<div className="small muted">/{one.max_points}</div></th><th>ማስታወሻ</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.full_name}<input type="hidden" name="member_id" value={s.id} /><div className="small muted">{s.reg_no}</div></td>
                    <td className="num"><input name={`score_${s.id}`} type="number" min={0} max={one.max_points} step="0.25" inputMode="decimal"
                      defaultValue={mine.get(s.id)?.score ?? ''} disabled={locked} style={{ width: 70 }} aria-label={`${s.full_name} ነጥብ`} /></td>
                    <td><input name={`note_${s.id}`} defaultValue={mine.get(s.id)?.note ?? ''} disabled={locked} maxLength={300} placeholder="አማራጭ" style={{ minWidth: 140 }} /></td>
                  </tr>
                ))}
                {students.length === 0 && <tr><td colSpan={3} className="muted">በዚህ ክፍል ተማሪ የለም።</td></tr>}
              </tbody>
            </table>
          </div>
        </MediaForm>
      </section>
    );
  }

  const totalPts = list.reduce((t, a) => t + a.max_points, 0);
  return (
    <section className="card">
      <div className="card-head">
        <b>📝 አሳይመንቶች</b><span className="count-badge">{list.length}</span>
        <span className="spacer" />
        {!locked && <Modal label="+ አዲስ አሳይመንት" title="አዲስ አሳይመንት" size="lg"><AssignmentForm offeringId={offeringId} /></Modal>}
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        አሳይመንቶች ማጽደቅ አያስፈልጋቸውም — ሲጨመሩ ተማሪዎች ወዲያው ያዩታል። በውጤት ሉሁ ላይ፦ (ያገኙት ድምር ÷ {totalPts || 'የሁሉም'} ነጥብ) × {weight}
        {weight === 0 && <b className="neg"> — ትምህርት ክፍል የአሳይመንት ነጥብ (ከ100) ገና አልወሰነም፤ እስከዚያ በድምሩ አይቆጠርም።</b>}
      </p>
      {list.length === 0 ? <p className="muted">እስካሁን አሳይመንት የለም።</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>አሳይመንት</th><th className="num">ነጥብ</th><th>ማስረከቢያ</th><th className="num">የታረሙ</th><th /></tr></thead>
            <tbody>
              {list.map((a) => {
                const n = scores.filter((x) => x.assignment_id === a.id && x.score != null).length;
                return (
                  <tr key={a.id}>
                    <td><Link className="link" href={`${base}?v=asg&a=${a.id}`}><b>{a.title}</b></Link><div className="small muted">{formatEc(a.created_at.slice(0, 10))}</div></td>
                    <td className="num">{a.max_points}</td>
                    <td className="small">{a.due_on ? formatEc(a.due_on) : '—'}</td>
                    <td className="num"><span className={`pill ${n >= students.length && students.length ? 'present' : 'half'}`}>{n}/{students.length}</span></td>
                    <td><Link className="btn xs secondary" href={`${base}?v=asg&a=${a.id}`}>ነጥብ ስጥ →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
