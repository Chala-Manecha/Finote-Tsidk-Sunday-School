'use client';
import { useEffect, useState } from 'react';
import type { Greeting } from '@/lib/greetings';

const BUBBLES = { birthday: ['🎈', '🎉', '🎂', '🎁', '🎈', '✨', '🎊', '🎈'], holiday: ['✨', '🕊️', '🌼', '✝️', '🌿', '✨', '🕯️', '🌼'] } as const;

/** Under the school name: today's feast and birthday greetings, one at a time, with emojis bubbling up. */
export function TodayGreeting({ items }: { items: Greeting[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);
  if (items.length === 0) return null;
  const g = items[i % items.length];
  return (
    <div className={`today-greet ${g.kind}`} role="status" aria-live="polite">
      <span className="tg-bubbles" aria-hidden>
        {BUBBLES[g.kind].map((e, n) => <span key={`${i}-${n}`} style={{ left: `${6 + n * 12}%`, animationDelay: `${(n % 4) * 0.7 + n * 0.15}s` }}>{e}</span>)}
      </span>
      <p key={i} className="tg-text">{g.text}</p>
      {items.length > 1 && (
        <span className="tg-dots" aria-hidden>
          {items.map((_, n) => <button key={n} type="button" className={n === i % items.length ? 'on' : ''} onClick={() => setI(n)} tabIndex={-1} />)}
        </span>
      )}
    </div>
  );
}
