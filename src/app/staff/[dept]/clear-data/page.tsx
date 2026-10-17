import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { MediaForm } from '@/components/media-form';
import { clearSampleData } from '@/lib/actions/clear-data';

const count = async (supabase: Awaited<ReturnType<typeof createClient>>, table: string) =>
  (await supabase.from(table).select('*', { count: 'exact', head: true })).count ?? 0;

/** System admin only: clear the sample data (members, money, education) before real data goes in. */
export default async function ClearData({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params;
  if (dept !== 'office' && dept !== 'finance' && dept !== 'education') notFound();
  const staff = await requireStaff();
  if (!staff.isAdmin) notFound();
  const supabase = await createClient();
  const [members, apps, requests, earnings, donations, receipts, years, courses, abnet] = await Promise.all(
    ['members', 'member_applications', 'money_requests', 'earnings', 'donations', 'receipts', 'academic_years', 'course_offerings', 'abnet_sessions']
      .map((t) => count(supabase, t)),
  );
  const first = dept === 'finance' ? 'money' : dept === 'education' ? 'education' : 'members';

  const opts = {
    members: (
      <label key="m" className="clear-opt">
        <input type="checkbox" name="members" defaultChecked={first === 'members'} />
        <span>
          <b>👥 ሁሉም አባላት ({members}) እና ማመልከቻዎች ({apps})</b>
          <small>ከነሱ ጋር የተያያዘው ሁሉ፦ ክትትል፣ የክፍል ምደባ፣ ውጤትና ጠባይ፣ የስራ ምደባ፣ መልቀቂያ፣ ክህነት፣ የአባላት የመግቢያ አካውንቶች። የምዝገባ ቁጥርም ከ1 ይጀምራል።</small>
        </span>
      </label>
    ),
    money: (
      <label key="f" className="clear-opt">
        <input type="checkbox" name="money" defaultChecked={first === 'money'} />
        <span>
          <b>💵 የገንዘብ መረጃ</b>
          <small>የወጪ ጥያቄዎችና ማጽደቂያዎች ({requests})፣ ክፍያዎችና የወጪ ሪፖርቶች፣ ገቢ ({earnings})፣ እርዳታ ({donations})፣ ደረሰኞች ({receipts})። የደረሰኝ ተራ ቁጥር ከ1 ይጀምራል፤ መነሻ ሂሳቡ ይሰረዛል።</small>
        </span>
      </label>
    ),
    education: (
      <label key="e" className="clear-opt">
        <input type="checkbox" name="education" defaultChecked={first === 'education'} />
        <span>
          <b>🎓 የትምህርት መረጃ</b>
          <small>የትምህርት ዘመናት ({years}) ከሴሚስተሮቻቸው ጋር፣ ኮርሶች ({courses})፣ የክፍል ምደባ፣ የመምህራን ምደባና ክትትል፣ ውጤት፣ ጠባይ፣ ኦንላይን ፈተናዎች፣ ትራንስክሪፕቶች እና የአብነት ትምህርቶች ({abnet})።</small>
        </span>
      </label>
    ),
  };
  const order = [first, ...(['members', 'money', 'education'] as const).filter((k) => k !== first)] as (keyof typeof opts)[];

  return (
    <>
      <div className="page-bar"><h2 className="section" style={{ margin: 0 }}>🧹 የሙከራ መረጃ ማጽዳት</h2><span className="pill">የሲስተሙ አስተዳዳሪ ብቻ</span></div>
      <div className="alert error">
        <b>ጥንቃቄ፦</b> ይህ የተመረጠውን መረጃ በሙሉ <b>በቋሚነት</b> ያጠፋል — መመለስ አይቻልም። እውነተኛ መረጃ ከመግባቱ በፊት አንድ ጊዜ ብቻ ይጠቀሙ።
      </div>
      <section className="card" style={{ maxWidth: 680 }}>
        <MediaForm action={clearSampleData} submitLabel="🧹 አጽዳ" card={false} resetOnSuccess>
          {order.map((k) => opts[k])}
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="confirm">ለማረጋገጥ <b>አጽዳ</b> ብለው ይጻፉ</label>
            <input id="confirm" name="confirm" autoComplete="off" required />
          </div>
          <p className="small muted" style={{ margin: 0 }}>የክፍሎች፣ የንብረት፣ የድረ ገጽ፣ የወረብ/መዝሙር እና የሰራተኞች (ስታፍ) መረጃ አይነካም።</p>
        </MediaForm>
      </section>
    </>
  );
}
