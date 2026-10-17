'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ModalCtx = createContext<{ close: () => void } | null>(null);
/** Forms inside a Modal call this after a successful save to close it. */
export const useModalClose = () => useContext(ModalCtx)?.close;

/** A button that opens a centred dialog (title, body); Esc / outside click / × close it. */
export function Modal({ label, title, sub, btnClass = 'btn sm green', size = 'md', defaultOpen = false, children }: {
  label: React.ReactNode; title: string; sub?: string; btnClass?: string; size?: 'sm' | 'md' | 'lg';
  /** open at once (e.g. arriving from a link that asked for this form) */
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button type="button" className={btnClass} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="xmodal-back no-print" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className={`xmodal size-${size}`}>
            <div className="xmodal-head">
              <div><h2>{title}</h2>{sub && <span className="small muted">{sub}</span>}</div>
              <button type="button" className="xmodal-x" onClick={close} aria-label="ዝጋ">×</button>
            </div>
            <div className="xmodal-body"><ModalCtx.Provider value={{ close }}>{children}</ModalCtx.Provider></div>
          </div>
        </div>
      )}
    </>
  );
}
