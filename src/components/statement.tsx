import Link from 'next/link';
import { CHURCH_NAME, SCHOOL_ADDRESS, SCHOOL_NAME } from '@/lib/constants';
import { formatEc, todayIsoAddis } from '@/lib/ethiopian-calendar';
import { PERIODS, type Period } from '@/lib/periods';
import { PrintButton } from './print-button';

/** Bank-statement style header shown on screen and on the printed PDF. */
export function StatementHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="statement-head">
      <div>
        <div className="statement-org serif">{SCHOOL_NAME}</div>
        <div className="small muted">{SCHOOL_ADDRESS} · {CHURCH_NAME}</div>
      </div>
      <div className="statement-title">
        <h2 className="serif">{title}</h2>
        <div className="small">{subtitle}</div>
        <div className="small muted">የታተመበት፦ {formatEc(todayIsoAddis())}</div>
      </div>
    </header>
  );
}

export function StatementSignatures({ roles = ['ያዘጋጀው (ኦዲት እና ምርመራ)', 'ያረጋገጠው (ጽሕፈት ቤት)'] }: { roles?: string[] }) {
  return (
    <div className="statement-signs">
      {roles.map((r) => (
        <div key={r}>
          <div className="sign-line" />
          <div className="small">{r}</div>
          <div className="small muted">ስም፣ ፊርማ እና ቀን</div>
        </div>
      ))}
    </div>
  );
}

/** Period switcher that keeps the scroll position; `extra` keeps other query params. */
export function PeriodTabs({ base, active, extra = '' }: { base: string; active: Period; extra?: string }) {
  return (
    <div className="subtabs no-print">
      {(Object.keys(PERIODS) as Period[]).map((k) => (
        <Link scroll={false} key={k} href={`${base}?p=${k}${extra}`} className={`btn sm ${k === active ? 'green' : 'secondary'}`}>
          {PERIODS[k].label}
        </Link>
      ))}
      <span style={{ flex: 1 }} />
      <PrintButton />
    </div>
  );
}
