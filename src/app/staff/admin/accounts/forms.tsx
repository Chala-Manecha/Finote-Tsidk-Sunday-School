'use client';
import { useActionState } from 'react';
import { DEPARTMENTS, SEX } from '@/lib/constants';
import { createStaffAccount, updateStaffAccount, type AccountState } from './actions';

function DeptChecks({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="check-grid">
      {DEPARTMENTS.map((d) => (
        <label key={d.code} className="check">
          <input type="checkbox" name="depts" value={d.code} defaultChecked={selected.includes(d.code)} />
          {d.name}
        </label>
      ))}
    </div>
  );
}

export function CreateAccountForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(createStaffAccount, {});
  return (
    <form action={action} className="card">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="username">የተጠቃሚ ስም</label>
          <input id="username" name="username" required dir="ltr" placeholder="hr.abebe" autoCapitalize="none" />
          <span className="hint">a-z, 0-9, . _ - ብቻ</span>
        </div>
        <div className="field">
          <label htmlFor="full_name">ሙሉ ስም</label>
          <input id="full_name" name="full_name" required />
        </div>
        <div className="field">
          <label htmlFor="sex">ፆታ</label>
          <select id="sex" name="sex" defaultValue="">
            <option value="">—</option>
            {Object.entries(SEX).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="password">የመጀመሪያ የይለፍ ቃል</label>
          <input id="password" name="password" required minLength={8} dir="ltr" autoComplete="new-password" />
        </div>
      </div>
      <div className="form-section">ክፍሎች</div>
      <DeptChecks />
      <label className="check"><input type="checkbox" name="is_admin" /> አስተዳዳሪ (ሁሉንም ክፍሎች ያያል፣ መለያዎችን ያስተዳድራል)</label>
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert ok">{state.ok}</div>}
      <button className="btn" disabled={pending}>{pending ? '…' : 'መለያ ፍጠር'}</button>
    </form>
  );
}

export function EditAccountForm(props: {
  userId: string; depts: string[]; isAdmin: boolean; isActive: boolean;
}) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateStaffAccount, {});
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={props.userId} />
      <DeptChecks selected={props.depts} />
      <div className="btn-row">
        <label className="check"><input type="checkbox" name="is_admin" defaultChecked={props.isAdmin} /> አስተዳዳሪ</label>
        <label className="check"><input type="checkbox" name="is_active" defaultChecked={props.isActive} /> ንቁ</label>
        <div className="field" style={{ margin: 0 }}>
          <input name="password" placeholder="አዲስ የይለፍ ቃል (አማራጭ)" dir="ltr" minLength={8} autoComplete="new-password" />
        </div>
        <button className="btn sm" disabled={pending}>{pending ? '…' : 'አስቀምጥ'}</button>
        {state.error && <span className="alert error" style={{ margin: 0 }}>{state.error}</span>}
        {state.ok && <span className="alert ok" style={{ margin: 0 }}>{state.ok}</span>}
      </div>
    </form>
  );
}
