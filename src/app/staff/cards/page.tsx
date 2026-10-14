import Link from 'next/link';
import QRCode from 'qrcode';
import { headers } from 'next/headers';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, isDeptCode, memberTypeLabel, SEX } from '@/lib/constants';
import { classLabel } from '@/lib/education';
import { formatEc } from '@/lib/ethiopian-calendar';
import { filtersFrom, loadMembers, photoUrls } from '@/lib/member-load';
import { CardStudio, type CardPerson } from '@/components/card-studio';

/** Member ID cards (85.6 × 54 mm), 10 per A4 page — for the ticked members, a filter, or a department. */
export default async function Cards({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const ids = Array.isArray(sp.ids) ? (sp.ids as string[]) : one('ids') ? one('ids').split(',') : [];
  const scope = (['all', 'filtered', 'selected'] as const).find((x) => x === one('scope')) ?? (ids.length ? 'selected' : 'filtered');
  const dept = isDeptCode(one('dept')) ? one('dept') : undefined;
  const supabase = await createClient();
  const rows = await loadMembers(supabase, { scope, filters: filtersFrom(sp), dept, ids, limit: 500 });
  const [photos, { data: year }] = await Promise.all([
    photoUrls(supabase, rows.map((r) => r.photo_path)),
    supabase.from('academic_years').select('id, ec_year').eq('is_active', true).maybeSingle(),
  ]);
  const { data: enr } = year && rows.length
    ? await supabase.from('enrollments').select('member_id, class_level').eq('year_id', year.id).in('member_id', rows.map((r) => r.id))
    : { data: [] };
  const cls = new Map((enr ?? []).map((e) => [e.member_id as string, e.class_level as string | null]));
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;

  const people: CardPerson[] = await Promise.all(rows.map(async (m) => ({
    id: m.id,
    name: m.full_name,
    christianName: (m.christian_name as string | null) ?? '',
    regNo: m.reg_no,
    sex: SEX[m.sex] ?? '',
    cls: cls.get(m.id) ? classLabel(cls.get(m.id)!) : '',
    type: memberTypeLabel(m.member_type as string, m.member_type_other as string | null),
    depts: m.depts.map((d) => DEPT_NAME[d]).join('፣ '),
    registered: m.registered_on ? formatEc(m.registered_on as string) : '',
    photo: m.photo_path ? photos.get(m.photo_path) ?? null : null,
    qr: await QRCode.toString(`${origin}/verify?c=${encodeURIComponent(m.reg_no)}`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
  })));

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <Link className="link small" href="/staff">← ሁሉም ክፍሎች</Link>
        <span className="small muted">{people.length} መታወቂያዎች{rows.length >= 500 ? ' (ቢበዛ 500 በአንድ ጊዜ)' : ''}</span>
      </div>
      <CardStudio people={people} year={year?.ec_year ?? null} />
    </>
  );
}
