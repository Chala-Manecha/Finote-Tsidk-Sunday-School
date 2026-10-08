'use client';
import { useEffect } from 'react';

/** Fades `.reveal` sections in as they scroll into view (no-op without JS or with reduced motion). */
export function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.remove('pending'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -40px 0px' });
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) continue; // already visible: never hide it
      el.classList.add('pending');
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}
