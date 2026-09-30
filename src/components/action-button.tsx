'use client';
import { useState, useTransition } from 'react';

export type ActionResult = { error?: string } | void;

/** Button that runs a server action, with optional confirm and inline error. */
export function ActionButton({
  action,
  label,
  pendingLabel = '…',
  confirmText,
  className = 'btn sm',
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  confirmText?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const res = await action();
            if (res && res.error) setError(res.error);
          });
        }}
      >
        {pending ? pendingLabel : label}
      </button>
      {error && <span className="alert error small" style={{ margin: '0 6px' }}>{error}</span>}
    </>
  );
}
