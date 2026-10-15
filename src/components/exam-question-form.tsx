'use client';
import { useActionState, useState } from 'react';
import { saveQuestion, type FormState } from '@/lib/actions/online-exams';
import { LETTERS, QUESTION_KINDS, type Question, type QuestionKind } from '@/lib/exams';
import { useModalClose } from './modal';

const KIND_ICON: Record<QuestionKind, string> = { choice: '🔘', tf: '⚖', blank: '✏', match: '🔗' };
const KIND_HINT: Record<QuestionKind, string> = {
  choice: 'ከ2–8 ምርጫዎች፣ አንዱ ትክክል', tf: 'እውነት ወይም ሐሰት', blank: 'ባዶውን ቦታ በ ___ ያሳዩ', match: 'ግራውን ከቀኙ ጋር',
};

/** Add / edit one question: ምርጫ, እውነት/ሐሰት, ባዶ ቦታ, አዛምድ — each with its own points. */
export function QuestionForm({ examId, offeringId, q, number }: { examId: string; offeringId: string; q?: Question; number?: number }) {
  const close = useModalClose();
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
    if (r.ok && q) close?.();
    if (r.ok && !q) { setChoices(['', '', '', '']); setCorrect(0); setTf(null); setAccepted(''); setPairs([['', ''], ['', ''], ['', '']]); setN((x) => x + 1); }
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
      <input type="hidden" name="kind" value={kind} />

      <div className="qkinds" role="radiogroup" aria-label="የጥያቄ አይነት">
        {(Object.keys(QUESTION_KINDS) as QuestionKind[]).map((k) => (
          <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            <i aria-hidden>{KIND_ICON[k]}</i><b>{QUESTION_KINDS[k]}</b><span>{KIND_HINT[k]}</span>
          </button>
        ))}
      </div>

      <div className="qform-main">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`pr-${sfx}`}>{number ? `ጥያቄ ${number}` : 'ጥያቄ'}</label>
          <textarea id={`pr-${sfx}`} name="prompt" required rows={3} defaultValue={q?.prompt}
            placeholder={kind === 'blank' ? 'ለምሳሌ፦ የመጀመሪያው ሰማዕት ___ ነው።' : kind === 'match' ? 'ለምሳሌ፦ ቅዱሳኑን ከሥራቸው ጋር አዛምዱ' : kind === 'tf' ? 'ለምሳሌ፦ ቅዱስ ያሬድ የዜማ አባት ነው።' : 'ጥያቄውን ይጻፉ'} />
        </div>
        <div className="field qform-pts" style={{ margin: 0 }}>
          <label htmlFor={`pts-${sfx}`}>ነጥብ</label>
          <input id={`pts-${sfx}`} name="points" type="number" min={0.5} max={100} step={0.5} required defaultValue={q?.points ?? 1} />
        </div>
      </div>

      <div className="qform-answer">
        {kind === 'choice' && (
          <>
            <div className="qform-label">ምርጫዎች <span>— ትክክለኛውን “✓” ይጫኑ</span></div>
            {choices.map((c, i) => (
              <div key={i} className={`qopt ${correct === i ? 'ok' : ''}`}>
                <b className="qletter">{LETTERS[i]}</b>
                <input value={c} onChange={(e) => setChoices(choices.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`ምርጫ ${LETTERS[i]}`} required aria-label={`ምርጫ ${LETTERS[i]}`} />
                <button type="button" className={`qmark ${correct === i ? 'on' : ''}`} onClick={() => setCorrect(i)} aria-pressed={correct === i} title="ትክክለኛው መልስ">✓</button>
                {choices.length > 2 && (
                  <button type="button" className="qdel" aria-label="ምርጫውን አንሳ"
                    onClick={() => { setChoices(choices.filter((_, k) => k !== i)); setCorrect((c2) => (c2 === i ? 0 : c2 > i ? c2 - 1 : c2)); }}>×</button>
                )}
              </div>
            ))}
            {choices.length < 8 && <button type="button" className="qadd" onClick={() => setChoices([...choices, ''])}>+ ምርጫ ጨምር</button>}
          </>
        )}

        {kind === 'tf' && (
          <>
            <div className="qform-label">ትክክለኛው መልስ</div>
            <div className="qtf">
              <button type="button" className={tf === true ? 'on' : ''} onClick={() => setTf(true)}>✓ እውነት</button>
              <button type="button" className={tf === false ? 'on' : ''} onClick={() => setTf(false)}>✗ ሐሰት</button>
            </div>
          </>
        )}

        {kind === 'blank' && (
          <div className="field" style={{ margin: 0 }}>
            <label className="qform-label" htmlFor={`acc-${sfx}`}>ትክክለኛ መልሶች <span>— በእያንዳንዱ መስመር አንድ (የተለያየ አጻጻፍ)</span></label>
            <textarea id={`acc-${sfx}`} rows={3} value={accepted} onChange={(e) => setAccepted(e.target.value)} required placeholder={'እስጢፋኖስ\nቅዱስ እስጢፋኖስ'} />
            <span className="small muted">ትርፍ ክፍተትና ትልቅ/ትንሽ ፊደል አይቆጠሩም። ሌላ ትክክለኛ መልስ ካለ በእርማት ጊዜ ነጥቡን መስጠት ይችላሉ።</span>
          </div>
        )}

        {kind === 'match' && (
          <>
            <div className="qform-label">ትክክለኛ ጥንዶች <span>— ለተማሪው የቀኙ ተቀላቅሎ ይታያል</span></div>
            <div className="qpairs">
              <span className="qpairs-h">ግራ</span><span /><span className="qpairs-h">ቀኝ (ትክክለኛው)</span><span />
              {pairs.map(([l, r], i) => [
                <input key={`l${i}`} value={l} onChange={(e) => setPairs(pairs.map((p, k) => (k === i ? [e.target.value, p[1]] : p)))} placeholder={`${i + 1}.`} required aria-label={`ግራ ${i + 1}`} />,
                <span key={`a${i}`} className="qpairs-arrow" aria-hidden>↔</span>,
                <input key={`r${i}`} value={r} onChange={(e) => setPairs(pairs.map((p, k) => (k === i ? [p[0], e.target.value] : p)))} placeholder="ተዛማጁ" required aria-label={`ቀኝ ${i + 1}`} />,
                pairs.length > 2
                  ? <button key={`d${i}`} type="button" className="qdel" aria-label="ጥንዱን አንሳ" onClick={() => setPairs(pairs.filter((_, k) => k !== i))}>×</button>
                  : <span key={`d${i}`} />,
              ])}
            </div>
            {pairs.length < 10 && <button type="button" className="qadd" onClick={() => setPairs([...pairs, ['', '']])}>+ ጥንድ ጨምር</button>}
          </>
        )}
      </div>

      <div className="qform-foot">
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && !q && <span className="alert ok small" style={{ margin: 0 }}>✓ {state.ok} ቀጣዩን ያስገቡ።</span>}
        <span style={{ flex: 1 }} />
        {!q && close && <button type="button" className="btn secondary" onClick={close}>ጨርሻለሁ</button>}
        <button className="btn" disabled={pending || (kind === 'tf' && tf === null)}>{pending ? '…' : q ? 'ለውጥ አስቀምጥ' : '+ ጥያቄውን ጨምር'}</button>
      </div>
    </form>
  );
}
