'use client';
import { useActionState, useRef } from 'react';
type FormState = { error?: string; ok?: string };

/** ጠባይ: a small select that saves itself on change (no ✓ button). */
export function ConductSelect({ action, semesterId, memberId, value, options }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  semesterId: string; memberId: string; value: string; options: [string, string][];
}) {
  const [state, run, pending] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={run} className="conduct-pick">
      <input type="hidden" name="semester_id" value={semesterId} />
      <input type="hidden" name="member_id" value={memberId} />
      <select name="conduct" defaultValue={value} aria-label="ጠባይ" title={state?.error ?? ''}
        onChange={() => ref.current?.requestSubmit()} disabled={pending}>
        <option value="">—</option>
        {options.map(([k, v]) => <option key={k} value={k} title={v}>{k}</option>)}
      </select>
      <span className={`conduct-mark ${state?.error ? 'neg' : ''}`} aria-live="polite">{pending ? '…' : state?.error ? '!' : state?.ok ? '✓' : ''}</span>
    </form>
  );
}
