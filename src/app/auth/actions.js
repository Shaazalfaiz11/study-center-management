'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth mutations run on the server so passwords are never held in client
 * state and the session cookie is set with HttpOnly by Supabase's SSR
 * helper rather than by JavaScript.
 *
 * Each returns { error } on failure so the form can render it; success
 * paths redirect, which throws by design in Next.
 */

const siteUrl = async () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
};

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function validate({ email, password, fullName, requireName }) {
  if (!email) return 'Enter your email address';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  if (!password) return 'Enter your password';
  if (requireName && !fullName) return 'Enter your name';
  if (requireName && password.length < 8) return 'Use at least 8 characters for your password';
  return null;
}

// ── Sign in ─────────────────────────────────────────────────
export async function signIn(_prev, formData) {
  const email = clean(formData.get('email')).toLowerCase();
  const password = formData.get('password') || '';
  const next = clean(formData.get('next')) || '/dashboard';

  const invalid = validate({ email, password });
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns the same message for "no such user" and "wrong
    // password" on purpose — surfacing which one would let anyone probe
    // for registered email addresses.
    if (error.message?.toLowerCase().includes('email not confirmed')) {
      return { error: 'Confirm your email address first — check your inbox for the link.' };
    }
    return { error: 'Those credentials do not match an account.' };
  }

  revalidatePath('/', 'layout');
  redirect(next.startsWith('/') ? next : '/dashboard');
}

// ── Sign up ─────────────────────────────────────────────────
export async function signUp(_prev, formData) {
  const email = clean(formData.get('email')).toLowerCase();
  const password = formData.get('password') || '';
  const fullName = clean(formData.get('fullName'));

  const invalid = validate({ email, password, fullName, requireName: true });
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const base = await siteUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${base}/auth/confirm`,
    },
  });

  if (error) {
    if (error.message?.toLowerCase().includes('already registered')) {
      return { error: 'An account already exists for that email. Sign in instead.' };
    }
    return { error: error.message || 'Could not create the account.' };
  }

  // With email confirmations enabled Supabase returns a user but no
  // session — the account is not usable until the link is clicked.
  if (!data.session) {
    return { pending: true, email };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// ── Sign out ────────────────────────────────────────────────
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// ── Password reset ──────────────────────────────────────────
export async function requestPasswordReset(_prev, formData) {
  const email = clean(formData.get('email')).toLowerCase();
  if (!email) return { error: 'Enter your email address' };

  const supabase = await createClient();
  const base = await siteUrl();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/confirm?next=/reset-password`,
  });

  // Always report success. Telling the caller whether the address exists
  // would turn this form into an account-enumeration oracle.
  return { sent: true };
}

export async function updatePassword(_prev, formData) {
  const password = formData.get('password') || '';
  const confirm = formData.get('confirmPassword') || '';

  if (password.length < 8) return { error: 'Use at least 8 characters' };
  if (password !== confirm) return { error: 'Both passwords must match' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
