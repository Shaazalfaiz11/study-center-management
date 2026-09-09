import { redirect } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';
import { getTenantContext } from '@/lib/tenant/context';
import { signOut } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * Shown when someone holds a valid session but cannot use the app — no
 * profile row, or a deactivated one.
 *
 * This is a real route rather than something the protected layout renders
 * in place. A layout that returns markup instead of {children} does not
 * stop the child page from rendering: the page still runs its queries and
 * its RSC payload still ships. Redirecting here aborts that render
 * outright, so a blocked user never causes a protected page to execute.
 *
 * It lives in the (auth) group to reuse that shell, and is listed in the
 * proxy's PUBLIC_ROUTES so the session check does not bounce it back.
 */
export default async function AccountBlockedPage() {
  const ctx = await getTenantContext();

  // No session at all — nothing to explain, just sign in.
  if (!ctx?.user) redirect('/login');

  const { user, profile, memberships } = ctx;

  // Access was restored (or they were never blocked): send them home,
  // otherwise this page would become a dead end after reactivation.
  if (ctx.organization && ctx.role) redirect('/dashboard');

  // Distinguishing these matters: a suspended member needs their owner,
  // a user with no membership at all needs an invitation.
  const copy = memberships.length === 0 && profile
    ? {
        title: 'You do not belong to an organization yet',
        body: 'You are signed in, but this account is not a member of any active organization, so there is nothing to show. An owner needs to invite you to their centre.',
      }
    : {
        title: 'This account has been suspended',
        body: 'Your membership is no longer active, so access to centre data has been withdrawn. An owner can restore it from Settings → Team.',
      };

  return (
    <div className="auth-form">
      <div className="auth-form-head">
        <h2>{copy.title}</h2>
        <p>Signed in as {user.email}</p>
      </div>

      <div className="callout callout-warning" role="alert">
        <ShieldAlert size={15} className="callout-icon" />
        <div>{copy.body}</div>
      </div>

      <form action={signOut}>
        <button type="submit" className="btn btn-secondary btn-lg btn-block">
          <LogOut size={15} /> Sign out
        </button>
      </form>
    </div>
  );
}
