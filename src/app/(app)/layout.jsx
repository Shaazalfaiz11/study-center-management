import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/tenant/context';
import AppShell from '@/components/layout/AppShell';

/**
 * Protected shell. Middleware already blocks anonymous requests; this is
 * the second check, because middleware alone should never be the only
 * thing standing between a visitor and the data.
 */
export default async function AppLayout({ children }) {
  const ctx = await getTenantContext();
  if (!ctx?.user) redirect('/login');

  // A session alone is not authorisation. Without an active membership
  // the tenant helpers return false and RLS yields nothing, so the app
  // would render as an empty, broken shell.
  //
  // This redirects rather than rendering a message in place: returning
  // markup from a layout does not stop the child page from rendering, so
  // the protected page would still run its queries and ship its payload.
  if (!ctx.organization || !ctx.role) redirect('/account-blocked');

  const account = {
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.profile?.full_name || ctx.user.email?.split('@')[0] || 'Staff',
    role: ctx.role,
    isActive: true,
    organization: ctx.organization,
    centre: ctx.centre,
  };

  return <AppShell account={account}>{children}</AppShell>;
}
