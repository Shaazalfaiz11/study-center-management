'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { signUp } from '@/app/auth/actions';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, {});
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  // Confirmation email sent — the account is not usable until they click it.
  if (state?.pending) {
    return (
      <div className="auth-form">
        <div className="auth-confirm">
          <div className="auth-confirm-icon">
            <MailCheck size={22} />
          </div>
          <h2>Check your email</h2>
          <p>
            We sent a confirmation link to <strong>{state.email}</strong>. Click it to activate your
            account, then sign in.
          </p>
          <Link href="/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </div>
      </div>
    );
  }

  const strength = password.length === 0 ? null : password.length < 8 ? 'weak' : password.length < 12 ? 'ok' : 'strong';

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-form-head">
        <h2>Create an account</h2>
        <p>Set up access to the centre dashboard.</p>
      </div>

      {state?.error && (
        <div className="auth-error" role="alert">
          <AlertCircle size={14} />
          {state.error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" type="text" className="form-input" placeholder="Rajesh Kumar" autoComplete="name" required autoFocus />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="form-input" placeholder="you@studycenter.in" autoComplete="email" required />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">Password</label>
        <div className="auth-password">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {strength && (
          <div className={`auth-strength auth-strength-${strength}`}>
            <span className="auth-strength-bar" />
            <span className="auth-strength-label">
              {strength === 'weak' ? 'Too short — use 8 or more characters' : strength === 'ok' ? 'Acceptable' : 'Strong'}
            </span>
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending && <Loader2 size={15} className="is-spinning" />}
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <div className="auth-note">
        <ShieldCheck size={14} />
        <span>
          The first account created becomes the <strong>Owner</strong>. Everyone after that starts as
          Front Desk, and an owner can change roles from Settings.
        </span>
      </div>

      <p className="auth-foot">
        Already have an account? <Link href="/login" className="auth-link">Sign in</Link>
      </p>
    </form>
  );
}
