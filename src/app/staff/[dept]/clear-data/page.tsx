import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff, canAccess } from '@/lib/auth';
import { MediaForm } from '@/components/media-form';
import { clearSampleData } from '@/lib/actions/clear-data';

const count = async (supabase: Awaited<ReturnType<typeof createClient>>, table: string) =>
  (await supabase.from(table).select('*', { count: 'exact', head: true })).count ?? 0;

/** ጽሕፈት ቤት (members) and ሒሳብና ንብረት (money): clear the sample data before real data goes in. */
export default async function ClearData({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office' && dept !== 'finance') notFound();
  const staff = await requireStaff();
  const supabase = await createClient();
  const isOffice = dept === 'office';
  const canMoney = canAccess(staff, 'finance');
  const [members, apps, requests, earnings, donations, receipts] = await Promise.all([
    isOffice ? count(supabase, 'members') : 0, isOffice ? count(supabase, 'member_applications') : 0,
    count(supabase, 'money_requests'), count(supabase, 'earnings'), count(supabase, 'donations'), count(supabase, 'receipts'),
  ]);

  return (
    <>
      <div className="page-bar"><h2 className="section" style={{ margin: 0 }}>🧹 የሙከራ መረጃ ማጽዳት</h2></div>
      <div className="alert error">
        <b>ጥንቃቄ፦</b> ይህ የተመረጠውን መረጃ በሙሉ <b>በቋሚነት</b> ያጠፋል — መመለስ አይቻልም። እውነተኛ መረጃ ከመግባቱ በፊት አንድ ጊዜ ብቻ ይጠቀሙ።
      </div>
      <section className="card" style={{ maxWidth: 640 }}>
        <MediaForm action={clearSampleData} submitLabel="🧹 አጽዳ" card={false} resetOnSuccess>
          {isOffice && (
            <label className="clear-opt">
              <input type="checkbox" name="members" />
              <span>
                <b>ሁሉም አባላት ({members}) እና ማመልከቻዎች ({apps})</b>
                <small>ከነሱ ጋር የተያያዘው ሁሉ፦ ክትትል፣ የክፍል ምደባ፣ ውጤትና ጠባይ፣ የስራ ምደባ፣ መልቀቂያ፣ ክህነት፣ የአባላት የመግቢያ አካውንቶች። የምዝገባ ቁጥርም ከ1 ይጀምራል።</small>
              </span>
            </label>
          )}
          {canMoney && <label className="clear-opt">
            <input type="checkbox" name="money" />
            <span>
              <b>የገንዘብ መረጃ</b>
              <small>የወጪ ጥያቄዎችና ማጽደቂያዎች ({requests})፣ ክፍያዎችና የወጪ ሪፖርቶች፣ ገቢ ({earnings})፣ እርዳታ ({donations})፣ ደረሰኞች ({receipts})። የደረሰኝ ተራ ቁጥር ከ1 ይጀምራል፤ መነሻ ሂሳቡ ይሰረዛል።</small>
            </span>
          </label>}
          {isOffice && !canMoney && <p className="small muted" style={{ margin: 0 }}>የገንዘብ መረጃን ሒሳብና ንብረት (ወይም የሲስተሙ አስተዳዳሪ) ብቻ ማጽዳት ይችላል።</p>}
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="confirm">ለማረጋገጥ <b>አጽዳ</b> ብለው ይጻፉ</label>
            <input id="confirm" name="confirm" autoComplete="off" required />
          </div>
          <p className="small muted" style={{ margin: 0 }}>የክፍሎች፣ የኮርሶች፣ የትምህርት ዘመን፣ የንብረት፣ የድረ ገጽ እና የሰራተኞች (ስታፍ) መረጃ አይነካም።</p>
        </MediaForm>
      </section>
    </>
  );
}
