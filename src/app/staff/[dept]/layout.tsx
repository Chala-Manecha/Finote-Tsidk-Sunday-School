import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff, canAccess } from '@/lib/auth';
import { DEPT_NAME, isDeptCode } from '@/lib/constants';
import { tabsFor } from '@/lib/dept-tabs';
import { createClient } from '@/lib/supabase/server';
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
  const { data: assignee } = await supabase
    .from('dept_assignees')
    .select('full_name, sex, photo_path, user_id')
    .eq('dept', dept)
    .maybeSingle();

  // Greeting goes to the signed-in person; the assignee photo shows when it's them.
  const sex = staff.sex ?? (assignee?.user_id === staff.userId ? assignee.sex : null);
  const suffix = sex === 'female' ? 'ሽ' : 'ህ';
  const photo =
    assignee?.user_id === staff.userId && assignee.photo_path
      ? supabase.storage.from('media').getPublicUrl(assignee.photo_path).data.publicUrl
      : null;

  return (
    <>
      <div className="crumb no-print">
        <Link href="/staff">ሁሉም ክፍሎች</Link> › {DEPT_NAME[dept]}
      </div>
      <div className="banner no-print">
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
