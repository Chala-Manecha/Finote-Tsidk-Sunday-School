import { notFound } from 'next/navigation';
import { AbnetAdmin, type AbnetSearch } from '../../abnet/abnet-admin';
import { CoordinatorBox } from '../../abnet/coordinator-box';

/** ትምህርት ክፍል → አብነት (everything, and choosing the coordinator). */
export default async function EducationAbnet({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<AbnetSearch>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  return (
    <>
      {(!sp.v || sp.v === 'list') && <CoordinatorBox />}
      <AbnetAdmin sp={sp} base="/staff/education/abnet" full />
    </>
  );
}
