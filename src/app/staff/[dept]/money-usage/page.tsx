import { notFound } from 'next/navigation';
import { UsageView } from '../money-report/usage-view';
import { PrintButton } from '@/components/print-button';

/** ሒሳብና ንብረት and ኦዲት: how each department used money. */
export default async function MoneyUsage({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ d?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance' && dept !== 'audit') notFound();
  const { d } = await searchParams;
  return (
    <>
      <div className="page-bar no-print"><h2 className="section" style={{ margin: 0 }}>የክፍላት ገንዘብ አጠቃቀም</h2>{!d && <><span className="spacer" /><PrintButton /></>}</div>
      <UsageView dept={dept} d={d} />
    </>
  );
}
