'use client';

import { useActionState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { updatePassword } from '@/app/auth/actions';

/**
 * Reached from the emailed reset link. By the time this renders the
 * recovery session already exists, so updateUser is enough.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, {});

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-form-head">
        <h2>Set a new password</h2>
        <p>Choose something you haven&rsquo;t used here before.</p>
      </div>

      {state?.error && (
        <div className="auth-error" role="alert">
          <AlertCircle size={14} /> {state.error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" className="form-input" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required autoFocus />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" className="form-input" placeholder="Type it again" autoComplete="new-password" minLength={8} required />
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending && <Loader2 size={15} className="is-spinning" />}
        {pending ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}
