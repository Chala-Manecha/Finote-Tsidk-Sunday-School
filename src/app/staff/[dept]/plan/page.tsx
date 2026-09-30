import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MediaForm } from '@/components/media-form';
import { PrintButton } from '@/components/print-button';
import {
  PlanFields, PlanTable, CourseSessionFields, CourseSessionTable, type Plan, type CourseSession,
} from '@/components/education-views';
import { savePlan, saveCourseSession } from '@/lib/actions/education';

export default async function EducationPlan({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const supabase = await createClient();
  const [{ data: plan }, { data: sessions }] = await Promise.all([
    supabase.from('edu_plan').select('*').order('start_date', { nullsFirst: false }),
    supabase.from('course_sessions').select('id, name, class_name, teacher, days').order('name'),
  ]);
  return (
    <>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="section" style={{ margin: 0 }}>የአመቱ ዕቅድ</h2>
        <PrintButton />
      </div>
      <details className="no-print">
        <summary className="btn sm" style={{ display: 'inline-flex' }}>+ ኮርስ ጨምር</summary>
        <div style={{ marginTop: 10 }}><MediaForm action={savePlan} submitLabel="+ ጨምር"><PlanFields /></MediaForm></div>
      </details>
      <PlanTable rows={(plan ?? []) as Plan[]} editable />

      <h2 className="section">ኮርስ — ቀጣይ ቀጠሮዎች</h2>
      <details className="no-print">
        <summary className="btn sm" style={{ display: 'inline-flex' }}>+ ቀጠሮ ጨምር</summary>
        <div style={{ marginTop: 10 }}><MediaForm action={saveCourseSession} submitLabel="+ ጨምር"><CourseSessionFields /></MediaForm></div>
      </details>
      <CourseSessionTable rows={(sessions ?? []) as CourseSession[]} editable />
    </>
  );
}
