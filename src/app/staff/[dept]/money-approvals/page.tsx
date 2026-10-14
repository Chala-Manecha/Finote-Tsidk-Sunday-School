import { notFound, redirect } from 'next/navigation';

/** Moved into ጽሕፈት ቤት's የገንዘብ አስተዳደር. */
export default async function Moved({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office') notFound();
  redirect('/staff/office/money?view=approvals');
}
