import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { DEPARTMENTS } from '@/lib/constants';
import { mediaUrl } from '@/lib/media';
import { PublicHeader } from '@/components/public-header';

export const metadata: Metadata = { title: 'ክፍሎቻችን' };

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('dept_documents').select('dept, file_path');
  const docs = new Map((data ?? []).map((d) => [d.dept as string, d.file_path as string]));
  return (
    <>
      <PublicHeader />
      <main className="page">
        <h1 className="title">ክፍሎቻችን</h1>
        <p className="muted">የእያንዳንዱን ክፍል ተግባርና ኃላፊነት የሚገልጸውን ሰነድ ያንብቡ። በንዑስ አባልነት ማገልገል ከፈለጉ ቢሮ ቁጥር 7 ይምጡ።</p>
        <div className="doc-list">
          {DEPARTMENTS.map((d) => {
            const path = docs.get(d.code);
            return (
              <div key={d.code} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <b className="serif">{d.name}</b>
                {path ? (
                  <a className="btn sm" style={{ alignSelf: 'flex-start' }} href={mediaUrl(supabase, path)!} target="_blank" rel="noopener noreferrer">
                    መግለጫ ያንብቡ (PDF)
                  </a>
                ) : <span className="small muted">መግለጫ በቅርቡ ይጫናል።</span>}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
