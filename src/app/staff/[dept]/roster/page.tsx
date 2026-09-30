import { notFound } from 'next/navigation';
import { MemberTable } from '@/components/member-table';

export default async function OfficeRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የአባላት ዝርዝር</h2>
      <MemberTable basePath="/staff/office/roster" filters={await searchParams} linkToDetail />
    </>
  );
}
