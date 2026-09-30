import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS, DEPT_NAME, PROPERTY_LOG_KIND, formatBirr, type PropertyLogKind } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { MediaForm } from '@/components/media-form';
import { EcDatePicker } from '@/components/ec-date-picker';
import { ActionButton } from '@/components/action-button';
import { savePropertyLog, deletePropertyLog } from '@/lib/actions/finance';

type L = { id: string; dept: string; kind: PropertyLogKind; item_name: string; qty: number; value: number; note: string | null; log_date: string };

export default async function FinancePropertyLog({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'finance') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('property_log')
    .select('id, dept, kind, item_name, qty, value, note, log_date')
    .order('log_date', { ascending: false }).limit(200);
  const rows = (data ?? []) as L[];

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የንብረት መዝገብ</h2>
      <p className="muted small">
        ለኦዲት የክፍላት ደረጃ የሚውል፦ <b>ንብረት በመጨመር</b> (የተለገሰ/የተጨመረ, +)፣ <b>ንብረት አያያዝ</b> (በአግባቡ መያዝ ወይም የተሰበረውን ማሳደስ — የታደሰ, +)፣ <b>የጎደለ ንብረት</b> (−)።
      </p>
      <MediaForm action={savePropertyLog} submitLabel="+ መዝግብ">
        <div className="form-grid">
          <div className="field">
            <label>ክፍል</label>
            <select name="dept" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>አይነት</label>
            <select name="kind" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {Object.entries(PROPERTY_LOG_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field"><label>ዕቃ</label><input name="item_name" required /></div>
          <div className="field"><label>ብዛት</label><input name="qty" type="number" min={1} step={1} defaultValue={1} required /></div>
          <div className="field"><label>ጠቅላላ ዋጋ (ብር)</label><input name="value" type="number" min={0} step="0.01" required /></div>
          <div className="field"><span className="label">ቀን (ዓ.ም)</span><EcDatePicker name="log_date" defaultIso={todayIsoAddis()} yearsBack={2} yearsForward={0} required /></div>
        </div>
        <div className="field"><label>ማስታወሻ</label><input name="note" placeholder="ለምሳሌ፦ ተሰብሮ ታድሷል" /></div>
      </MediaForm>

      <div className="table-wrap">
        <table>
          <thead><tr><th>ቀን</th><th>ክፍል</th><th>አይነት</th><th>ዕቃ</th><th className="num">ብዛት</th><th className="num">ዋጋ</th><th>ማስታወሻ</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatEc(r.log_date)}</td>
                <td>{DEPT_NAME[r.dept]}</td>
                <td><span className={`pill ${r.kind === 'lost' ? 'absent' : 'present'}`}>{PROPERTY_LOG_KIND[r.kind]}</span></td>
                <td>{r.item_name}</td>
                <td className="num">{r.qty}</td>
                <td className="num">{r.kind === 'lost' ? '−' : '+'}{formatBirr(r.value)}</td>
                <td className="small">{r.note ?? ''}</td>
                <td><ActionButton action={deletePropertyLog.bind(null, r.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">እስካሁን ምንም አልተመዘገበም።</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
