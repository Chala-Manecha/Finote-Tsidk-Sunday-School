import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PlanTable, CourseSessionTable, type Plan, type CourseSession } from '@/components/education-views';
import { PublicHeader, PublicFooter } from '@/components/public-header';

export const metadata: Metadata = { title: 'ኮርስ' };

export default async function CoursePage() {
  const supabase = await createClient();
  const [{ data: plan }, { data: sessions }] = await Promise.all([
    supabase.from('edu_plan').select('*').order('start_date', { nullsFirst: false }),
    supabase.from('course_sessions').select('id, name, class_name, teacher, days').order('name'),
  ]);
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ኮርስ</h1>
        <p className="muted">በቤተክርስቲያናችን የሚሰጡትን ኮርሶችን እዚህ ያገኛሉ።</p>
        <h2 className="section">የአመቱ ዕቅድ</h2>
        <PlanTable rows={(plan ?? []) as Plan[]} />
        <h2 className="section">ቀጣይ ቀጠሮዎች</h2>
        <CourseSessionTable rows={(sessions ?? []) as CourseSession[]} />
        <PublicFooter />
      </main>
    </>
  );
}
