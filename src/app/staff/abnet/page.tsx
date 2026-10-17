import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { EC_MONTHS, WEEKDAYS_AM, isoToEc, todayIsoAddis, weekdayOf } from '@/lib/ethiopian-calendar';
import { AbnetAdmin, type AbnetSearch } from './abnet-admin';

export const metadata: Metadata = { title: 'አብነት' };

/** The አብነት coordinator's own page (ትምህርት ክፍል uses /staff/education/abnet). */
export default async function AbnetCoordinatorPage({ searchParams }: { searchParams: Promise<AbnetSearch> }) {
  const staff = await requireStaff();
  if (!staff.abnet) notFound();
  const sp = await searchParams;
  const today = todayIsoAddis();
  const ec = isoToEc(today);
  return (
    <>
      <div className="banner no-print">
        <div>
          <div className="serif">ውድ {staff.fullName} እንኳን ወደ አብነት በሰላም መጣ{staff.sex === 'female' ? 'ሽ' : 'ህ'}።</div>
          <div className="verse">{staff.isAdmin || staff.depts.includes('education') ? 'አብነት — ትምህርት ክፍል' : 'የአብነት አስተባባሪ'}</div>
        </div>
        <div className="banner-date" title="የዛሬ ቀን">
          <b>{WEEKDAYS_AM[weekdayOf(today)]}</b>
          <span>{EC_MONTHS[ec.month - 1]} {ec.day}፣ {ec.year} ዓ.ም</span>
        </div>
      </div>
      <AbnetAdmin sp={sp} base="/staff/abnet" full={false} />
    </>
  );
}
