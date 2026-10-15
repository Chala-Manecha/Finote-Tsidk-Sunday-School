'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { startExam, saveAnswers, finishExam, type Paper } from '@/lib/actions/online-exams';
import { EXAM_COMPONENTS, LETTERS, QUESTION_KINDS } from '@/lib/exams';

type Q = Paper['questions'][number];
type Answers = Record<string, unknown>;
type Info = { id: string; title: string; component: keyof typeof EXAM_COMPONENTS; course: string; duration_min: number; questions: number; total_points: number };

const isAnswered = (q: Q, v: unknown) => {
  if (v === undefined || v === null) return false;
  if (q.kind === 'blank') return String(v).trim() !== '';
  if (q.kind === 'match') return Array.isArray(v) && v.length === (q.options as { left: string[] }).left.length && v.every((x) => x !== null && x !== undefined);
  return true;
};
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(r).padStart(2, '0')}`;
};

/**
 * Sitting an exam: one question at a time with the clock beside it, back / next, 🚩 to come back to,
 * a review page before handing in, answers saved as you go, and handed in automatically when time is up.
 */
export function ExamRunner({ info, resume }: { info: Info; resume: boolean }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [screen, setScreen] = useState<'intro' | 'q' | 'review' | 'done'>('intro');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline' | 'idle'>('idle');
  const [left, setLeft] = useState(0);
  const [awayNote, setAwayNote] = useState(false);
  const [remaining, setRemaining] = useState<number>(info.duration_min * 60000);
  const [autoDone, setAutoDone] = useState(false);
  const offset = useRef(0); // server clock − this device's clock
  const dirty = useRef(false);
  const submitting = useRef(false);
  const live = useRef({ answers, flags, left });
  useEffect(() => { live.current = { answers, flags, left }; }, [answers, flags, left]);

  const begin = useCallback(async () => {
    setBusy(true); setErr(null);
    const r = await startExam(info.id);
    setBusy(false);
    if (r.error || !r.paper) { setErr(r.error ?? 'መጀመር አልተቻለም።'); return; }
    const p = r.paper;
    offset.current = Date.parse(p.now) - Date.now();
    setPaper(p);
    setAnswers(p.answers ?? {});
    setFlags(Array.isArray(p.flags) ? p.flags : []);
    setScreen(p.submitted ? 'done' : 'q');
  }, [info.id]);

  // resume an exam already started (after a refresh or a lost connection)
  useEffect(() => { if (resume) void Promise.resolve().then(begin); }, [resume, begin]);

  const submit = useCallback(async (auto: boolean) => {
    if (!paper || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const { answers: a, flags: f, left: l } = live.current;
    const r = await finishExam(paper.attempt, a, f, l, auto);
    setBusy(false);
    if (r.error && !auto) { submitting.current = false; setErr(r.error); return; }
    setAutoDone(auto);
    setScreen('done');
  }, [paper]);

  // the clock
  useEffect(() => {
    if (!paper || screen === 'done') return;
    const deadline = Date.parse(paper.deadline);
    const tick = () => {
      const ms = deadline - (Date.now() + offset.current);
      setRemaining(ms);
      if (ms <= 0) void submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [paper, screen, submit]);

  // save a moment after each change, and every 20 s anyway
  const flush = useCallback(async () => {
    if (!paper || !dirty.current) return;
    dirty.current = false;
    setSaveState('saving');
    const { answers: a, flags: f, left: l } = live.current;
    const r = await saveAnswers(paper.attempt, a, f, l);
    if (r.timeUp) { setAutoDone(true); setScreen('done'); return; }
    if (r.error) { dirty.current = true; setSaveState('offline'); return; }
    setSaveState('saved');
  }, [paper]);
  useEffect(() => {
    if (!paper || screen === 'done') return;
    const t = setTimeout(() => { void flush(); }, 1200);
    return () => clearTimeout(t);
  }, [answers, flags, left, paper, screen, flush]);
  useEffect(() => {
    if (!paper || screen === 'done') return;
    const t = setInterval(() => { void flush(); }, 20000);
    return () => clearInterval(t);
  }, [paper, screen, flush]);

  // leaving the exam tab is counted (the teacher sees it)
  useEffect(() => {
    if (!paper || screen === 'done') return;
    const onVis = () => { if (document.visibilityState === 'hidden') { dirty.current = true; setLeft((n) => n + 1); setAwayNote(true); } };
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', warn);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('beforeunload', warn); };
  }, [paper, screen]);

  const setAnswer = (qid: string, v: unknown) => { dirty.current = true; setAnswers((a) => ({ ...a, [qid]: v })); };
  const toggleFlag = (qid: string) => { dirty.current = true; setFlags((f) => (f.includes(qid) ? f.filter((x) => x !== qid) : [...f, qid])); };

  // ---------- screens ----------
  if (screen === 'intro') {
    return (
      <section className="card exam-intro">
        <span className="pill">{EXAM_COMPONENTS[info.component]}</span>
        <h1 className="serif">{info.title}</h1>
        <p className="muted">{info.course}</p>
        <div className="exam-facts">
          <div><b>{info.questions}</b>ጥያቄዎች</div>
          <div><b>{Number(info.total_points)}</b>ነጥብ</div>
          <div><b>{info.duration_min}</b>ደቂቃ</div>
        </div>
        <ul className="exam-rules">
          <li>ሲጀምሩ ሰዓቱ መቁጠር ይጀምራል፤ ገጹን ቢዘጉም ሰዓቱ አይቆምም።</li>
          <li>ጥያቄዎቹ አንድ በአንድ ይታያሉ — በ“ቀዳሚ / ቀጣይ” ይመላለሱ፤ መመለስ የሚፈልጉትን በ🚩 ምልክት ያድርጉ።</li>
          <li>መልሶችዎ በራሳቸው ይቀመጣሉ። ሰዓቱ ሲያልቅ ፈተናው በራሱ ይገባል።</li>
          <li>ከፈተናው ገጽ መውጣት ይቆጠራል፤ መምህሩ ያየዋል።</li>
        </ul>
        {err && <div className="alert error">{err}</div>}
        <button className="btn green big" disabled={busy} onClick={begin}>{busy ? '…' : '▶ ፈተናውን ጀምር'}</button>
      </section>
    );
  }

  if (screen === 'done') {
    return (
      <section className="card exam-intro">
        <div style={{ fontSize: '2.4rem' }}>✅</div>
        <h1 className="serif">ፈተናዎ ገብቷል</h1>
        <p>{autoDone ? 'ሰዓቱ ስላለቀ ያስቀመጧቸው መልሶች በራሳቸው ገብተዋል።' : 'መልሶችዎ ተቀብለናል።'} ውጤቱ መምህሩ ሲልከው በዳሽቦርድዎ ይታያል።</p>
        <a className="btn" href="/student">ወደ ዳሽቦርድ ተመለስ</a>
      </section>
    );
  }

  if (!paper) return null;
  const qs = paper.questions;
  const q = qs[idx];
  const answered = qs.filter((x) => isAnswered(x, answers[x.id])).length;
  const low = remaining < 5 * 60000, critical = remaining < 60000;

  return (
    <div className="exam-run" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <header className="exam-bar">
        <div className="exam-bar-title"><b>{paper.title}</b><span className="small">{paper.course}</span></div>
        <div className="exam-progress" aria-label="የተመለሱ">
          <span style={{ width: `${(answered / Math.max(qs.length, 1)) * 100}%` }} />
          <em>{answered}/{qs.length} ተመልሰዋል</em>
        </div>
        <div className={`exam-clock ${low ? 'low' : ''} ${critical ? 'critical' : ''}`} role="timer" aria-live="off">⏱ {mmss(remaining)}</div>
      </header>
      {awayNote && (
        <div className="alert error small exam-away">
          ⚠ ከፈተናው ገጽ ወጥተዋል ({left} ጊዜ)። ይህ ለመምህሩ ይታያል። <button className="link small" onClick={() => setAwayNote(false)}>እሺ</button>
        </div>
      )}
      {err && <div className="alert error small">{err}</div>}

      {screen === 'q' && q && (
        <div className="exam-body">
          <section className="exam-q card">
            <div className="exam-q-head">
              <span>ጥያቄ <b>{idx + 1}</b> ከ{qs.length} · <span className="pill">{QUESTION_KINDS[q.kind]}</span></span>
              <span className="small"><b>{Number(q.points)}</b> ነጥብ</span>
            </div>
            <div className="exam-prompt">{q.prompt}</div>
            <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
            <div className="exam-nav">
              <button className="btn secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← ቀዳሚ</button>
              <button className={`btn ${flags.includes(q.id) ? 'flag-on' : 'secondary'}`} onClick={() => toggleFlag(q.id)}>
                🚩 {flags.includes(q.id) ? 'ምልክቱን አንሳ' : 'ምልክት አድርግ'}
              </button>
              {idx < qs.length - 1
                ? <button className="btn" onClick={() => { void flush(); setIdx(idx + 1); }}>ቀጣይ →</button>
                : <button className="btn green" onClick={() => { void flush(); setScreen('review'); }}>ገምግምና አስረክብ →</button>}
            </div>
          </section>
          <aside className="exam-map card">
            <div className="small muted" style={{ marginBottom: 6 }}>ጥያቄዎች</div>
            <div className="exam-grid">
              {qs.map((x, i) => (
                <button key={x.id} onClick={() => setIdx(i)} aria-label={`ጥያቄ ${i + 1}`}
                  className={`${i === idx ? 'cur' : ''} ${isAnswered(x, answers[x.id]) ? 'ans' : ''} ${flags.includes(x.id) ? 'flag' : ''}`}>{i + 1}</button>
              ))}
            </div>
            <div className="exam-legend small"><span className="ans" />የተመለሰ <span className="flag" />🚩 <span />ያልተመለሰ</div>
            <button className="btn sm green" style={{ width: '100%', marginTop: 10 }} onClick={() => { void flush(); setScreen('review'); }}>ገምግምና አስረክብ</button>
            <div className={`small save-state ${saveState}`}>
              {saveState === 'saving' ? 'በማስቀመጥ ላይ…' : saveState === 'saved' ? '✓ ተቀምጧል' : saveState === 'offline' ? '⚠ ኢንተርኔት — እንደገና ይሞከራል' : ''}
            </div>
          </aside>
        </div>
      )}

      {screen === 'review' && (
        <section className="card exam-review">
          <h2 style={{ marginTop: 0 }}>ከማስረከብዎ በፊት ይገምግሙ</h2>
          <div className="exam-facts">
            <div><b>{answered}</b>የተመለሱ</div>
            <div className={qs.length - answered ? 'neg' : ''}><b>{qs.length - answered}</b>ያልተመለሱ</div>
            <div><b>{flags.length}</b>🚩 ምልክት</div>
          </div>
          <div className="exam-grid big">
            {qs.map((x, i) => (
              <button key={x.id} onClick={() => { setIdx(i); setScreen('q'); }}
                className={`${isAnswered(x, answers[x.id]) ? 'ans' : ''} ${flags.includes(x.id) ? 'flag' : ''}`}>{i + 1}</button>
            ))}
          </div>
          {(qs.length - answered > 0 || flags.length > 0) && <p className="small muted">ቁጥሩን ሲጫኑ ወደ ጥያቄው ይመለሳሉ።</p>}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn secondary" onClick={() => setScreen('q')}>← ወደ ጥያቄዎቹ ተመለስ</button>
            <button className="btn green" disabled={busy}
              onClick={() => { if (confirm(qs.length - answered ? `${qs.length - answered} ያልተመለሱ ጥያቄዎች አሉ። አሁን ያስረክቡ?` : 'ፈተናውን ያስረክቡ? ከዚያ በኋላ መቀየር አይቻልም።')) void submit(false); }}>
              {busy ? '…' : '📤 አስረክብ'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: Q; value: unknown; onChange: (v: unknown) => void }) {
  if (q.kind === 'choice') {
    const opts = q.options as { i: number; t: string }[];
    return (
      <div className="exam-choices">
        {opts.map((o, k) => (
          <label key={o.i} className={`exam-choice ${value === o.i ? 'on' : ''}`}>
            <input type="radio" name={`q-${q.id}`} checked={value === o.i} onChange={() => onChange(o.i)} />
            <b>{LETTERS[k]}</b><span>{o.t}</span>
          </label>
        ))}
      </div>
    );
  }
  if (q.kind === 'tf') {
    return (
      <div className="exam-tf">
        <button type="button" className={value === true ? 'on' : ''} onClick={() => onChange(true)}>✓ እውነት</button>
        <button type="button" className={value === false ? 'on' : ''} onClick={() => onChange(false)}>✗ ሐሰት</button>
      </div>
    );
  }
  if (q.kind === 'blank') {
    return (
      <input className="exam-blank" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}
        placeholder="መልስዎን እዚህ ይጻፉ" autoComplete="off" spellCheck={false} maxLength={300} />
    );
  }
  const m = q.options as { left: string[]; right: { i: number; t: string }[] };
  const cur = Array.isArray(value) ? (value as (number | null)[]) : m.left.map(() => null);
  return (
    <div className="exam-match">
      <ol className="exam-match-right" type="A">{m.right.map((r) => <li key={r.i}>{r.t}</li>)}</ol>
      {m.left.map((l, k) => (
        <div key={k} className="exam-match-row">
          <span><b>{k + 1}.</b> {l}</span>
          <select value={cur[k] ?? ''} onChange={(e) => { const n = [...cur]; n[k] = e.target.value === '' ? null : Number(e.target.value); onChange(n); }}>
            <option value="">— ይምረጡ —</option>
            {m.right.map((r, j) => <option key={r.i} value={r.i}>{LETTERS[j]}. {r.t}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
