'use client';
import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Drop inside a GET filter form: changing a select / tick box applies the filter at once, and the
 * form moves to the new address in place (no full page reload, the scroll position stays).
 */
export function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const go = () => {
      const params = new URLSearchParams();
      for (const [k, v] of new FormData(form)) if (typeof v === 'string' && v !== '') params.append(k, v);
      const action = form.getAttribute('action') || window.location.pathname;
      const url = `${action.split('?')[0]}${params.size ? `?${params}` : ''}`;
      start(() => router.push(url, { scroll: false }));
    };
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio' || t.type === 'hidden') go();
    };
    const onSubmit = (e: Event) => { e.preventDefault(); go(); };
    form.addEventListener('change', onChange);
    form.addEventListener('submit', onSubmit);
    return () => { form.removeEventListener('change', onChange); form.removeEventListener('submit', onSubmit); };
  }, [router]);
  return <span ref={ref} hidden data-pending={pending ? '1' : undefined} />;
}
