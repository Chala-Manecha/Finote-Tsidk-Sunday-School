'use client';
import { useTransition } from 'react';

/** Counts the print (first = original, later = ቅጂ), then opens the print dialog. */
export function DocPrintButton({ action, label = '🖨 አትም / PDF አውርድ' }: { action?: () => Promise<unknown>; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn no-print" disabled={pending}
      onClick={() => start(async () => { window.print(); if (action) await action(); })}>
      {pending ? '…' : label}
    </button>
  );
}
