import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LedgerView } from './ledger-view';
import { UsageView } from './usage-view';
import { createClient } from '@/lib/supabase/server';
import { formatBirr } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { Modal } from '@/components/modal';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { setOpeningBalance } from '@/lib/actions/finance';

/** One money report for ሒሳብና ንብረት and ኦዲት: statement (ገቢ / ወጪ / ቀሪ) and use per department. */
export default async function MoneyReport({ params, searchParams }: {
  params: Promise<{ dept: string }>;
  searchParams: Promise<{ view?: string; p?: string; d?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const view = sp.view === 'usage' ? 'usage' : 'statement';
  const base = `/staff/${dept}/money-report`;
  const supabase = await createClient();
  const { data: w } = await supabase.from('wallet_settings').select('opening_balance, as_of').maybeSingle();
  const opening = Number(w?.opening_balance ?? 0);
  return (
    <>
      <div className="head-row no-print">
        <h2 className="section">የገንዘብ ሪፖርት</h2>
        <div className="cat-tabs">
          <Link href={base} className={view === 'statement' ? 'active' : ''}>ገቢ፣ ወጪ እና ቀሪ ሂሳብ</Link>
          <Link href={`${base}?view=usage`} className={view === 'usage' ? 'active' : ''}>የክፍላት ገንዘብ አጠቃቀም</Link>
        </div>
        <span style={{ flex: 1 }} />
        <span className={`opening-chip ${w?.as_of ? '' : 'missing'}`}>
          መነሻ ሂሳብ፦ <b>{w?.as_of ? formatBirr(opening) : 'አልተመዘገበም'}</b>{w?.as_of && <span className="small"> · ከ{formatEc(w.as_of)}</span>}
        </span>
        {dept === 'finance' && (
          <Modal label={w?.as_of ? '✎ መነሻ ሂሳብ' : '+ መነሻ ሂሳብ አስገባ'} title="መነሻ ሂሳብ (Opening balance)" sub="ክትትል ሲጀመር በሰንበት ት/ቤቱ እጅ የነበረው ገንዘብ" size="sm"
            btnClass={w?.as_of ? 'btn sm secondary' : 'btn sm green'}>
            <MediaForm action={setOpeningBalance} submitLabel="አስቀምጥ" card={false} resetOnSuccess={false}>
              <div className="field"><label>መጠን (ብር)</label><input name="opening_balance" type="number" min={0} step="0.01" defaultValue={opening} required /></div>
              <div className="field"><span className="label">ከዚህ ቀን ጀምሮ (ዓ.ም)</span><EcDatePicker name="as_of" defaultIso={w?.as_of ?? todayIsoAddis()} yearsBack={5} yearsForward={0} required /></div>
            </MediaForm>
          </Modal>
        )}
      </div>
      {view === 'usage' ? <UsageView dept={dept} d={sp.d} /> : <LedgerView dept={dept} sp={sp} />}
    </>
  );
}
