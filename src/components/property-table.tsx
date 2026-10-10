import { DEPARTMENTS, DEPT_NAME, ITEM_CONDITION, PROPERTY_SOURCE_INHERITED, formatBirr, type ItemCondition } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { MediaForm } from './media-form';
import { ActionButton } from './action-button';
import { EcDatePicker } from './ec-date-picker';
import { SourcePicker } from './source-picker';
import { saveProperty, deleteProperty } from '@/lib/actions/property';

export type PropertyRow = {
  id: string; name: string; qty: number; price: number | null; condition: ItemCondition; owner_dept: string;
  note?: string | null; registered_on?: string | null; source?: string | null;
};
export const PROPERTY_COLS = 'id, name, qty, price, condition, owner_dept, note, registered_on, source';

/**
 * Fields for a ንብረት row (also used for a department's purchase request).
 * `fixedDept` hides the department picker. `source`: 'inherited' = ሒሳብና ንብረት's own new entry
 * (always ካለፈው የተረከበ), otherwise the ምንጭ picker is shown with `defaultSource`.
 */
export function PropertyFields({ row, fixedDept, source = 'pick', defaultSource }: {
  row?: PropertyRow; fixedDept?: string; source?: 'inherited' | 'pick'; defaultSource?: string;
}) {
  return (
    <>
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="form-grid">
        <div className="field"><label>የዕቃው ስም</label><input name="name" required defaultValue={row?.name} /></div>
        <div className="field"><label>ብዛት</label><input name="qty" type="number" min={row ? 0 : 1} step={1} required defaultValue={row?.qty ?? 1} /></div>
        <div className="field"><label>የአንዱ ዋጋ (ብር)</label><input name="price" type="number" min={0} step="0.01" defaultValue={row?.price ?? ''} /></div>
        <div className="field">
          <label>ሁኔታ</label>
          <select name="condition" defaultValue={row?.condition ?? 'new'}>
            {Object.entries(ITEM_CONDITION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {fixedDept ? (
          <input type="hidden" name="owner_dept" value={fixedDept} />
        ) : (
          <div className="field">
            <label>ባለቤት ክፍል</label>
            <select name="owner_dept" required defaultValue={row?.owner_dept ?? ''}>
              <option value="" disabled>ይምረጡ</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
        )}
        {source === 'inherited' && !row
          ? (
            <div className="field">
              <span className="label">ምንጭ</span>
              <input value={PROPERTY_SOURCE_INHERITED} readOnly aria-label="ምንጭ" />
              <input type="hidden" name="source" value={PROPERTY_SOURCE_INHERITED} />
            </div>
          )
          : <SourcePicker defaultValue={row?.source ?? defaultSource} />}
        <div className="field">
          <span className="label">የተመዘገበበት ቀን (ዓ.ም)</span>
          <EcDatePicker name="registered_on" defaultIso={row?.registered_on ?? todayIsoAddis()} yearsBack={10} yearsForward={0} required />
        </div>
      </div>
      <div className="field"><label>ተጨማሪ መረጃ</label><textarea name="note" rows={2} defaultValue={row?.note ?? ''} placeholder="ለምሳሌ፦ ያለበት ቦታ፣ ጥገና የሚያስፈልገው…" /></div>
    </>
  );
}

export function PropertyTable({
  rows, editable, showDept, fixedDept,
}: {
  rows: PropertyRow[]; editable?: boolean; showDept?: boolean; fixedDept?: string;
}) {
  const total = rows.reduce((s, r) => s + (r.price ?? 0) * r.qty, 0);
  const cols = 6 + (showDept ? 1 : 0) + (editable ? 1 : 0);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ዕቃ</th><th className="num">ብዛት</th><th className="num">የአንዱ ዋጋ</th><th>ሁኔታ</th><th>ምንጭ</th><th>የተመዘገበበት ቀን</th>
            {showDept && <th>ክፍል</th>}
            {editable && <th className="no-print"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}{r.note && <div className="small muted" style={{ whiteSpace: 'pre-line' }}>{r.note}</div>}</td>
              <td className="num">{r.qty}</td>
              <td className="num">{r.price == null ? '—' : formatBirr(r.price)}</td>
              <td>{ITEM_CONDITION[r.condition]}</td>
              <td className="small">{r.source ?? '—'}</td>
              <td className="small">{r.registered_on ? formatEc(r.registered_on) : '—'}</td>
              {showDept && <td>{DEPT_NAME[r.owner_dept]}</td>}
              {editable && (
                <td className="no-print">
                  <div className="btn-row">
                    <details>
                      <summary className="btn sm secondary">አርም</summary>
                      <div style={{ marginTop: 8, minWidth: 320 }}>
                        <MediaForm action={saveProperty} submitLabel="ለውጥ አስቀምጥ" resetOnSuccess={false}>
                          <PropertyFields row={r} fixedDept={fixedDept} />
                        </MediaForm>
                      </div>
                    </details>
                    <ActionButton action={deleteProperty.bind(null, r.id)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols} className="muted">ምንም ንብረት አልተመዘገበም።</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot><tr><td>ጠቅላላ ዋጋ (የአንዱ ዋጋ × ብዛት)</td><td /><td className="num">{formatBirr(total)}</td><td colSpan={cols - 3} /></tr></tfoot>
        )}
      </table>
    </div>
  );
}
