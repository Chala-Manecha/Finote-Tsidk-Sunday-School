'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type NavLink = { href: string; label: string; highlight?: boolean; title?: string };
type NavGroup = { label: string; items: NavLink[] };
export type NavEntry = NavLink | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => 'items' in e;

/** Desktop: links + click dropdowns. Phones: ≡ opens a full-width panel (like eotcssu.et). */
export function SiteNav({ items, cta }: { items: NavEntry[]; cta?: NavLink }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null); // open dropdown label
  const [panel, setPanel] = useState(false);              // phone panel
  const [seenPath, setSeenPath] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);

  // Close everything after navigating.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(null);
    setPanel(false);
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setPanel(false); } };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.split('#')[0]) && href !== '/#contact');
  const close = () => { setOpen(null); setPanel(false); };

  const dropdown = (g: NavGroup) => (
    <div className={`nav-drop ${open === g.label ? 'open' : ''}`} key={g.label}>
      <button
        type="button"
        className={`nav-link ${g.items.some((i) => active(i.href)) ? 'active' : ''}`}
        aria-expanded={open === g.label}
        onClick={() => setOpen(open === g.label ? null : g.label)}
      >
        {g.label} <span aria-hidden className="caret">▾</span>
      </button>
      {open === g.label && (
        <div className="nav-menu" role="menu">
          {g.items.map((i) => <Link key={i.href} href={i.href} role="menuitem" onClick={close}>{i.label}</Link>)}
        </div>
      )}
    </div>
  );

  return (
    <div className="site-nav" ref={ref}>
      <nav className="nav-desktop" aria-label="ዋና ማውጫ">
        {items.map((e) => isGroup(e) ? dropdown(e) : (
          <Link key={e.href} href={e.href} className={`nav-link ${e.highlight ? 'highlight' : ''} ${active(e.href) ? 'active' : ''}`}>{e.label}</Link>
        ))}
        {cta && <Link href={cta.href} className="btn nav-cta" title={cta.title}>{cta.label} →</Link>}
      </nav>

      <button type="button" className="nav-burger" aria-label={panel ? 'ማውጫውን ዝጋ' : 'ማውጫ'} aria-expanded={panel} onClick={() => setPanel(!panel)}>
        {panel ? '✕' : '☰'}
      </button>
      {panel && (
        <nav className="nav-panel" aria-label="ዋና ማውጫ">
          {items.map((e) => isGroup(e) ? (
            <div key={e.label} className="nav-panel-group">
              <span>{e.label}</span>
              {e.items.map((i) => <Link key={i.href} href={i.href} onClick={close} className={active(i.href) ? 'active' : ''}>{i.label}</Link>)}
            </div>
          ) : (
            <Link key={e.href} href={e.href} onClick={close} className={`${e.highlight ? 'highlight' : ''} ${active(e.href) ? 'active' : ''}`}>{e.label}</Link>
          ))}
          {cta && (
            <div className="nav-panel-cta">
              <Link href={cta.href} onClick={close} className="btn">{cta.label} →</Link>
              {cta.title && <span className="small muted" style={{ textAlign: 'center' }}>{cta.title}</span>}
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
