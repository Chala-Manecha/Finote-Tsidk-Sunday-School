import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDept } from '@/lib/auth';
import { THANKSGIVING, classLabel, type YearRow } from '@/lib/education';
import { DocHeader, DocSigns } from '@/components/doc-sheet';
import { DocPrintButton } from '@/components/doc-print-button';

const PLACE = ['አንደኛ', 'ሁለተኛ', 'ሦስተኛ'];

/** Honour certificate for the top 3 of a class at year end. */
export default async function Honour({ params }: { params: Promise<{ yearId: string; memberId: string }> }) {
  const { yearId, memberId } = await params;
  await requireDept('education');
  const supabase = await createClient();
  const [{ data: yr }, { data: enr }] = await Promise.all([
    supabase.from('academic_years').select('ec_year').eq('id', yearId).single(),
    supabase.from('enrollments').select('class_level').eq('year_id', yearId).eq('member_id', memberId).single(),
  ]);
  if (!yr || !enr?.class_level) notFound();
  const { data } = await supabase.rpc('year_results', { p_year: yearId, p_class: enr.class_level });
  const r = ((data ?? []) as YearRow[]).find((x) => x.member_id === memberId);
  if (!r || !r.ready || !r.rank || r.rank > 3) notFound();

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href={`/staff/education/year-end?y=${yearId}&c=${enr.class_level}`}>← ተመለስ</Link>
        <DocPrintButton />
      </div>
      <article className="doc-sheet honour">
        <DocHeader title="የክብር ሰርተፍኬት" code={`${yr.ec_year} ዓ.ም`} />
        <div style={{ textAlign: 'center', padding: '18px 10px' }}>
          <p className="serif" style={{ fontSize: '1.1rem', color: '#7A1F2B' }}>{THANKSGIVING}</p>
          <p style={{ fontSize: '1rem' }}>ይህ የክብር ሰርተፍኬት</p>
          <p className="serif" style={{ fontSize: '1.9rem', fontWeight: 700, margin: '6px 0' }}>{r.full_name}</p>
          <p className="small muted">{r.reg_no}</p>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.9 }}>
            በ{yr.ec_year} ዓ.ም የትምህርት ዘመን በ<b>{classLabel(enr.class_level)}</b> ከ{r.class_size} ተማሪዎች
            የዓመት አማካይ <b>{r.year_average}</b> በማምጣት <b>{PLACE[r.rank - 1]} ደረጃ</b> በመውጣታቸው ተሰጥቷቸዋል።
          </p>
          <p className="serif" style={{ fontSize: '3rem', margin: '4px 0' }}>{['🥇', '🥈', '🥉'][r.rank - 1]}</p>
          <p className="small">“የጥበብ መጀመሪያ እግዚአብሔርን መፍራት ነው።” (ምሳሌ 9፥10)</p>
        </div>
        <div className="doc-foot">
          <DocSigns roles={['የትምህርት ክፍል ኃላፊ', 'የሰንበት ትምህርት ቤቱ ሰብሳቢ']} />
          <div className="doc-stamp">ማኅተም</div>
        </div>
      </article>
    </>
  );
}
