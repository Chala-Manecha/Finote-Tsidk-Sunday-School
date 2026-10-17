import { createClient } from '@/lib/supabase/server';
import { DEPT_NAME } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { DutyForm } from './duty-form';
import { Modal } from './modal';

type Choice = {
  id: string; member_id: string; duty: string; duty_date: string; occasion: string; status: string | null;
  members: { full_name: string; reg_no: string; phone: string | null } | null;
};

/** What members chose to do themselves (from their dashboard) — every department sees it and can allocate it. */
export async function DutyChoices({ dept, members, past = false }: { dept?: string; members?: { id: string; full_name: string }[]; past?: boolean }) {
  const supabase = await createClient();
  const today = todayIsoAddis();
  let q = supabase.from('duty_assignments').select('id, member_id, duty, duty_date, occasion, status, members(full_name, reg_no, phone)')
    .eq('source', 'chosen').order('duty_date', { ascending: !past });
  q = past ? q.lt('duty_date', today) : q.gte('duty_date', today);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Choice[];
  const { data: alloc } = rows.length
    ? await supabase.from('duty_assignments').select('from_choice, dept, accepted_at').in('from_choice', rows.map((r) => r.id))
    : { data: [] };
  const taken = new Map(((alloc ?? []) as { from_choice: string; dept: string; accepted_at: string | null }[]).map((a) => [a.from_choice, a]));
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>#</th><th>አባል</th><th>ስልክ</th><th>የመረጡት ምድብ</th><th>በአል</th><th>ቀን</th><th>ሁኔታ</th>{dept && <th className="no-print" />}</tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const a = taken.get(r.id);
            return (
              <tr key={r.id}>
                <td className="num">{i + 1}</td>
                <td><b>{r.members?.full_name ?? '—'}</b> <span className="small muted">{r.members?.reg_no}</span></td>
                <td dir="ltr" className="small">{r.members?.phone ? <a className="link" href={`tel:${r.members.phone.replace(/\s/g, '')}`}>{r.members.phone}</a> : '—'}</td>
                <td><b>{r.duty}</b></td>
                <td className="small">{r.occasion}</td>
                <td className="small">{formatEc(r.duty_date, { weekday: true })}</td>
                <td>{a
                  ? <span className={`pill ${a.accepted_at ? 'present' : 'half'}`}>{DEPT_NAME[a.dept as keyof typeof DEPT_NAME] ?? a.dept} መድቧል{a.accepted_at ? '' : ' · አባሉ ይቀበላል'}</span>
                  : <span className="pill pending">ምደባ ይጠብቃል</span>}</td>
                {dept && (
                  <td className="no-print">
                    {!a && members && (
                      <Modal label="መድብ" title={`${r.members?.full_name ?? ''} — ${r.duty}`} sub="የአባሉ ምርጫ ተሞልቷል፤ እንደ አስፈላጊነቱ ይቀይሩና ይመድቡ" btnClass="btn xs green">
                        <DutyForm dept={dept} members={members} plain choice={{ id: r.id, member_id: r.member_id, duty: r.duty, duty_date: r.duty_date, occasion: r.occasion }} />
                      </Modal>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={dept ? 8 : 7} className="muted">{past ? 'ያለፈ ምርጫ የለም።' : 'አባላት እስካሁን ምንም አልመረጡም።'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
