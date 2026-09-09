'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/app/auth/actions';

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {});

  if (state?.sent) {
    return (
      <div className="auth-form">
        <div className="auth-confirm">
          <div className="auth-confirm-icon">
            <MailCheck size={22} />
          </div>
          <h2>Check your email</h2>
          <p>If an account exists for that address, a reset link is on its way.</p>
          <Link href="/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-form-head">
        <h2>Reset your password</h2>
        <p>We&rsquo;ll email you a link to set a new one.</p>
      </div>

      {state?.error && (
        <div className="auth-error" role="alert">
          <AlertCircle size={14} /> {state.error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="form-input" placeholder="you@studycenter.in" autoComplete="email" required autoFocus />
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending && <Loader2 size={15} className="is-spinning" />}
        {pending ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="auth-foot">
        Remembered it? <Link href="/login" className="auth-link">Sign in</Link>
      </p>
    </form>
  );
}
