import { DEPARTMENTS, DEPT_NAME, ITEM_CONDITION, formatBirr, type ItemCondition } from '@/lib/constants';
import { MediaForm } from './media-form';
import { ActionButton } from './action-button';
import { saveProperty, deleteProperty } from '@/lib/actions/property';

export type PropertyRow = {
  id: string; name: string; qty: number; price: number | null; condition: ItemCondition; owner_dept: string;
};

/** Fields for a ንብረት row. `fixedDept` hides the department picker. */
export function PropertyFields({ row, fixedDept }: { row?: PropertyRow; fixedDept?: string }) {
  return (
    <>
      {row && <input type="hidden" name="id" value={row.id} />}
      <div className="form-grid">
        <div className="field"><label>የዕቃው ስም</label><input name="name" required defaultValue={row?.name} /></div>
        <div className="field"><label>ብዛት</label><input name="qty" type="number" min={0} step={1} required defaultValue={row?.qty ?? 1} /></div>
        <div className="field"><label>ዋጋ (ብር)</label><input name="price" type="number" min={0} step="0.01" defaultValue={row?.price ?? ''} /></div>
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
      </div>
    </>
  );
}

export function PropertyTable({
  rows, editable, showDept, fixedDept,
}: {
  rows: PropertyRow[]; editable?: boolean; showDept?: boolean; fixedDept?: string;
}) {
  const total = rows.reduce((s, r) => s + (r.price ?? 0) * r.qty, 0);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ዕቃ</th><th className="num">ብዛት</th><th className="num">ዋጋ</th><th>ሁኔታ</th>
            {showDept && <th>ክፍል</th>}
            {editable && <th className="no-print"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="num">{r.qty}</td>
              <td className="num">{r.price == null ? '—' : formatBirr(r.price)}</td>
              <td>{ITEM_CONDITION[r.condition]}</td>
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
          {rows.length === 0 && <tr><td colSpan={6} className="muted">ምንም ንብረት አልተመዘገበም።</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot><tr><td>ጠቅላላ ዋጋ</td><td /><td className="num">{formatBirr(total)}</td><td colSpan={3} /></tr></tfoot>
        )}
      </table>
    </div>
  );
}
