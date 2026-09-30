import Link from 'next/link';
import { SCHOOL_NAME } from '@/lib/constants';

// Public top nav. Items appear here as each public page is built.
const NAV = [
  { href: '/zema', label: 'ዜማ' },
  { href: '/roster', label: 'የአባላት ምደባ' },
];

export function PublicHeader() {
  return (
    <header className="topbar">
      <Link href="/" className="brand">{SCHOOL_NAME}</Link>
      <span className="spacer" />
      <nav>
        {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        <Link href="/staff" className="staff-link">ሁሉም ክፍሎች (9)</Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <p className="muted small" style={{ marginTop: 40 }}>
      አቃቂ ቃሊቲ, ወረዳ-1, ደብረ ጽጌ ቅዱስ ሩፋኤል ቤተክርስቲያን, ኢትዮጵያ · Telegram @make_living
    </p>
  );
}
