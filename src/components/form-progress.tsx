'use client';
import { useEffect, useRef, useState } from 'react';

/** A sticky progress bar for a long form: how many of its required fields are filled. */
export function FormProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ done: 0, total: 0 });
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const count = () => {
      const seen = new Set<string>();
      let done = 0, total = 0;
      for (const el of Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input[required], select[required], textarea[required]'))) {
        if (el.disabled || el.type === 'hidden') continue;
        if (el.type === 'radio') { if (seen.has(el.name)) continue; seen.add(el.name); }
        total += 1;
        if (el.validity.valid) done += 1;
      }
      setSt({ done, total });
    };
    count();
    form.addEventListener('input', count);
    form.addEventListener('change', count);
    const mo = new MutationObserver(count);
    mo.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['required', 'disabled'] });
    return () => { form.removeEventListener('input', count); form.removeEventListener('change', count); mo.disconnect(); };
  }, []);
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  return (
    <div ref={ref} className="form-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="የቅጹ ሂደት">
      <div className="fp-text">
        <b>{pct === 100 ? '✓ ሁሉም አስፈላጊ መረጃዎች ተሞልተዋል' : 'የቅጹ ሂደት'}</b>
        <span>{st.done}/{st.total} · {pct}%</span>
      </div>
      <div className="fp-track"><span style={{ width: `${pct}%` }} className={pct === 100 ? 'full' : ''} /></div>
    </div>
  );
}
