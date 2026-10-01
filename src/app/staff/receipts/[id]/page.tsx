import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff, canAccess } from '@/lib/auth';
import { DEPT_NAME, DONATION_METHOD, formatBirr, type DonationMethod } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { birrInWords } from '@/lib/amharic-number';
import { termLabel } from '@/lib/periods';
import { DocHeader, DocRows, DocSigns, QrCode, verifyUrl } from '@/components/doc-sheet';
import { DocPrintButton } from '@/components/doc-print-button';
import { markReceiptPrinted } from '@/lib/actions/receipts';
import { RECEIPT_COLS } from '@/lib/receipts';


const gc = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Addis_Ababa', day: '2-digit', month: 'short', year: 'numeric' });

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data: r } = await supabase.from('receipts').select(RECEIPT_COLS).eq('id', id).maybeSingle();
  if (!r) notFound();

  const [{ data: people }, { data: term }] = await Promise.all([
    supabase.from('staff_profiles').select('user_id, full_name').in('user_id', [r.verified_by, r.issued_by].filter(Boolean)),
    r.term_id ? supabase.from('leadership_terms').select('name, team_no').eq('id', r.term_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const nameOf = (u: string | null) => people?.find((p) => p.user_id === u)?.full_name ?? '—';
  const isDonation = r.kind === 'donation';
  const isFinance = canAccess(staff, 'finance');
  const back = isFinance ? '/staff/finance/receipts' : r.dept ? `/staff/${r.dept}/money?view=earn` : '/staff';
  const mark = r.voided_at ? 'ተሰርዟል' : r.print_count > 0 ? 'ቅጂ (COPY)' : null;

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href={back}>← ተመለስ</Link>
        {!r.voided_at && <DocPrintButton action={markReceiptPrinted.bind(null, r.id)} />}
      </div>
      {!isDonation && !isFinance && !r.voided_at && (
        <p className="alert ok no-print">ደረሰኙን አትመው <b>ለማኅተም ወደ ሒሳብና ንብረት ይሂዱ</b>።</p>
      )}
      {r.voided_at && <p className="alert error no-print">ይህ ደረሰኝ ተሰርዟል፦ {r.void_reason}</p>}

      <article className="doc-sheet">
        {r.voided_at && <div className="doc-void"><span>ተሰርዟል</span></div>}
        <DocHeader title={isDonation ? 'የእርዳታ መቀበያ ደረሰኝ' : 'የገቢ መቀበያ ደረሰኝ'} code={r.code} mark={mark} />
        <DocRows rows={[
          ['የተቀበልነው ከ', r.payer_name],
          ['ስልክ', r.payer_phone ?? '—'],
          ['የገንዘቡ ቀን', `${formatEc(r.received_on)} (${gc(r.received_on)})`],
          ['ደረሰኝ የተሰጠበት', `${formatEc(r.issued_at)} (${gc(r.issued_at)})`],
          ['ክፍል', r.dept ? DEPT_NAME[r.dept] : 'አጠቃላይ እርዳታ'],
          ['የክፍያ መንገድ', r.method ? DONATION_METHOD[r.method as DonationMethod] ?? r.method : 'በጥሬ ገንዘብ'],
          ['የግብይት ቁጥር', r.txn_ref ?? '—'],
          ['ገንዘቡ የገባበት ሂሳብ', r.account_label ?? 'ሒሳብና ንብረት'],
          ['ምክንያት', r.purpose ?? '—'],
          ['የአመራር ቡድን', term ? termLabel(term) : '—'],
        ]} />
        <div className="doc-amount">
          <div><div className="small muted">በፊደል</div>{birrInWords(r.amount)}</div>
          <b>{formatBirr(r.amount)}</b>
        </div>
        <DocRows rows={[
          ['ያረጋገጠው', `${nameOf(r.verified_by)} (ሒሳብና ንብረት)`],
          ['የሰጠው', `${nameOf(r.issued_by)} (ሒሳብና ንብረት)`],
        ]} />
        <div className="doc-foot">
          <DocSigns roles={['ገንዘብ ተቀባይ (ሒሳብና ንብረት)']} />
          <div className="doc-stamp">ማኅተም</div>
          <div style={{ textAlign: 'center' }}>
            <QrCode text={await verifyUrl(r.code)} />
            <div className="small muted" style={{ marginTop: 4 }}>ትክክለኛነቱን ያረጋግጡ</div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
          ይህ የቤተ ክርስቲያን የገንዘብ መቀበያ ማረጋገጫ ነው፤ የመንግሥት የግብር ደረሰኝ አይደለም። ያለ ሒሳብና ንብረት ማኅተም ዋጋ የለውም።
        </p>
      </article>
    </>
  );
}
