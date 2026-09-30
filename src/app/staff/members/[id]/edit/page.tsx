import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDept } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MemberForm } from '@/components/member-form';

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDept('hr', 'office');
  const { id } = await params;
  const supabase = await createClient();
  const { data: m } = await supabase
    .from('members')
    .select('*, member_departments(dept)')
    .eq('id', id)
    .maybeSingle();
  if (!m) notFound();
  const photo_url = m.photo_path
    ? (await supabase.storage.from('member-docs').createSignedUrl(m.photo_path, 600)).data?.signedUrl ?? null
    : null;

  return (
    <>
      <div className="crumb">
        <Link href="/staff">ሁሉም ክፍሎች</Link> › <Link href={`/staff/members/${id}`}>{m.full_name}</Link> › አርም
      </div>
      <h1 className="title">የአባል መረጃ አርም</h1>
      <MemberForm
        initial={{ ...m, photo_url, depts: m.member_departments.map((d: { dept: string }) => d.dept) }}
      />
    </>
  );
}
