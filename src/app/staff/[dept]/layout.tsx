import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff, canAccess } from '@/lib/auth';
import { DEPT_NAME, isDeptCode } from '@/lib/constants';
import { tabsFor } from '@/lib/dept-tabs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TabNav } from './tab-nav';

export default async function DeptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dept: string }>;
}) {
  const { dept } = await params;
  if (!isDeptCode(dept)) notFound();
  const staff = await requireStaff();
  if (!canAccess(staff, dept)) notFound();

  const supabase = await createClient();
  const [{ data: assignee }, { data: myMemberId }] = await Promise.all([
    supabase.from('dept_assignees').select('sex, member_id').eq('dept', dept).maybeSingle(),
    supabase.rpc('current_member_id'),
  ]);

  // The head's registration photo shows when the head is the one signed in.
  const isHead = !!assignee?.member_id && assignee.member_id === myMemberId;
  const sex = staff.sex ?? (isHead ? assignee!.sex : null);
  const suffix = sex === 'female' ? 'ሽ' : 'ህ';
  let photo: string | null = null;
  if (isHead) {
    const admin = createAdminClient();
    const { data: m } = await admin.from('members').select('photo_path').eq('id', assignee!.member_id).maybeSingle();
    if (m?.photo_path) photo = (await admin.storage.from('member-docs').createSignedUrl(m.photo_path, 3600)).data?.signedUrl ?? null;
  }

  return (
    <>
      <div className="crumb no-print">
        <Link href="/staff">ሁሉም ክፍሎች</Link> › {DEPT_NAME[dept]}
      </div>
      <div className="banner no-print">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" />}
        <div>
          <div className="serif">
            ውድ {staff.fullName} እንኳን ወደ {DEPT_NAME[dept]} በሰላም መጣ{suffix}።
          </div>
          <div className="verse">
            ዮሐ(21:16) የዮና ልጅ ስምዖን ሆይ ትወደኛለህን? እንኪያስ ጠቦቶቼን ጠብቅ።
          </div>
        </div>
      </div>
      <div className="dept-tabs">
        <TabNav dept={dept} tabs={tabsFor(dept)} />
        <section className="dept-tab-content">{children}</section>
      </div>
    </>
  );
}
