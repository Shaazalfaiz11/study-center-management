import { createClient, getUserProfile } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';

// Settings reflect live database state, so never serve a cached copy.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const result = await getUserProfile();

  const [{ data: centre }, { data: team }, { data: plans }, { data: slots }] = await Promise.all([
    supabase.from('centre_settings').select('*').eq('id', 1).single(),
    supabase.from('profiles').select('id, full_name, email, role, phone, is_active, created_at').order('created_at', { ascending: true }),
    supabase.from('membership_plans').select('id, name, price, duration, duration_unit, is_active').order('price', { ascending: true }),
    supabase.from('slots').select('id, name, start_time, end_time, capacity, is_active').order('sort_order', { ascending: true }),
  ]);

  return (
    <SettingsClient
      centre={centre || null}
      team={team || []}
      plans={plans || []}
      slots={slots || []}
      me={{ id: result?.user?.id, role: result?.profile?.role || 'front_desk', profile: result?.profile || null }}
    />
  );
}
