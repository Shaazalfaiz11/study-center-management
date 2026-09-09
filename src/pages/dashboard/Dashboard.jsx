import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarCheck, Armchair, IndianRupee, BadgeCheck, AlertCircle,
  UserPlus, RefreshCw, Repeat, CalendarOff, Wrench, ArrowRight, Phone,
  CheckCircle2, Clock, PauseCircle, ListOrdered, CreditCard, LayoutGrid, List,
} from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale,
  PointElement, LineElement, Filler,
} from 'chart.js';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import StatTile from '../../components/ui/StatTile';
import { SectionCard, StatusBadge, Avatar, ProgressBar } from '../../components/ui/Primitives';
import { EmptyState, SkeletonText, Skeleton } from '../../components/ui/StateViews';
import reportService from '../../services/reportService';
import paymentService from '../../services/paymentService';
import {
  formatCurrency, formatCurrencyCompact, formatDate, formatShortDate,
  relativeDay, daysUntil, todayISO, RANGE_PRESETS,
} from '../../services/businessRules';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

// Fixed categorical order, validated for CVD separation and contrast.
// Never cycled — a fifth category folds into "Out of service".
const SERIES = {
  inUse: '#1d4ed8',
  available: '#0d9488',
  temporary: '#ea580c',
  outOfService: '#9333ea',
};

const QUICK_ACTIONS = [
  { label: 'Add Student', icon: UserPlus, to: '/students/add', primary: true },
  { label: 'Assign Seat', icon: Armchair, to: '/assignments' },
  { label: 'Record Payment', icon: CreditCard, to: '/billing/collection' },
  { label: 'Renew Membership', icon: RefreshCw, to: '/memberships/expiring' },
  { label: 'Mark Attendance', icon: CalendarCheck, to: '/attendance' },
  { label: 'Change Shift', icon: Repeat, to: '/assignments/shift-changes' },
  { label: 'Add Leave', icon: CalendarOff, to: '/memberships/leave' },
  { label: 'Report Maintenance', icon: Wrench, to: '/maintenance' },
];

export default function Dashboard() {
  const { students, payments, attendance, addToast } = useApp();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('today');
  const [custom, setCustom] = useState({ from: todayISO(), to: todayISO() });
  const [opsView, setOpsView] = useState('grid');
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());

  const { data, loading, error, retry } = useAsync(
    () => reportService.getDashboardSummary(preset, custom),
    [preset, custom.from, custom.to, students, payments, attendance],
  );

  const { data: queue, loading: queueLoading } = useAsync(() => paymentService.getCollectionQueue(), [students, payments]);

  const refresh = async () => {
    await retry();
    setRefreshedAt(new Date());
    addToast('Dashboard refreshed', 'info');
  };

  const followUps = useMemo(() => (queue ? [...queue.overdue, ...queue.dueToday].slice(0, 5) : []), [queue]);

  const expiringSoon = useMemo(
    () =>
      students
        .filter((s) => {
          const d = daysUntil(s.membershipExpiry);
          return d >= 0 && d <= 7;
        })
        .sort((a, b) => a.membershipExpiry.localeCompare(b.membershipExpiry))
        .slice(0, 5),
    [students],
  );

  const minutesAgo = Math.max(0, Math.round((Date.now() - refreshedAt.getTime()) / 60000));

  return (
    <div className="page-stack dashboard">
      {/* ── Range controls ── */}
      <div className="dash-toolbar">
        <div className="segmented">
          {RANGE_PRESETS.map((p) => (
            <button key={p.key} type="button" className={`segmented-item ${preset === p.key ? 'is-active' : ''}`} onClick={() => setPreset(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="dash-range">
            <input type="date" className="form-input form-select-sm" value={custom.from} max={todayISO()} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="From date" />
            <span className="text-muted">→</span>
            <input type="date" className="form-input form-select-sm" value={custom.to} max={todayISO()} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="To date" />
          </div>
        )}

        <div className="dash-toolbar-right">
          {data && <span className="dash-range-label">{data.range.label}</span>}
          <span className="dash-refreshed">Updated {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'is-spinning' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="table-container">
          <EmptyState icon={AlertCircle} title="Unable to load the dashboard" description={error.message} action={<button type="button" className="btn btn-primary btn-sm" onClick={retry}>Retry</button>} />
        </div>
      ) : (
        <>
          {/* ── KPI tiles ── */}
          <div className="tile-grid">
            <StatTile
              loading={loading && !data}
              icon={Users}
              tone="blue"
              label="Students"
              value={data?.students.active ?? 0}
              hint="Active on the register"
              onClick={() => navigate('/students')}
              breakdown={[
                { label: 'On leave', value: data?.students.onLeave ?? 0 },
                { label: 'Inactive', value: data?.students.inactive ?? 0 },
                { label: 'New', value: data?.students.admissions ?? 0, tone: data?.students.admissions ? 'success' : undefined },
              ]}
            />

            <StatTile
              loading={loading && !data}
              icon={CalendarCheck}
              tone="teal"
              label="Attendance"
              value={data?.attendance.present ?? 0}
              hint={data?.isSingleDay ? `${data?.attendance.rate ?? 0}% of ${data?.attendance.expected ?? 0} expected` : `Latest day · ${data?.attendance.avgPresent ?? 0}/day average`}
              progress={data?.attendance.rate ?? 0}
              onClick={() => navigate('/attendance')}
              breakdown={[
                { label: 'Present', value: data?.attendance.present ?? 0, tone: 'success' },
                { label: 'Absent', value: data?.attendance.absent ?? 0, tone: data?.attendance.absent ? 'error' : undefined },
              ]}
            />

            <StatTile
              loading={loading && !data}
              icon={Armchair}
              tone="violet"
              label="Seat occupancy"
              value={`${data?.seats.occupancyRate ?? 0}%`}
              hint={`${data?.seats.inUse ?? 0} of ${data?.seats.total ?? 0} seats in use`}
              progress={data?.seats.occupancyRate ?? 0}
              onClick={() => navigate('/seats/map')}
              breakdown={[
                { label: 'Free', value: data?.seats.available ?? 0, tone: 'success' },
                { label: 'Temp', value: data?.seats.temporarilyReleased ?? 0, tone: data?.seats.temporarilyReleased ? 'warning' : undefined },
                { label: 'Out', value: data?.seats.outOfService ?? 0 },
              ]}
            />

            <StatTile
              loading={loading && !data}
              icon={IndianRupee}
              tone="green"
              label="Collected"
              value={formatCurrency(data?.finance.collected ?? 0)}
              hint={`${data?.finance.paymentCount ?? 0} payment${data?.finance.paymentCount === 1 ? '' : 's'} · ${data?.range.label.toLowerCase()}`}
              onClick={() => navigate('/billing/payments')}
              breakdown={[
                { label: 'Spent', value: formatCurrencyCompact(data?.finance.spent ?? 0), tone: 'error' },
                { label: 'Net', value: formatCurrencyCompact(data?.finance.net ?? 0), tone: (data?.finance.net ?? 0) >= 0 ? 'success' : 'error' },
              ]}
            />

            <StatTile
              loading={loading && !data}
              icon={AlertCircle}
              tone="amber"
              label="Outstanding"
              value={formatCurrency(data?.finance.outstanding ?? 0)}
              hint="Across all students"
              onClick={() => navigate('/billing/collection')}
              breakdown={[
                { label: 'Due today', value: formatCurrencyCompact(data?.finance.dueTodayAmount ?? 0), tone: 'warning' },
                { label: 'Overdue', value: formatCurrencyCompact(data?.finance.overdueAmount ?? 0), tone: 'error' },
              ]}
            />

            <StatTile
              loading={loading && !data}
              icon={BadgeCheck}
              tone="blue"
              label="Memberships"
              value={data?.memberships.active ?? 0}
              hint={`${data?.memberships.renewals ?? 0} renewed ${data?.range.label.toLowerCase()}`}
              onClick={() => navigate('/memberships/active')}
              breakdown={[
                { label: 'Expiring', value: data?.memberships.expiring ?? 0, tone: data?.memberships.expiring ? 'warning' : undefined },
                { label: 'Expired', value: data?.memberships.expired ?? 0, tone: data?.memberships.expired ? 'error' : undefined },
                { label: 'Paused', value: data?.memberships.paused ?? 0 },
              ]}
            />
          </div>

          {/* ── Charts ── */}
          <div className="chart-row">
            <SectionCard
              title="Seat occupancy"
              subtitle="Right now, across all floors"
              actions={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/seats/map')}>
                  Seat map <ArrowRight size={13} />
                </button>
              }
            >
              {loading && !data ? (
                <Skeleton height={230} radius={8} />
              ) : (
                <OccupancyChart seats={data.seats} />
              )}
            </SectionCard>

            <SectionCard
              title="Collection trend"
              subtitle={data ? `${formatCurrency(data.finance.collected)} over ${data.range.label.toLowerCase()}` : 'Loading…'}
              actions={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/billing')}>
                  Billing <ArrowRight size={13} />
                </button>
              }
            >
              {loading && !data ? <Skeleton height={230} radius={8} /> : <CollectionTrend trend={data.finance.trend} />}
            </SectionCard>
          </div>

          {/* ── Operations ── */}
          <SectionCard
            title="Operations"
            subtitle="Everything waiting on a decision"
            actions={
              <div className="segmented">
                <button type="button" className={`segmented-item ${opsView === 'grid' ? 'is-active' : ''}`} onClick={() => setOpsView('grid')} aria-label="Grid view">
                  <LayoutGrid size={13} /> Grid
                </button>
                <button type="button" className={`segmented-item ${opsView === 'list' ? 'is-active' : ''}`} onClick={() => setOpsView('list')} aria-label="List view">
                  <List size={13} /> List
                </button>
              </div>
            }
          >
            {loading && !data ? (
              <SkeletonText lines={4} />
            ) : (
              <OperationsPanel view={opsView} ops={data.operations} shifts={data.shifts} navigate={navigate} />
            )}
          </SectionCard>

          {/* ── Follow-ups ── */}
          <div className="dashboard-grid">
            <SectionCard
              title="Payment follow-up"
              subtitle={queue ? `${formatCurrency(queue.totals.overdue + queue.totals.dueToday)} to collect` : 'Loading…'}
              actions={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/billing/collection')}>
                  Collect <ArrowRight size={13} />
                </button>
              }
              padded={false}
            >
              {queueLoading && !queue ? (
                <div className="card-body"><SkeletonText lines={4} /></div>
              ) : followUps.length === 0 ? (
                <EmptyState compact icon={CheckCircle2} title="Nothing to collect" description="No overdue or due-today payments." />
              ) : (
                <ul className="follow-list">
                  {followUps.map((row) => (
                    <li key={row.id}>
                      <button type="button" className="follow-item" onClick={() => navigate(`/students/${row.studentId}`)}>
                        <Avatar name={row.name} size={30} />
                        <div className="follow-main">
                          <span className="follow-name">{row.name}</span>
                          <span className="follow-sub"><Phone size={10} /> {row.phone}</span>
                        </div>
                        <div className="follow-side">
                          <span className="follow-amount">{formatCurrency(row.amount)}</span>
                          <StatusBadge status={row.paymentStatus} label={row.daysOverdue > 0 ? `${row.daysOverdue}d overdue` : 'Due today'} dot={false} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Renewals due"
              subtitle={data ? `${data.memberships.expiring} expiring within 7 days` : 'Loading…'}
              actions={
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/memberships/expiring')}>
                  View all <ArrowRight size={13} />
                </button>
              }
              padded={false}
            >
              {expiringSoon.length === 0 ? (
                <EmptyState compact icon={CheckCircle2} title="No renewals pending" description="Every membership is comfortably in date." />
              ) : (
                <ul className="follow-list">
                  {expiringSoon.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="follow-item" onClick={() => navigate(`/students/${s.id}`)}>
                        <Avatar name={s.name} size={30} />
                        <div className="follow-main">
                          <span className="follow-name">{s.name}</span>
                          <span className="follow-sub">{s.membershipPlan} · {s.deskNumber || 'No seat'}</span>
                        </div>
                        <div className="follow-side">
                          <span className="follow-date">{formatDate(s.membershipExpiry)}</span>
                          <StatusBadge status={daysUntil(s.membershipExpiry) === 0 ? 'due' : 'expiring'} label={relativeDay(s.membershipExpiry)} dot={false} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* ── Quick actions ── */}
          <SectionCard title="Quick actions" subtitle="The eight things done most often at the front desk">
            <div className="quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button key={action.label} type="button" className={`quick-action ${action.primary ? 'is-primary' : ''}`} onClick={() => navigate(action.to)}>
                  <span className="quick-action-icon"><action.icon size={16} /></span>
                  <span className="quick-action-label">{action.label}</span>
                </button>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ============================================================
// Occupancy — four states, direct-labelled so identity is never
// carried by colour alone.
// ============================================================
function OccupancyChart({ seats }) {
  const slices = [
    { label: 'In use', value: seats.inUse, color: SERIES.inUse },
    { label: 'Available', value: seats.available, color: SERIES.available },
    { label: 'Temporarily free', value: seats.temporarilyReleased, color: SERIES.temporary },
    { label: 'Out of service', value: seats.outOfService + seats.reserved, color: SERIES.outOfService },
  ];

  return (
    <div className="occupancy-chart">
      <div className="occupancy-donut">
        <Doughnut
          data={{
            labels: slices.map((s) => s.label),
            datasets: [
              {
                data: slices.map((s) => s.value),
                backgroundColor: slices.map((s) => s.color),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 4,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.label}: ${ctx.parsed} seats (${Math.round((ctx.parsed / seats.total) * 100)}%)`,
                },
              },
            },
          }}
        />
        <div className="occupancy-center">
          <span className="occupancy-center-value">{seats.occupancyRate}%</span>
          <span className="occupancy-center-label">occupied</span>
        </div>
      </div>

      <ul className="occupancy-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span className="occupancy-swatch" style={{ background: s.color }} />
            <span className="occupancy-legend-label">{s.label}</span>
            <span className="occupancy-legend-value">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Collection trend — one series, so no legend box is needed;
// the card title names it.
// ============================================================
function CollectionTrend({ trend }) {
  const single = trend.length <= 1;

  if (single) {
    const only = trend[0];
    return (
      <div className="trend-single">
        <span className="trend-single-value">{formatCurrency(only?.collected ?? 0)}</span>
        <span className="trend-single-label">collected on {formatDate(only?.date)}</span>
        <p className="trend-single-hint">Switch to This Week or This Month to see the trend over time.</p>
      </div>
    );
  }

  return (
    <div style={{ height: 230 }}>
      <Line
        data={{
          labels: trend.map((t) => formatShortDate(t.date)),
          datasets: [
            {
              label: 'Collected',
              data: trend.map((t) => t.collected),
              borderColor: SERIES.inUse,
              backgroundColor: 'rgba(29, 78, 216, 0.08)',
              borderWidth: 2,
              pointRadius: trend.length > 31 ? 0 : 3,
              pointHoverRadius: 5,
              pointBackgroundColor: SERIES.inUse,
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              tension: 0.3,
              fill: true,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b', maxRotation: 0, autoSkipPadding: 16 } },
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              border: { display: false },
              ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b', callback: (v) => formatCurrencyCompact(v) },
            },
          },
        }}
      />
    </div>
  );
}

// ============================================================
// Operations — same data, two densities
// ============================================================
function OperationsPanel({ view, ops, shifts, navigate }) {
  const items = [
    { label: 'Shift change requests', value: ops.pendingShiftChanges, icon: Repeat, tone: ops.pendingShiftChanges ? 'warning' : 'neutral', to: '/assignments/shift-changes', hint: 'Awaiting a decision' },
    { label: 'Approved, not moved', value: ops.approvedShiftChanges, icon: Repeat, tone: 'neutral', to: '/assignments/shift-changes', hint: 'Seat held, transfer pending' },
    { label: 'Active leaves', value: ops.activeLeaves, icon: PauseCircle, tone: 'neutral', to: '/memberships/leave', hint: 'Memberships paused' },
    { label: 'Upcoming leaves', value: ops.upcomingLeaves, icon: Clock, tone: 'neutral', to: '/memberships/leave', hint: 'Scheduled ahead' },
    { label: 'Open maintenance', value: ops.openMaintenance, icon: Wrench, tone: ops.highMaintenance ? 'error' : 'neutral', to: '/maintenance', hint: ops.highMaintenance ? `${ops.highMaintenance} high priority` : 'Reported issues' },
    { label: 'Waiting for a seat', value: ops.waitlist, icon: ListOrdered, tone: 'neutral', to: '/assignments/waitlist', hint: 'On the waitlist' },
    { label: 'Idle seat warnings', value: ops.idleSeats, icon: AlertCircle, tone: ops.idleSeats ? 'warning' : 'neutral', to: '/reports/daily', hint: 'No attendance for 7+ days' },
  ];

  if (view === 'list') {
    return (
      <>
        <ul className="ops-rows">
          {items.map((item) => (
            <li key={item.label}>
              <button type="button" className="ops-row" onClick={() => navigate(item.to)}>
                <span className={`ops-row-icon ops-row-${item.tone}`}><item.icon size={14} /></span>
                <span className="ops-row-text">
                  <span className="ops-row-label">{item.label}</span>
                  <span className="ops-row-hint">{item.hint}</span>
                </span>
                <span className={`ops-row-value ${item.value > 0 && item.tone !== 'neutral' ? `text-${item.tone}` : ''}`}>{item.value}</span>
                <ArrowRight size={14} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <ShiftStrip shifts={shifts} navigate={navigate} />
      </>
    );
  }

  return (
    <>
      <div className="ops-tiles">
        {items.map((item) => (
          <button key={item.label} type="button" className={`ops-tile ops-tile-${item.tone}`} onClick={() => navigate(item.to)}>
            <span className="ops-tile-icon"><item.icon size={15} /></span>
            <span className="ops-tile-value">{item.value}</span>
            <span className="ops-tile-label">{item.label}</span>
          </button>
        ))}
      </div>
      <ShiftStrip shifts={shifts} navigate={navigate} />
    </>
  );
}

function ShiftStrip({ shifts, navigate }) {
  return (
    <div className="shift-strip">
      <div className="section-heading">
        <span className="section-heading-title">Occupancy by shift</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/slots')}>
          Manage shifts <ArrowRight size={13} />
        </button>
      </div>
      <div className="shift-strip-grid">
        {shifts.map((shift) => (
          <div key={shift.id} className="shift-row">
            <div className="shift-row-head">
              <span className="shift-row-name">{shift.name}</span>
              <span className={`shift-row-pct ${shift.rate >= 90 ? 'text-error' : shift.rate >= 75 ? 'text-warning' : ''}`}>{shift.rate}%</span>
            </div>
            <ProgressBar value={shift.rate} />
            <span className="shift-row-sub">{shift.assigned} of {shift.capacity} · {shift.capacity - shift.assigned} left</span>
          </div>
        ))}
      </div>
    </div>
  );
}
