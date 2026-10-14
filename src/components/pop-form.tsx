'use client';
import { useRef } from 'react';
import { MediaForm } from './media-form';
import type { FormState } from './media-form';

/** A button that opens a small form; the pop-up closes itself once the save succeeds. */
export function PopForm({ label, action, submitLabel, children }: {
  label: string; action: (s: FormState, fd: FormData) => Promise<FormState>; submitLabel: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details className="pop" ref={ref}>
      <summary className="btn sm green">{label}</summary>
      <div className="pop-body">
        <MediaForm action={action} submitLabel={submitLabel} card={false} onSaved={() => { if (ref.current) ref.current.open = false; }}>
          {children}
        </MediaForm>
      </div>
    </details>
  );
}
