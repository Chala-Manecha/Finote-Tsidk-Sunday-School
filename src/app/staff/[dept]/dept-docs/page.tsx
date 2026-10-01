import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS } from '@/lib/constants';
import { formatEc } from '@/lib/ethiopian-calendar';
import { mediaUrl } from '@/lib/media';
import { MediaForm } from '@/components/media-form';
import { ActionButton } from '@/components/action-button';
import { saveDeptDoc, deleteDeptDoc } from '@/lib/actions/office';

type D = { dept: string; file_path: string; updated_at: string };

export default async function DeptDocs({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'internal_comm') notFound();
  const supabase = await createClient();
  const { data } = await supabase.from('dept_documents').select('dept, file_path, updated_at');
  const docs = new Map(((data ?? []) as D[]).map((d) => [d.dept, d]));

  return (
    <>
      <h2 className="section" style={{ marginTop: 0 }}>የክፍላት መግለጫ (PDF)</h2>
      <p className="muted small">እዚህ የሚጫኑት ፋይሎች በሕዝብ ገጹ “ክፍሎቻችን” ላይ ማንም ሰው ማየት ይችላል። አዲስ ፋይል ሲጫን የቀድሞው ይተካል።</p>
      <MediaForm action={saveDeptDoc} submitLabel="ጫን" fileField="file" folder="docs">
        <div className="form-grid">
          <div className="field">
            <label>ክፍል</label>
            <select name="dept" required defaultValue="">
              <option value="" disabled>ይምረጡ</option>
              {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div className="field"><label>PDF ፋይል</label><input name="file" type="file" accept="application/pdf,.pdf" required /></div>
        </div>
      </MediaForm>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ክፍል</th><th>ፋይል</th><th>የተጫነበት</th><th /></tr></thead>
          <tbody>
            {DEPARTMENTS.map((d) => {
              const doc = docs.get(d.code);
              return (
                <tr key={d.code}>
                  <td>{d.name}</td>
                  <td>{doc ? <a className="link" href={mediaUrl(supabase, doc.file_path)!} target="_blank" rel="noopener noreferrer">PDF ክፈት ↗</a> : <span className="muted small">አልተጫነም</span>}</td>
                  <td>{doc ? formatEc(doc.updated_at) : '—'}</td>
                  <td>{doc && <ActionButton action={deleteDeptDoc.bind(null, d.code)} label="አጥፋ" className="btn sm danger" confirmText="ማጥፋት ይፈልጋሉ?" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
