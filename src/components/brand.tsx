import Link from 'next/link';
import { FOUNDED_EC, SCHOOL_NAME } from '@/lib/constants';
import { todayEc } from '@/lib/ethiopian-calendar';

/** Running anniversary year: the 16th year starts on ግንቦት 13, 2018 and runs until ግንቦት 13, 2019. */
export function anniversaryYear(today = todayEc()): number {
  const passed = today.month > FOUNDED_EC.month || (today.month === FOUNDED_EC.month && today.day >= FOUNDED_EC.day);
  return today.year - FOUNDED_EC.year + (passed ? 1 : 0);
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand">
      {SCHOOL_NAME} <span className="anniv">({anniversaryYear()}ኛ ምሥረታ አመት)</span>
    </Link>
  );
}
