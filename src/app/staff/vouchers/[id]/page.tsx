import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, PAY_METHOD, formatBirr, type PayMethod } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { birrInWords } from '@/lib/amharic-number';
import { termLabel } from '@/lib/periods';
import { DocHeader, DocRows, DocSigns, QrCode, verifyUrl } from '@/components/doc-sheet';
import { DocPrintButton } from '@/components/doc-print-button';

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: q } = await supabase.from('money_requests')
    .select('id, dept, amount, reason, voucher_no, pay_method, pay_reference, paid_at, paid_by, decided_by, decided_at, received_at, received_name, term_id, requested_at')
    .eq('id', id).maybeSingle();
  if (!q || !q.voucher_no) notFound();
  const [{ data: people }, { data: term }] = await Promise.all([
    supabase.from('staff_profiles').select('user_id, full_name').in('user_id', [q.paid_by, q.decided_by].filter(Boolean)),
    q.term_id ? supabase.from('leadership_terms').select('name, team_no').eq('id', q.term_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const nameOf = (u: string | null) => people?.find((p) => p.user_id === u)?.full_name ?? '—';

  return (
    <>
      <div className="btn-row no-print" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Link className="link" href={`/staff/${q.dept}/money`}>← ተመለስ</Link>
        <DocPrintButton />
      </div>
      {!q.received_at && <p className="alert error no-print">ክፍሉ ገንዘቡን መረከቡን እስካሁን አላረጋገጠም።</p>}
      <article className="doc-sheet">
        <DocHeader title="የወጪ ማዘዣ (Payment Voucher)" code={q.voucher_no} />
        <DocRows rows={[
          ['የተከፈለው ለ', DEPT_NAME[q.dept]],
          ['ምክንያት', q.reason],
          ['የተጠየቀበት', formatEc(q.requested_at)],
          ['ያጸደቀው (ጽሕፈት ቤት)', `${nameOf(q.decided_by)} · ${q.decided_at ? formatEc(q.decided_at) : '—'}`],
          ['የከፈለው (ሒሳብና ንብረት)', `${nameOf(q.paid_by)} · ${q.paid_at ? formatEc(q.paid_at) : '—'}`],
          ['የአከፋፈል መንገድ', q.pay_method ? PAY_METHOD[q.pay_method as PayMethod] : '—'],
          ['የዝውውር ቁጥር', q.pay_reference ?? '—'],
          ['የተረከበው', q.received_name ? `${q.received_name} · ${formatEc(q.received_at)}` : '—'],
          ['የአመራር ቡድን', term ? termLabel(term) : '—'],
        ]} />
        <div className="doc-amount">
          <div><div className="small muted">በፊደል</div>{birrInWords(q.amount)}</div>
          <b>{formatBirr(q.amount)}</b>
        </div>
        <div className="doc-foot">
          <DocSigns roles={['ያጸደቀው (ጽሕፈት ቤት)', 'የከፈለው (ሒሳብና ንብረት)', `የተረከበው (${DEPT_NAME[q.dept]})`]} />
          <div style={{ textAlign: 'center' }}>
            <QrCode text={await verifyUrl(q.voucher_no)} />
            <div className="small muted" style={{ marginTop: 4 }}>ትክክለኛነቱን ያረጋግጡ</div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
          ክፍሉ ገንዘቡን ሲረከብ ይፈርማል። ወጪ ሪፖርቱ ከደረሰኞች ጋር ለሒሳብና ንብረት ይቀርባል።
        </p>
      </article>
    </>
  );
}
