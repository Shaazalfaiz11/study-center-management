import Link from 'next/link';
import { ArrowRight, Database, CheckCircle2 } from 'lucide-react';
import { createClient, getUserProfile } from '@/lib/supabase/server';
import { SectionCard } from '@/components/ui/Primitives';

export const dynamic = 'force-dynamic';

/**
 * Placeholder while the operational screens are migrated off mock data.
 * It reads live counts so the Supabase wiring is visibly working.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const result = await getUserProfile();

  const [students, seats, staff] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }),
    supabase.from('seats').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const counts = {
    students: students.count ?? 0,
    seats: seats.count ?? 0,
    staff: staff.count ?? 0,
  };
  const connected = !students.error && !seats.error;

  return (
    <div className="page-stack">
      <SectionCard title={`Welcome, ${result?.profile?.full_name || 'there'}`} subtitle="Authentication and settings are live on Supabase">
        <div className="flex flex-col gap-4">
          <div className={`callout ${connected ? 'callout-success' : 'callout-warning'}`}>
            {connected ? <CheckCircle2 size={15} className="callout-icon" /> : <Database size={15} className="callout-icon" />}
            <div>
              <span className="callout-title">{connected ? 'Connected to Supabase' : 'Database not reachable'}</span>
              {connected
                ? `${counts.staff} staff account${counts.staff === 1 ? '' : 's'} · ${counts.students} students · ${counts.seats} seats.`
                : 'Run supabase/schema.sql in the SQL editor, then check the keys in .env.local.'}
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
