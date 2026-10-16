import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME, GENERAL_DONATIONS, formatBirr } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { isPeriod, resolveRange } from '@/lib/periods';
import { RECEIPT_COLS } from '@/lib/receipts';
import { ActionButton } from '@/components/action-button';
import { ReasonForm } from '@/components/reason-form';
import { StatementHeader, StatementSignatures, PeriodTabs } from '@/components/statement';
import { voidReceipt, reissueReceipt, auditReceipt } from '@/lib/actions/receipts';

type R = {
  id: string; code: string; kind: 'income' | 'donation'; dept: string | null; amount: number; payer_name: string;
  issued_at: string; voided_at: string | null; void_reason: string | null; print_count: number;
  earning_id: string | null; donation_id: string | null; audited_at: string | null;
};
const kindLabel = (r: { kind: string }) => (r.kind === 'donation' ? 'እርዳታ' : 'ገቢ');
const deptLabel = (d: string | null) => (d ? DEPT_NAME[d] : GENERAL_DONATIONS);

export default async function Receipts({ params, searchParams }: {
  params: Promise<{ dept: string }>; searchParams: Promise<{ p?: string; c?: string; k?: string }>;
}) {
  const { dept } = await params;
  if (dept !== 'finance' && dept !== 'audit') notFound();
  const sp = await searchParams;
  const k = sp.k === 'in' || sp.k === 'out' ? sp.k : 'all';
  return dept === 'finance' ? <FinanceView k={k} /> : <AuditView p={sp.p} c={sp.c} k={k} />;
}

type Kind = 'all' | 'in' | 'out';
type Voucher = { id: string; voucher_no: string | null; paid_at: string; dept: string; reason: string; amount: number; received_name: string | null; audited_at: string | null };

/** ሁሉም / ገቢ / ወጪ switch (ገቢ = receipts, ወጪ = payment vouchers). */
function KindTabs({ base, k, extra = '' }: { base: string; k: Kind; extra?: string }) {
  return (
    <div className="money-tabs no-print" style={{ margin: 0 }}>
      {([['all', 'ሁሉም'], ['in', 'ገቢ'], ['out', 'ወጪ']] as const).map(([key, l]) => (
        <Link key={key} scroll={false} href={`${base}?${key === 'all' ? '' : `k=${key}&`}${extra}`} className={k === key ? 'on' : ''}>{l}</Link>
      ))}
    </div>
  );
}

async function vouchers(supabase: Awaited<ReturnType<typeof createClient>>, from?: string, to?: string) {
  let q = supabase.from('money_requests').select('id, voucher_no, paid_at, dept, reason, amount, received_name, audited_at')
    .not('paid_at', 'is', null).order('paid_at', { ascending: false }).limit(300);
  if (from) q = q.gte('paid_at', from);
  if (to) q = q.lte('paid_at', `${to}T23:59:59`);
  const { data } = await q;
  return ((data ?? []) as Voucher[]).map((v) => ({ ...v, amount: Number(v.amount) }));
}

function VoucherTable({ rows }: { rows: Voucher[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>የወጪ ማዘዣ ቁ.</th><th>ቀን</th><th>ክፍል</th><th>ምክንያት</th><th>ተረካቢ</th><th>ኦዲት</th><th className="num">መጠን</th></tr></thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td><Link className="link" href={`/staff/vouchers/${v.id}`}><code>{v.voucher_no ?? '—'}</code></Link></td>
              <td>{formatEc(v.paid_at)}</td>
              <td>{DEPT_NAME[v.dept]}</td>
              <td className="small">{v.reason}</td>
              <td className="small">{v.received_name ?? <span className="muted">ገና አልፈረመም</span>}</td>
              <td className="small">{v.audited_at ? '✓ ታይቷል' : '—'}</td>
              <td className="num neg">{formatBirr(v.amount)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="muted">የወጪ ማዘዣ የለም።</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr><th colSpan={6}>ድምር</th><th className="num">{formatBirr(rows.reduce((t, v) => t + v.amount, 0))}</th></tr></tfoot>}
      </table>
    </div>
  );
}

async function FinanceView({ k }: { k: Kind }) {
  const supabase = await createClient();
  const [{ data }, out] = await Promise.all([
    supabase.from('receipts').select(RECEIPT_COLS).order('issued_at', { ascending: false }).limit(300),
    k === 'in' ? Promise.resolve([] as Voucher[]) : vouchers(supabase),
  ]);
  const rows = (data ?? []) as unknown as R[];
  const hasLive = (r: R) => rows.some((x) => x.id !== r.id && !x.voided_at
    && ((r.earning_id && x.earning_id === r.earning_id) || (r.donation_id && x.donation_id === r.donation_id)));

  return (
    <>
      <div className="page-bar">
        <h2 className="section" style={{ margin: 0 }}>ደረሰኞች</h2>
        <KindTabs base="/staff/finance/receipts" k={k} />
      </div>
      {k !== 'in' && (
        <>
          <div className="card-head"><b>💸 የወጪ ማዘዣዎች</b><span className="count-badge">{out.length}</span></div>
          <VoucherTable rows={out} />
        </>
      )}
      {k !== 'out' && <>
      {k === 'all' && <div className="card-head" style={{ marginTop: 16 }}><b>🧾 የገቢና የእርዳታ ደረሰኞች</b><span className="count-badge">{rows.length}</span></div>}
      <p className="muted small">
        ገቢ ሲጸድቅ ወይም እርዳታ ሲረጋገጥ ደረሰኝ በራሱ ይዘጋጃል። የተሰጠ ደረሰኝ አይቀየርም፤ ስህተት ካለ በምክንያት ይሰረዛል፣ ከዚያ አዲስ ይሰጣል።
        ክፍሎች የገቢ ደረሰኛቸውን ራሳቸው አትመው ለማኅተም ወደዚህ ይመጣሉ፤ የእርዳታ ደረሰኝ ለጋሹ ከቢሮ ቁጥር 10 ይወስዳል።
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ቁጥር</th><th>ቀን</th><th>አይነት</th><th>ከ</th><th className="num">መጠን</th><th>ሁኔታ</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link className="link" href={`/staff/receipts/${r.id}`}><code>{r.code}</code></Link></td>
                <td>{formatEc(r.issued_at)}</td>
                <td>{kindLabel(r)}</td>
                <td>{r.payer_name}</td>
                <td className="num">{formatBirr(r.amount)}</td>
                <td>
                  {r.voided_at
                    ? <><span className="pill absent">ተሰርዟል</span><div className="small muted">{r.void_reason}</div></>
                    : <span className="pill present">{r.print_count > 0 ? `ታትሟል (${r.print_count})` : 'አልታተመም'}</span>}
                </td>
                <td>
                  <div className="btn-row">
                    {!r.voided_at && <ReasonForm action={voidReceipt} id={r.id} field="void_reason" button="ሰርዝ" placeholder="የመሰረዣ ምክንያት" />}
                    {r.voided_at && !hasLive(r) && (
                      <ActionButton action={reissueReceipt.bind(null, r.id)} label="አዲስ ደረሰኝ ስጥ" className="btn sm green"
                        confirmText="በዚህ ምትክ አዲስ ቁጥር ያለው ደረሰኝ ይዘጋጅ?" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">እስካሁን ደረሰኝ የለም።</td></tr>}
          </tbody>
        </table>
      </div>
      </>}
    </>
  );
}

type Audit = R & {
  serial: number; method: string | null; txn_ref: string | null; account_label: string | null; purpose: string | null;
  received_on: string; verified_by_name: string | null; issued_by_name: string | null; voided_by_name: string | null;
  audited_by_name: string | null; replaced_by: string | null;
};
type Reg = { id: string; serial: number; code: string; kind: string; dept: string | null; amount: number; payer_name: string; method: string | null; issued_at: string; voided_at: string | null; audited_at: string | null };

async function AuditView({ p, c, k }: { p?: string; c?: string; k: Kind }) {
  const period = isPeriod(p) ? p : 'month';
  const supabase = await createClient();
  const range = await resolveRange(supabase, period);
  const out = await vouchers(supabase, range.from, range.to);
  const [{ data: found }, { data: reg }, { data: gaps }] = await Promise.all([
    c ? supabase.rpc('receipt_audit', { p_code: c }) : Promise.resolve({ data: null }),
    supabase.rpc('receipt_register', { p_from: range.from, p_to: range.to }),
    supabase.rpc('receipt_serial_gaps'),
  ]);
  const r = found as Audit | null;
  const rows = (reg ?? []) as Reg[];
  const missing = (gaps ?? []) as { missing: number }[];
  const live = rows.filter((x) => !x.voided_at);
  const sum = (xs: Reg[]) => xs.reduce((s, x) => s + Number(x.amount), 0);

  return (
    <div className="statement">
      <div className="page-bar no-print">
        <h2 className="section" style={{ margin: 0 }}>ደረሰኞች</h2>
        <KindTabs base="/staff/audit/receipts" k={k} extra={`p=${period}`} />
        <span className="spacer" />
        <form className="toolbar slim" action="/staff/audit/receipts">
          <input type="hidden" name="p" value={period} />
          {k !== 'all' && <input type="hidden" name="k" value={k} />}
          <input name="c" dir="ltr" defaultValue={c ?? ''} placeholder="🔍 የደረሰኝ ቁጥር" aria-label="የደረሰኝ ቁጥር ፈልግ" style={{ width: 190 }} />
          <button className="btn sm secondary">ፈልግ</button>
        </form>
      </div>

      {c && !r && <p className="alert error">“{c}” የሚል ደረሰኝ አልተገኘም።</p>}
      {r && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}><code>{r.code}</code> · ተራ ቁ. {r.serial}</h3>
            <div className="btn-row">
              <Link className="btn sm secondary" href={`/staff/receipts/${r.id}`}>ደረሰኙን እይ</Link>
              {!r.audited_at && <ActionButton action={auditReceipt.bind(null, r.id)} label="✓ ተመልክቻለሁ" className="btn sm green" />}
            </div>
          </div>
          <dl className="doc-rows" style={{ marginTop: 10 }}>
            <div><dt>አይነት</dt><dd>{kindLabel(r)} · {deptLabel(r.dept)}</dd></div>
            <div><dt>ከ</dt><dd>{r.payer_name}</dd></div>
            <div><dt>መጠን</dt><dd>{formatBirr(r.amount)}</dd></div>
            <div><dt>የገንዘቡ ቀን</dt><dd>{formatEc(r.received_on)}</dd></div>
            <div><dt>መንገድ / የግብይት ቁ.</dt><dd>{r.method ?? 'ጥሬ ገንዘብ'} {r.txn_ref ? `· ${r.txn_ref}` : ''}</dd></div>
            <div><dt>ሂሳብ</dt><dd>{r.account_label ?? '—'}</dd></div>
            <div><dt>ያረጋገጠው</dt><dd>{r.verified_by_name ?? '—'}</dd></div>
            <div><dt>የሰጠው / መቼ</dt><dd>{r.issued_by_name ?? '—'} · {formatEc(r.issued_at)}</dd></div>
            <div><dt>የታተመው</dt><dd>{r.print_count} ጊዜ</dd></div>
            <div><dt>ኦዲት</dt><dd>{r.audited_at ? `✓ ${r.audited_by_name ?? ''} · ${formatEc(r.audited_at)}` : 'ገና'}</dd></div>
            {r.voided_at && <div><dt>ተሰርዟል</dt><dd>{r.voided_by_name} · {formatEc(r.voided_at)} — {r.void_reason}{r.replaced_by ? ` · ምትክ፦ ${r.replaced_by}` : ''}</dd></div>}
          </dl>
        </div>
      )}

      <PeriodTabs base="/staff/audit/receipts" active={period} extra={k === 'all' ? '' : `&k=${k}`} />
      <StatementHeader title={k === 'out' ? 'የወጪ ማዘዣ መዝገብ' : k === 'in' ? 'የደረሰኝ መዝገብ' : 'የደረሰኝና የወጪ ማዘዣ መዝገብ'} subtitle={range.label} />
      <div className="money-tiles">
        <div className="mt-in"><span>የገቢ ደረሰኞች</span><b>{formatBirr(sum(live.filter((x) => x.kind === 'income')))}</b></div>
        <div className="mt-in"><span>የእርዳታ ደረሰኞች</span><b>{formatBirr(sum(live.filter((x) => x.kind === 'donation')))}</b></div>
        <div className="mt-out"><span>የወጪ ማዘዣዎች ({out.length})</span><b>{formatBirr(out.reduce((t, v) => t + v.amount, 0))}</b></div>
        <div className="mt-open"><span>የተሰረዙ · ኦዲት ያልታዩ</span><b>{rows.length - live.length} · {live.filter((x) => !x.audited_at).length}</b></div>
      </div>
      {k !== 'in' && (
        <>
          <div className="card-head"><b>💸 የወጪ ማዘዣዎች</b><span className="count-badge">{out.length}</span></div>
          <VoucherTable rows={out} />
        </>
      )}
      {k !== 'out' && <>
      {k === 'all' && <div className="card-head" style={{ marginTop: 16 }}><b>🧾 የገቢና የእርዳታ ደረሰኞች</b><span className="count-badge">{rows.length}</span></div>}
      {missing.length > 0
        ? <p className="alert error">⚠ የጎደሉ ተራ ቁጥሮች፦ {missing.map((m) => m.missing).join('፣ ')}</p>
        : <p className="alert ok">✓ የደረሰኝ ተራ ቁጥሮች ሁሉ በቅደም ተከተል ተሟልተዋል (ምንም የጎደለ የለም)።</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th className="rank">ተራ</th><th>ቁጥር</th><th>ቀን</th><th>አይነት</th><th>ክፍል</th><th>ከ</th><th>ሁኔታ</th><th className="num">መጠን</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td className="rank">{x.serial}</td>
                <td><Link className="link" scroll={false} href={`/staff/audit/receipts?p=${period}&c=${encodeURIComponent(x.code)}`}><code>{x.code}</code></Link></td>
                <td>{formatEc(x.issued_at)}</td>
                <td>{kindLabel(x)}</td>
                <td>{deptLabel(x.dept)}</td>
                <td>{x.payer_name}</td>
                <td>{x.voided_at ? <span className="neg">ተሰርዟል</span> : x.audited_at ? '✓ ታይቷል' : '—'}</td>
                <td className="num">{x.voided_at ? <s>{formatBirr(x.amount)}</s> : formatBirr(x.amount)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">በዚህ ጊዜ ደረሰኝ የለም።</td></tr>}
          </tbody>
          <tfoot><tr><th colSpan={7}>ድምር (ያልተሰረዙ)</th><th className="num">{formatBirr(sum(live))}</th></tr></tfoot>
        </table>
      </div>
      </>}
      <StatementSignatures />
    </div>
  );
}
