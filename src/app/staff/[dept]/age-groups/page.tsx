import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MediaForm } from '@/components/media-form';
import { saveAgeGroups } from '@/lib/actions/age-groups';

type G = { code: string; name: string; min_age: number; max_age: number | null };

/** HR: age ranges for ሕፃናት / ማዕከላዊ / ወጣት ክፍል and how many members are in each. */
export default async function AgeGroups({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'hr') notFound();
  const supabase = await createClient();
  const [{ data }, { data: members }] = await Promise.all([
    supabase.from('age_groups').select('code, name, min_age, max_age').order('sort'),
    supabase.from('members').select('age_group').eq('is_active', true),
  ]);
  const groups = (data ?? []) as G[];
  const count = (c: string | null) => (members ?? []).filter((m) => m.age_group === c).length;

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የዕድሜ ክፍሎች</h2>
      <p className="muted small">ዕድሜው በሙሉ ዓመት ነው፤ “እስከ” ባዶ ከሆነ ከዚያ በላይ ያሉ ሁሉ። “አስቀምጥና ተግብር” ሲጫን ሁሉም አባላት እንደ ዕድሜያቸው እንደገና ይመደባሉ (አዲስ አባላት በምዝገባ ጊዜ በራሳቸው ይመደባሉ)። ዕድሜ በየዓመቱ ስለሚቀየር በዓመቱ መጀመሪያ እንደገና ይተግብሩ።</p>
      <div className="stat-cards">
        {groups.map((g) => (
          <Link key={g.code} className="stat-card" href={`/staff/hr/members?group=${g.code}`}><b>{count(g.code)}</b>{g.name}</Link>
        ))}
        <Link className="stat-card" href="/staff/hr/members?group=none"><b>{count(null)}</b>ያልተመደቡ</Link>
      </div>
      <div style={{ marginTop: 16 }}>
        <MediaForm action={saveAgeGroups} submitLabel="አስቀምጥና ተግብር" resetOnSuccess={false}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ክፍል</th><th>ከ (ዓመት)</th><th>እስከ (ዓመት)</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.code}>
                    <td><input type="hidden" name="code" value={g.code} /><input name={`name_${g.code}`} defaultValue={g.name} required aria-label="ስም" /></td>
                    <td><input name={`min_${g.code}`} type="number" min={0} max={120} defaultValue={g.min_age} required style={{ width: 90 }} aria-label="ከ" /></td>
                    <td><input name={`max_${g.code}`} type="number" min={0} max={120} defaultValue={g.max_age ?? ''} placeholder="በላይ" style={{ width: 90 }} aria-label="እስከ" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MediaForm>
      </div>
    </>
  );
}
