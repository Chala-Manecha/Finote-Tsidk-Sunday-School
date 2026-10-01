import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CLASS_LEVELS, classLabel } from '@/lib/education';
import { loadTerms } from '@/lib/edu-data';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { assignClass, enrollAllMembers } from '@/lib/actions/education-admin';

type E = { id: string; member_id: string; class_level: string | null; self_registered: boolean; members: { full_name: string; reg_no: string } | null };

/** ትምህርት ክፍል: who is in which class this academic year. */
export default async function Classes({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ y?: string; c?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'education') notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { years } = await loadTerms(supabase);
  const year = years.find((x) => x.id === sp.y) ?? years.find((x) => x.is_active) ?? years[0];
  if (!year) return <p className="muted">መጀመሪያ “የትምህርት ዘመን” ትር ላይ ዓመቱን ይክፈቱ።</p>;
  const { data } = await supabase.from('enrollments')
    .select('id, member_id, class_level, self_registered, members(full_name, reg_no)').eq('year_id', year.id);
  const all = ((data ?? []) as unknown as E[]).sort((a, b) => (a.members?.full_name ?? '').localeCompare(b.members?.full_name ?? ''));
  const filter = sp.c ?? 'none';
  const rows = filter === 'all' ? all : filter === 'none' ? all.filter((e) => !e.class_level) : all.filter((e) => e.class_level === filter);
  const count = (c: string | null) => all.filter((e) => e.class_level === c).length;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>ክፍሎችና ተማሪዎች — {year.ec_year} ዓ.ም</h2>
      <p className="muted small">ተማሪዎች ራሳቸው ይመዘገባሉ፤ ሁሉንም አባላት በአንድ ጊዜ ማስገባትም ይቻላል። ከዚያ ለእያንዳንዱ ክፍል ይመድቡ።</p>
      <div className="btn-row">
        <ActionButton action={enrollAllMembers.bind(null, year.id)} label="ሁሉንም ንቁ አባላት አስገባ" className="btn sm secondary"
          confirmText={`ያልተመዘገቡ ንቁ አባላት ሁሉ ለ${year.ec_year} ዓ.ም ይግቡ?`} />
      </div>
      <div className="subtabs no-print" style={{ marginTop: 10 }}>
        <a className={`btn sm ${filter === 'none' ? 'green' : 'secondary'}`} href={`?y=${year.id}&c=none`}>ያልተመደቡ ({count(null)})</a>
        {CLASS_LEVELS.map((c) => (
          <a key={c} className={`btn sm ${filter === c ? 'green' : 'secondary'}`} href={`?y=${year.id}&c=${c}`}>{classLabel(c)} ({count(c)})</a>
        ))}
        <a className={`btn sm ${filter === 'all' ? 'green' : 'secondary'}`} href={`?y=${year.id}&c=all`}>ሁሉም ({all.length})</a>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ተማሪ</th><th>ምዝገባ</th><th>ክፍል</th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{e.members?.full_name}<div className="small muted">{e.members?.reg_no}</div></td>
                <td className="small">{e.self_registered ? 'በራሱ' : 'በትምህርት ክፍል'}</td>
                <td>
                  <MediaForm action={assignClass} submitLabel="መድብ" card={false} resetOnSuccess={false}>
                    <input type="hidden" name="id" value={e.id} />
                    <select name="class_level" defaultValue={e.class_level ?? ''} aria-label="ክፍል">
                      <option value="">— ያልተመደበ —</option>
                      {CLASS_LEVELS.map((c) => <option key={c} value={c}>{classLabel(c)}</option>)}
                    </select>
                  </MediaForm>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="muted">የለም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
