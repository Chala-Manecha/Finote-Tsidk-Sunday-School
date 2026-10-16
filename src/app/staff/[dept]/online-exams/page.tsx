import { redirect } from 'next/navigation';

/** Exam approvals now live in “መምህራን” → ፈተናዎች. */
export default async function OnlineExams({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  redirect(`/staff/${dept}/courses?v=exams`);
}
