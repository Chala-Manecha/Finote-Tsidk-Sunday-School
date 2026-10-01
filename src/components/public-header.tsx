import Link from 'next/link';
import { Brand } from '@/components/brand';
import { createClient } from '@/lib/supabase/server';
import { termLabel, type Term } from '@/lib/periods';

// Public top nav. Items appear here as each public page is built.
const NAV = [
  { href: '/course', label: 'ኮርስ' },
  { href: '/abnet', label: 'አብነት' },
  { href: '/zema', label: 'ዜማ' },
  { href: '/history', label: 'ታሪካችን' },
  { href: '/roster', label: 'የአባላት ምደባ' },
  { href: '/mahiberat', label: 'ማኅበራት' },
  { href: '/prayer', label: 'የጸሎት መርኀ ግብራት' },
  { href: '/departments', label: 'ክፍሎቻችን' },
  { href: '/shop', label: 'ለመግዛት' },
  { href: '/donate', label: 'ለመርዳት' },
  { href: '/feedback', label: 'አስተያየት ለመስጠት' },
];

/** Staff-entry button shows the active leadership team; changes when ጽሕፈት ቤት activates a new one. */
export async function PublicHeader() {
  const supabase = await createClient();
  const { data } = await supabase.from('leadership_terms').select('name, team_no').eq('is_active', true).maybeSingle();
  const team = data as Pick<Term, 'name' | 'team_no'> | null;
  return (
    <header className="topbar">
      <Brand />
      <span className="spacer" />
      <nav>
        {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        <Link href="/staff" className="staff-link">{team ? `አመራሮች (${termLabel(team)})` : 'አመራሮች'}</Link>
      </nav>
    </header>
  );
}

/** Kept for the pages that render it; the address now lives in the fixed SiteFooter. */
export function PublicFooter() {
  return null;
}
