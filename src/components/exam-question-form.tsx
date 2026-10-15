'use client';
import { useActionState, useState } from 'react';
import { saveQuestion, type FormState } from '@/lib/actions/online-exams';
import { LETTERS, QUESTION_KINDS, type Question, type QuestionKind } from '@/lib/exams';

/** Add / edit one question: ምርጫ, እውነት/ሐሰት, ባዶ ቦታ, አዛምድ — each with its own points. */
export function QuestionForm({ examId, offeringId, q, onDone }: { examId: string; offeringId: string; q?: Question; onDone?: () => void }) {
  const [kind, setKind] = useState<QuestionKind>(q?.kind ?? 'choice');
  const [choices, setChoices] = useState<string[]>(q?.kind === 'choice' ? (q.options as string[]) : ['', '', '', '']);
  const [correct, setCorrect] = useState<number>(q?.kind === 'choice' ? Number(q.answer) : 0);
  const [tf, setTf] = useState<boolean | null>(q?.kind === 'tf' ? (q.answer as boolean) : null);
  const [accepted, setAccepted] = useState<string>(q?.kind === 'blank' ? (q.answer as string[]).join('\n') : '');
  const mo = q?.kind === 'match' ? (q.options as { left: string[]; right: string[] }) : null;
  const [pairs, setPairs] = useState<[string, string][]>(mo ? mo.left.map((l, i) => [l, mo.right[i]]) : [['', ''], ['', ''], ['', '']]);
  const [n, setN] = useState(0);

  const [state, run, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveQuestion(prev, fd);
    if (r.ok && !q) { setChoices(['', '', '', '']); setCorrect(0); setTf(null); setAccepted(''); setPairs([['', ''], ['', ''], ['', '']]); setN((x) => x + 1); }
    if (r.ok) onDone?.();
    return r;
  }, {});

  const options = kind === 'choice' ? choices : kind === 'match' ? { left: pairs.map((p) => p[0]), right: pairs.map((p) => p[1]) } : [];
  const answer = kind === 'choice' ? correct : kind === 'tf' ? tf : kind === 'blank' ? accepted.split('\n').map((x) => x.trim()).filter(Boolean) : null;
  const sfx = q?.id ?? `new${n}`;

  return (
    <form action={run} className="qform" key={n}>
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="offering_id" value={offeringId} />
      {q && <input type="hidden" name="id" value={q.id} />}
      <input type="hidden" name="options_json" value={JSON.stringify(options)} />
      <input type="hidden" name="answer_json" value={JSON.stringify(answer)} />
      <div className="qform-top">
        <div className="seg">
          {(Object.keys(QUESTION_KINDS) as QuestionKind[]).map((k) => (
            <label key={k} className={kind === k ? 'on' : ''}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {QUESTION_KINDS[k]}
            </label>
          ))}
        </div>
        <div className="field qform-pts">
          <label htmlFor={`pts-${sfx}`}>ነጥብ</label>
          <input id={`pts-${sfx}`} name="points" type="number" min={0.5} max={100} step={0.5} required defaultValue={q?.points ?? 1} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`pr-${sfx}`}>ጥያቄ</label>
        <textarea id={`pr-${sfx}`} name="prompt" required rows={2} defaultValue={q?.prompt}
          placeholder={kind === 'blank' ? 'ባዶውን ቦታ በ ___ ያመልክቱ፤ ለምሳሌ፦ የመጀመሪያው ሰማዕት ___ ነው።' : kind === 'match' ? 'ለምሳሌ፦ የቀኙን ከግራው ጋር አዛምዱ' : ''} />
      </div>

      {kind === 'choice' && (
        <div className="qform-opts">
          <span className="small muted">ትክክለኛውን ምርጫ በክብ ምልክት ያድርጉ</span>
          {choices.map((c, i) => (
            <div key={i} className={`qopt ${correct === i ? 'ok' : ''}`}>
              <input type="radio" name={`correct-${sfx}`} checked={correct === i} onChange={() => setCorrect(i)} aria-label={`${LETTERS[i]} ትክክል`} />
              <b>{LETTERS[i]}.</b>
              <input value={c} onChange={(e) => setChoices(choices.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`ምርጫ ${LETTERS[i]}`} required />
              {choices.length > 2 && (
                <button type="button" className="link small" onClick={() => { setChoices(choices.filter((_, k) => k !== i)); setCorrect((c2) => (c2 === i ? 0 : c2 > i ? c2 - 1 : c2)); }}>አንሳ</button>
              )}
            </div>
          ))}
          {choices.length < 8 && <button type="button" className="btn xs secondary" onClick={() => setChoices([...choices, ''])}>+ ምርጫ</button>}
        </div>
      )}

      {kind === 'tf' && (
        <div className="btn-row">
          <button type="button" className={`btn sm ${tf === true ? 'green' : 'secondary'}`} onClick={() => setTf(true)}>✓ እውነት</button>
          <button type="button" className={`btn sm ${tf === false ? 'green' : 'secondary'}`} onClick={() => setTf(false)}>✗ ሐሰት</button>
          <span className="small muted">ትክክለኛውን ይምረጡ</span>
        </div>
      )}

      {kind === 'blank' && (
        <div className="field">
          <label htmlFor={`acc-${sfx}`}>ትክክለኛ መልሶች (በእያንዳንዱ መስመር አንድ — ለምሳሌ የተለያየ አጻጻፍ)</label>
          <textarea id={`acc-${sfx}`} rows={2} value={accepted} onChange={(e) => setAccepted(e.target.value)} required placeholder={'እስጢፋኖስ\nቅዱስ እስጢፋኖስ'} />
          <span className="small muted">ፊደላት ትልቅ/ትንሽ እና ትርፍ ክፍተት አይቆጠሩም። ሌላ ትክክለኛ መልስ ካለ በውጤት ማየቱ ላይ ማስተካከል ይችላሉ።</span>
        </div>
      )}

      {kind === 'match' && (
        <div className="qform-opts">
          <span className="small muted">ትክክለኛ ጥንዶችን በአንድ መስመር ያስገቡ — ለተማሪው የቀኙ ዝርዝር ተቀላቅሎ ይታያል።</span>
          {pairs.map(([l, r], i) => (
            <div key={i} className="qpair">
              <b>{i + 1}.</b>
              <input value={l} onChange={(e) => setPairs(pairs.map((p, k) => (k === i ? [e.target.value, p[1]] : p)))} placeholder="ግራ" required />
              <span aria-hidden>↔</span>
              <input value={r} onChange={(e) => setPairs(pairs.map((p, k) => (k === i ? [p[0], e.target.value] : p)))} placeholder="ቀኝ (ትክክለኛው መልስ)" required />
              {pairs.length > 2 && <button type="button" className="link small" onClick={() => setPairs(pairs.filter((_, k) => k !== i))}>አንሳ</button>}
            </div>
          ))}
          {pairs.length < 10 && <button type="button" className="btn xs secondary" onClick={() => setPairs([...pairs, ['', '']])}>+ ጥንድ</button>}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn sm" disabled={pending || (kind === 'tf' && tf === null)}>{pending ? '…' : q ? 'ለውጥ አስቀምጥ' : '+ ጥያቄውን ጨምር'}</button>
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok small" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
