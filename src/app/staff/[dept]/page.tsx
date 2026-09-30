import { redirect, notFound } from 'next/navigation';
import { isDeptCode } from '@/lib/constants';
import { tabsFor } from '@/lib/dept-tabs';

export default async function DeptIndex({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (!isDeptCode(dept)) notFound();
  const first = tabsFor(dept).find((t) => t.ready);
  if (!first) return <div className="card">ይህ ክፍል ገና አልተዘጋጀም።</div>;
  redirect(`/staff/${dept}/${first.slug}`);
}
