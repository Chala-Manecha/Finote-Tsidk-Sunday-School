'use client';
import { useEffect, useRef } from 'react';

/** Drop inside a GET filter form: changing a select / tick box applies the filter at once (no “አሳይ” click). */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const on = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio') form.requestSubmit();
    };
    form.addEventListener('change', on);
    return () => form.removeEventListener('change', on);
  }, []);
  return <span ref={ref} hidden />;
}
