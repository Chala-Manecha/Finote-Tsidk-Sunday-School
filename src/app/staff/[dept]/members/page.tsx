import { notFound } from 'next/navigation';
import { MemberTable } from '@/components/member-table';
import { isDeptCode } from '@/lib/constants';

export default async function SubMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { dept } = await params;
  if (!isDeptCode(dept)) notFound();
  const filters = await searchParams;
  const isHr = dept === 'hr';

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>
        {isHr ? 'የክፍሉ ንዑሳን (ሁሉም ክፍል)' : 'የክፍሉ ንዑሳን'}
      </h2>
      <MemberTable
        basePath={`/staff/${dept}/members`}
        filters={filters}
        fixedDept={isHr ? undefined : dept}
        linkToDetail={false}
      />
    </>
  );
}
