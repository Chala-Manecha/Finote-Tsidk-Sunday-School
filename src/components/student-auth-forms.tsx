'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { identifyMember, createMemberAccount, loginMember, type AuthState } from '@/lib/actions/student-auth';

export function StudentLoginForm({ next = '' }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginMember, {});
  return (
    <form action={action} className="card">
      <input type="hidden" name="next" value={next} />
      <div className="field"><label htmlFor="reg">የመመዝገቢያ ቁጥር</label><input id="reg" name="reg_no" dir="ltr" required placeholder="ፍጽ-XXXX-XXXX" autoComplete="username" /></div>
      <div className="field"><label htmlFor="pin">ፒን (6 አሃዝ)</label><input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="current-password" /></div>
      {state.error && <div className="alert error">{state.error}</div>}
      <button className="btn" style={{ width: '100%' }} disabled={pending}>{pending ? 'በመግባት ላይ…' : 'ግባ'}</button>
      <p className="small" style={{ marginBottom: 0 }}>ገና ፒን የለዎትም? <Link className="link" href="/student/register">መለያ ይፍጠሩ →</Link></p>
      <p className="small muted" style={{ margin: '4px 0 0' }}>ፒንዎን ከረሱ ወይም መለያዎ ከተቆለፈ ትምህርት ክፍልን ያነጋግሩ።</p>
    </form>
  );
}

export function StudentRegisterForm() {
  const [reg, setReg] = useState('');
  const [phone, setPhone] = useState('');
  const [found, identify, identifying] = useActionState<AuthState, FormData>(identifyMember, {});
  const [made, create, creating] = useActionState<AuthState, FormData>(createMemberAccount, {});

  if (found.step === 'confirm') {
    return (
      <form action={create} className="card" style={{ maxWidth: 460 }}>
        <input type="hidden" name="reg_no" value={reg} />
        <input type="hidden" name="phone" value={phone} />
        <p style={{ marginTop: 0 }}><b>{found.name}</b> — እርስዎ ነዎት?</p>
        <p className="small muted">ከሆኑ ለመግቢያ የሚጠቀሙበትን 6 አሃዝ ፒን ይፍጠሩ። ፒኑን ለማንም አያጋሩ።</p>
        <div className="field"><label htmlFor="pin">አዲስ ፒን</label><input id="pin" name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="pin2">ፒኑን ይድገሙ</label><input id="pin2" name="pin2" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="new-password" /></div>
        <label className="check"><input type="checkbox" name="enroll" defaultChecked /> ለዚህ የትምህርት ዘመን እንደ ተማሪ ተመዝገብ</label>
        <p className="hint muted small" style={{ marginTop: 0 }}>መምህር ወይም አመራር ብቻ ከሆኑ ምልክቱን ያንሱ።</p>
        <div className="btn-row">
          <button className="btn" disabled={creating}>{creating ? '…' : 'መለያ ፍጠር'}</button>
          {made.error && <span className="alert error" style={{ margin: 0 }}>{made.error}</span>}
        </div>
      </form>
    );
  }
  return (
    <form action={identify} className="card" style={{ maxWidth: 460 }}>
      <div className="field"><label htmlFor="reg">የመመዝገቢያ ቁጥር</label><input id="reg" name="reg_no" dir="ltr" required placeholder="ፍጽ-XXXX-XXXX" value={reg} onChange={(e) => setReg(e.target.value)} /></div>
      <div className="field">
        <label htmlFor="phone">ሲመዘገቡ ያስገቡት ስልክ ቁጥር</label>
        <input id="phone" name="phone" dir="ltr" inputMode="tel" required placeholder="09…" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <span className="hint">ለሕፃናት ክፍል፦ የወላጅ ስልክ።</span>
      </div>
      <div className="btn-row">
        <button className="btn" disabled={identifying}>{identifying ? '…' : 'ቀጥል'}</button>
        {found.error && <span className="alert error" style={{ margin: 0 }}>{found.error}</span>}
      </div>
      <p className="small" style={{ marginBottom: 0 }}>ፒን አለዎት? <Link className="link" href="/login">ግባ →</Link></p>
    </form>
  );
}
