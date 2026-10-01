'use client';
import { useActionState } from 'react';
import type { FormState } from '@/components/media-form';

/** Small "do X with a written reason" form (reject a donation, void a receipt). */
export function ReasonForm({
  action, id, field, button, placeholder,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  id: string; field: string; button: string; placeholder: string;
}) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <details>
      <summary className="btn sm secondary">{button}</summary>
      <form action={run} className="btn-row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
        <input type="hidden" name="id" value={id} />
        <input name={field} placeholder={placeholder} required style={{ minWidth: 200 }} />
        <button className="btn sm danger" disabled={pending}>{pending ? '…' : 'አረጋግጥ'}</button>
        {state.error && <span className="alert error small" style={{ margin: 0 }}>{state.error}</span>}
      </form>
    </details>
  );
}
