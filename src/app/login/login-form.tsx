'use client';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="username">የተጠቃሚ ስም</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" required />
      </div>
      <div className="field">
        <label htmlFor="password">የይለፍ ቃል</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <div className="alert error">{state.error}</div>}
      <button className="btn" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'በመግባት ላይ…' : 'ግባ'}
      </button>
    </form>
  );
}
