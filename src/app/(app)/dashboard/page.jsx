import Link from 'next/link';
import { ArrowRight, Database, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/tenant/context';
import { SectionCard } from '@/components/ui/Primitives';

export const dynamic = 'force-dynamic';

/**
 * Placeholder while the operational screens are migrated off mock data.
 * It reads live counts so the Supabase wiring is visibly working.
 *
 * students and seats are deliberately not queried: those tables belong to
 * later modules and do not exist yet.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const ctx = await getTenantContext();

  const [team, slots, plans] = await Promise.all([
    supabase
      .from('organization_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', ctx?.organization?.id ?? '')
      .eq('status', 'active'),
    supabase.from('slots').select('id', { count: 'exact', head: true }).eq('centre_id', ctx?.centre?.id ?? ''),
    supabase.from('membership_plans').select('id', { count: 'exact', head: true }).eq('organization_id', ctx?.organization?.id ?? ''),
  ]);

  const counts = {
    staff: team.count ?? 0,
    slots: slots.count ?? 0,
    plans: plans.count ?? 0,
  };
  const connected = !team.error && !slots.error;

  return (
    <div className="page-stack">
      <SectionCard
        title={`Welcome, ${ctx?.profile?.full_name || 'there'}`}
        subtitle={ctx?.organization ? `${ctx.organization.name} · ${ctx.centre?.name || ''}` : 'Authentication and settings are live on Supabase'}
      >
        <div className="flex flex-col gap-4">
          <div className={`callout ${connected ? 'callout-success' : 'callout-warning'}`}>
            {connected ? <CheckCircle2 size={15} className="callout-icon" /> : <Database size={15} className="callout-icon" />}
            <div>
              <span className="callout-title">{connected ? 'Connected to Supabase' : 'Database not reachable'}</span>
              {connected
                ? `${counts.staff} team member${counts.staff === 1 ? '' : 's'} · ${counts.slots} shifts · ${counts.plans} plans.`
                : 'Check the Supabase keys in .env.local.'}
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card"><span className="stat-card-label">Staff accounts</span><span className="stat-card-value">{counts.staff}</span></div>
            <div className="stat-card"><span className="stat-card-label">Students</span><span className="stat-card-value">{counts.students}</span></div>
            <div className="stat-card"><span className="stat-card-label">Seats</span><span className="stat-card-value">{counts.seats}</span></div>
          </div>

          <p className="text-secondary">
            The operational screens — students, seats, billing, attendance — are next. They still run on the
            in-memory mock services and will be moved onto these tables one module at a time.
          </p>

          <div>
            <Link href="/settings" className="btn btn-primary btn-sm">
              Open settings <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
