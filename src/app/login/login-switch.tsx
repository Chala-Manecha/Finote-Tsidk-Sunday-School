'use client';
import { useState } from 'react';
import { StudentLoginForm } from '@/components/student-auth-forms';
import { LoginForm } from './login-form';

/** One login card: members (registration number + PIN) by default; system admins switch in place. */
export function LoginSwitch({ next }: { next: string }) {
  const [admin, setAdmin] = useState(false);
  return (
    <div className="card login-card">
      {admin ? (
        <>
          <div className="login-mode">🔐 የሲስተም አስተዳዳሪ መግቢያ</div>
          <LoginForm next={next.startsWith('/staff') ? next : '/staff'} />
          <button type="button" className="link-btn" onClick={() => setAdmin(false)}>← ወደ አባላት መግቢያ</button>
        </>
      ) : (
        <>
          <StudentLoginForm next={next} bare />
          <button type="button" className="link-btn" onClick={() => setAdmin(true)}>የሲስተም አስተዳዳሪ ነዎት? በተጠቃሚ ስም ይግቡ →</button>
        </>
      )}
    </div>
  );
}
