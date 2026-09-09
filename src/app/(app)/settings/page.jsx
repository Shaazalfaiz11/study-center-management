import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant/context';
import SettingsClient from './SettingsClient';

// Settings reflect live database state, so never serve a cached copy.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const ctx = await getTenantContext();

  // The protected layout already redirects when these are missing; this
  // keeps the page honest if it is ever rendered outside that layout.
  if (!ctx?.organization || !ctx.centre) {
    return <SettingsClient centre={null} team={[]} plans={[]} slots={[]} me={{ role: null }} />;
  }

  const orgId = ctx.organization.id;
  const centreId = ctx.centre.id;

  // Every query is tenant-scoped in the application AND by RLS. The
  // explicit filters keep result sets small; RLS is what makes them safe.
  const [{ data: centre }, { data: members }, { data: plans }, { data: slots }] = await Promise.all([
    supabase.from('centre_settings').select('*').eq('centre_id', centreId).maybeSingle(),
    supabase
      .from('organization_memberships')
      .select('id, user_id, role, status, created_at, profiles(id, full_name, email, phone)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('membership_plans')
      .select('id, name, price, duration, duration_unit, is_active')
      .eq('organization_id', orgId)
      .order('price', { ascending: true }),
    supabase
      .from('slots')
      .select('id, name, start_time, end_time, capacity, is_active')
      .eq('centre_id', centreId)
      .order('sort_order', { ascending: true }),
  ]);

  // Flatten membership + profile into the shape the team UI already uses.
  const team = (members || []).map((m) => ({
    id: m.user_id,
    membershipId: m.id,
    full_name: m.profiles?.full_name || '',
    email: m.profiles?.email || '',
    phone: m.profiles?.phone || '',
    role: m.role,
    is_active: m.status === 'active',
    created_at: m.created_at,
  }));

  return (
    <SettingsClient
      centre={centre || null}
      team={team}
      plans={plans || []}
      slots={slots || []}
      me={{
        id: ctx.user.id,
        role: ctx.role,
        profile: ctx.profile,
        organization: ctx.organization,
        centreName: ctx.centre.name,
      }}
    />
  );
}
