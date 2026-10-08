import { Brand } from '@/components/brand';
import { SiteNav, type NavEntry } from '@/components/site-nav';
import { createClient } from '@/lib/supabase/server';
import { termLabel, type Term } from '@/lib/periods';

// Public top nav, grouped like eotcssu.et (dropdowns on desktop, ≡ panel on phones).
const NAV: NavEntry[] = [
  { href: '/', label: 'ዋና ገጽ' },
  {
    label: 'ትምህርት',
    items: [
      { href: '/course', label: 'ኮርስ' },
      { href: '/abnet', label: 'አብነት' },
      { href: '/zema', label: 'ዜማ' },
    ],
  },
  {
    label: 'ስለ እኛ',
    items: [
      { href: '/history', label: 'ታሪካችን' },
      { href: '/departments', label: 'ክፍሎቻችን' },
      { href: '/mahiberat', label: 'ማኅበራት' },
      { href: '/prayer', label: 'የጸሎት መርኀ ግብራት' },
      { href: '/roster', label: 'የአባላት ምደባ' },
    ],
  },
  { href: '/shop', label: 'ለመግዛት' },
  { href: '/feedback', label: 'አስተያየት' },
  { href: '/#contact', label: 'ያግኙን' },
  { href: '/donate', label: 'ለመርዳት', highlight: true },
];

/** The staff-entry item shows the active leadership team; changes when ጽሕፈት ቤት activates a new one. */
export async function PublicHeader() {
  const supabase = await createClient();
  const [{ data }, { data: open }] = await Promise.all([
    supabase.from('leadership_terms').select('name, team_no').eq('is_active', true).maybeSingle(),
    supabase.rpc('registration_is_open'),
  ]);
  const team = data as Pick<Term, 'name' | 'team_no'> | null;
  const items: NavEntry[] = open ? [{ href: '/register', label: 'ይመዝገቡ', highlight: true }, ...NAV] : NAV;
  return (
    <>
      <header className="topbar site-header">
        <Brand />
        <SiteNav items={items} cta={{ href: '/login', label: 'መግቢያ', title: team ? `አመራሮች፦ ${termLabel(team)}` : undefined }} />
      </header>
      {open && (
        <a href="/register" className="register-strip">📝 የአባልነት ምዝገባ ክፍት ነው — አሁኑኑ ይመዝገቡ →</a>
      )}
    </>
  );
}

/** Kept for the pages that render it; the address now lives in SiteFooter. */
export function PublicFooter() {
  return null;
}
