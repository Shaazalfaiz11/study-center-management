'use client';

import { useActionState, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { signIn } from '@/app/auth/actions';

function LoginForm() {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState(signIn, {});
  const [showPassword, setShowPassword] = useState(false);

  const next = params.get('next') || '/dashboard';
  const linkError = params.get('error') === 'link_invalid';

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-form-head">
        <h2>Sign in</h2>
        <p>Enter your credentials to reach the dashboard.</p>
      </div>

      {(state?.error || linkError) && (
        <div className="auth-error" role="alert">
          <AlertCircle size={14} />
          {state?.error || 'That link is no longer valid. Sign in, or request a new one.'}
        </div>
      )}

      <input type="hidden" name="next" value={next} />

      <div className="form-group">
        <label className="form-label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="form-input"
          placeholder="you@studycenter.in"
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      <div className="form-group">
        <div className="auth-label-row">
          <label className="form-label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
        </div>
        <div className="auth-password">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            className="form-input"
            placeholder="Your password"
            autoComplete="current-password"
            required
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
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending}>
        {pending && <Loader2 size={15} className="is-spinning" />}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="auth-foot">
        No account yet? <Link href="/signup" className="auth-link">Create one</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-form"><div className="skeleton" style={{ height: 260, borderRadius: 8 }} /></div>}>
      <LoginForm />
    </Suspense>
  );
}
