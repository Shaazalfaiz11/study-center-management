import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/supabase/server';
import AppShell from '@/components/layout/AppShell';

/**
 * Protected shell. Middleware already blocks anonymous requests; this is
 * the second check, because middleware alone should never be the only
 * thing standing between a visitor and the data.
 */
export default async function AppLayout({ children }) {
  const result = await getUserProfile();
  if (!result?.user) redirect('/login');

  const { user, profile } = result;

  const account = {
    id: user.id,
    email: user.email,
    name: profile?.full_name || user.email?.split('@')[0] || 'Staff',
    role: profile?.role || 'front_desk',
    isActive: profile?.is_active ?? true,
  };

  return <AppShell account={account}>{children}</AppShell>;
}
