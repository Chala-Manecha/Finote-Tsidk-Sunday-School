import Link from 'next/link';
import { CHURCH_NAME, FOUNDED_EC, SCHOOL_NAME } from '@/lib/constants';
import { todayEc } from '@/lib/ethiopian-calendar';

/** Running anniversary year, counted from FOUNDED_EC (the 19th year runs ሐምሌ 29, 2018 → ሐምሌ 29, 2019). */
export function anniversaryYear(today = todayEc()): number {
  const passed = today.month > FOUNDED_EC.month || (today.month === FOUNDED_EC.month && today.day >= FOUNDED_EC.day);
  return today.year - FOUNDED_EC.year + (passed ? 1 : 0);
}

/** Logo + names; the home button on every top bar. */
export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label={`${SCHOOL_NAME} — ዋና ገጽ`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-192.png" alt="" width={44} height={44} className="brand-logo" />
      <span className="brand-text">
        <span className="brand-name">
          {SCHOOL_NAME} <span className="anniv">{anniversaryYear()}ኛ ምሥረታ</span>
        </span>
        <span className="brand-church">{CHURCH_NAME}</span>
      </span>
    </Link>
  );
}
