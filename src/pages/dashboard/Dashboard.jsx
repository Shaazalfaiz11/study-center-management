import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CalendarCheck, Armchair, IndianRupee, TrendingUp, AlertCircle,
  UserPlus, RefreshCw, Repeat, CalendarOff, Wrench, ArrowRight, Phone,
  CheckCircle2, Clock, PauseCircle, ListOrdered, CreditCard,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { SectionCard, StatusBadge, Avatar, ProgressBar } from '../../components/ui/Primitives';
import { EmptyState, SkeletonCards, SkeletonText } from '../../components/ui/StateViews';
import paymentService from '../../services/paymentService';
import membershipService from '../../services/membershipService';
import { formatCurrency, formatDate, relativeDay, todayISO, daysUntil } from '../../services/businessRules';
import './Dashboard.css';

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
  const { stats, students, payments, attendance } = useApp();
  const navigate = useNavigate();
  const today = todayISO();

  const { data: queue, loading: queueLoading } = useAsync(() => paymentService.getCollectionQueue(), [students, payments]);
  const { data: memberSummary, loading: memberLoading } = useAsync(
    () => membershipService.getMembershipSummary(),
    [students, attendance],
  );

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

  const recentlyExpired = useMemo(
    () =>
      students
        .filter((s) => {
          const d = daysUntil(s.membershipExpiry);
          return d < 0 && d >= -14;
        })
        .sort((a, b) => b.membershipExpiry.localeCompare(a.membershipExpiry))
        .slice(0, 3),
    [students],
  );

  const followUps = useMemo(() => {
    if (!queue) return [];
    return [...queue.overdue, ...queue.dueToday].slice(0, 6);
  }, [queue]);

  return (
    <div className="page-stack dashboard">
      {/* ── KPI row ── */}
      <StatGrid>
        <StatCard
          icon={Users}
          label="Active students"
          value={stats.activeStudents}
          sublabel={`${stats.onLeaveStudents} on leave · ${stats.inactiveStudents} inactive`}
          onClick={() => navigate('/students')}
        />
        <StatCard
          icon={CalendarCheck}
          label="Today's attendance"
          value={stats.todayPresent}
          sublabel={`${stats.attendanceRate}% of ${stats.todayExpected} expected`}
          tone={stats.attendanceRate >= 75 ? 'success' : 'warning'}
          onClick={() => navigate('/attendance')}
        />
        <StatCard
          icon={Armchair}
          label="Seat occupancy"
          value={`${stats.occupancyRate}%`}
          sublabel={`${stats.availableSeats} free · ${stats.temporarilyReleasedSeats} temporarily free`}
          onClick={() => navigate('/seats/map')}
        />
        <StatCard
          icon={IndianRupee}
          label="Today's collection"
          value={formatCurrency(stats.todayCollection)}
          sublabel={`${stats.dueTodayCount} still due today`}
          tone="success"
          onClick={() => navigate('/billing/collection')}
        />
        <StatCard
          icon={TrendingUp}
          label="Monthly revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          sublabel={`${formatCurrency(stats.monthlyExpenses)} expenses`}
          onClick={() => navigate('/billing')}
        />
        <StatCard
          icon={AlertCircle}
          label="Outstanding"
          value={formatCurrency(stats.totalOutstanding)}
          sublabel={`${stats.overdueCount} overdue`}
          tone={stats.overdueCount > 0 ? 'error' : 'neutral'}
          onClick={() => navigate('/billing/collection')}
        />
      </StatGrid>

      <div className="dashboard-grid">
        {/* ── Today's operations ── */}
        <SectionCard
          title="Today's operations"
          subtitle={formatDate(today)}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/reports/daily')}>
              Full report <ArrowRight size={13} />
            </button>
          }
        >
          <div className="ops-list">
            <OpsRow icon={CheckCircle2} label="Students present" value={stats.todayPresent} tone="success" onClick={() => navigate('/attendance')} />
            <OpsRow icon={Clock} label="Students absent" value={stats.todayAbsent} tone={stats.todayAbsent > 0 ? 'warning' : 'neutral'} onClick={() => navigate('/attendance')} />
            <OpsRow icon={UserPlus} label="New admissions" value={stats.newAdmissionsToday} onClick={() => navigate('/students')} />
            <OpsRow icon={RefreshCw} label="Renewals" value={stats.renewalsToday} onClick={() => navigate('/memberships/active')} />
            <OpsRow icon={Repeat} label="Shift change requests" value={stats.pendingShiftChanges} tone={stats.pendingShiftChanges ? 'warning' : 'neutral'} onClick={() => navigate('/assignments/shift-changes')} />
            <OpsRow icon={PauseCircle} label="Leave requests" value={stats.activeLeaves + stats.upcomingLeaves} onClick={() => navigate('/memberships/leave')} />
            <OpsRow icon={Wrench} label="Maintenance issues" value={stats.openMaintenance} tone={stats.openMaintenance ? 'warning' : 'neutral'} onClick={() => navigate('/maintenance')} />
            <OpsRow icon={ListOrdered} label="Waiting for a seat" value={stats.waitlistCount} onClick={() => navigate('/assignments/waitlist')} />
          </div>
        </SectionCard>

        {/* ── Payment follow-up ── */}
        <SectionCard
          title="Payment follow-up"
          subtitle={queue ? `${formatCurrency(queue.totals.overdue + queue.totals.dueToday)} to collect` : 'Loading…'}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/billing/collection')}>
              Open collection <ArrowRight size={13} />
            </button>
          }
          padded={false}
        >
          {queueLoading && !queue ? (
            <div className="card-body">
              <SkeletonText lines={5} />
            </div>
          ) : followUps.length === 0 ? (
            <EmptyState compact icon={CheckCircle2} title="Nothing to collect today" description="No overdue or due-today payments." />
          ) : (
            <ul className="follow-list">
              {followUps.map((row) => (
                <li key={row.id}>
                  <button type="button" className="follow-item" onClick={() => navigate(`/students/${row.studentId}`)}>
                    <Avatar name={row.name} size={30} />
                    <div className="follow-main">
                      <span className="follow-name">{row.name}</span>
                      <span className="follow-sub">
                        <Phone size={10} /> {row.phone} · {row.membershipPlan}
                      </span>
                    </div>
                    <div className="follow-side">
                      <span className="follow-amount">{formatCurrency(row.amount)}</span>
                      <StatusBadge
                        status={row.paymentStatus}
                        label={row.daysOverdue > 0 ? `${row.daysOverdue}d overdue` : 'Due today'}
                        dot={false}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ── Membership follow-up ── */}
        <SectionCard
          title="Membership follow-up"
          subtitle={memberSummary ? `${memberSummary.expiring} expiring · ${memberSummary.expired} expired` : 'Loading…'}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/memberships/expiring')}>
              View all <ArrowRight size={13} />
            </button>
          }
          padded={false}
        >
          {memberLoading && !memberSummary ? (
            <div className="card-body">
              <SkeletonText lines={4} />
            </div>
          ) : (
            <>
              <div className="member-summary">
                <MemberStat label="Expiring today" value={memberSummary?.expiringToday ?? 0} tone="warning" />
                <MemberStat label="This week" value={memberSummary?.expiringThisWeek ?? 0} tone="primary" />
                <MemberStat label="Recently expired" value={memberSummary?.recentlyExpired ?? 0} tone="error" />
                <MemberStat label="Paused" value={memberSummary?.paused ?? 0} />
              </div>

              {expiringSoon.length === 0 && recentlyExpired.length === 0 ? (
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
                          <StatusBadge
                            status={daysUntil(s.membershipExpiry) === 0 ? 'due' : 'expiring'}
                            label={relativeDay(s.membershipExpiry)}
                            dot={false}
                          />
                        </div>
                      </button>
                    </li>
                  ))}
                  {recentlyExpired.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="follow-item" onClick={() => navigate(`/students/${s.id}`)}>
                        <Avatar name={s.name} size={30} />
                        <div className="follow-main">
                          <span className="follow-name">{s.name}</span>
                          <span className="follow-sub">{s.membershipPlan} · {s.deskNumber || 'Seat released'}</span>
                        </div>
                        <div className="follow-side">
                          <span className="follow-date">{formatDate(s.membershipExpiry)}</span>
                          <StatusBadge status="expired" label={relativeDay(s.membershipExpiry)} dot={false} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </SectionCard>

        {/* ── Occupancy by shift ── */}
        <SectionCard
          title="Occupancy by shift"
          subtitle={`${stats.assignedSeats + stats.occupiedSeats} of ${stats.totalSeats} seats in use`}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/slots')}>
              Manage shifts <ArrowRight size={13} />
            </button>
          }
        >
          {stats.shiftOccupancy.length === 0 ? (
            <SkeletonCards count={3} height={40} />
          ) : (
            <div className="shift-list">
              {stats.shiftOccupancy.map((shift) => (
                <div key={shift.id} className="shift-row">
                  <div className="shift-row-head">
                    <span className="shift-row-name">{shift.name}</span>
                    <span className={`shift-row-pct ${shift.rate >= 90 ? 'text-error' : shift.rate >= 75 ? 'text-warning' : ''}`}>{shift.rate}%</span>
                  </div>
                  <ProgressBar value={shift.rate} />
                  <span className="shift-row-sub">
                    {shift.assigned} of {shift.capacity} · {shift.capacity - shift.assigned} places left
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick actions ── */}
      <SectionCard title="Quick actions" subtitle="The eight things done most often at the front desk">
        <div className="quick-actions">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`quick-action ${action.primary ? 'is-primary' : ''}`}
              onClick={() => navigate(action.to)}
            >
              <span className="quick-action-icon">
                <action.icon size={16} />
              </span>
              <span className="quick-action-label">{action.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Attention strip ── */}
      {(stats.potentiallyInactive > 0 || stats.pendingShiftChanges > 0 || stats.openMaintenance > 0) && (
        <div className="attention-strip">
          {stats.potentiallyInactive > 0 && (
            <AttentionItem
              tone="warning"
              text={`${stats.potentiallyInactive} seat${stats.potentiallyInactive === 1 ? '' : 's'} with no attendance for 7+ days`}
              action="Review"
              onClick={() => navigate('/reports/daily')}
            />
          )}
          {stats.pendingShiftChanges > 0 && (
            <AttentionItem
              tone="info"
              text={`${stats.pendingShiftChanges} shift change request${stats.pendingShiftChanges === 1 ? '' : 's'} awaiting a decision`}
              action="Review"
              onClick={() => navigate('/assignments/shift-changes')}
            />
          )}
          {stats.openMaintenance > 0 && (
            <AttentionItem
              tone="warning"
              text={`${stats.openMaintenance} maintenance issue${stats.openMaintenance === 1 ? '' : 's'} open`}
              action="Open"
              onClick={() => navigate('/maintenance')}
            />
          )}
        </div>
      )}
    </div>
  );
}

function OpsRow({ icon: Icon, label, value, tone = 'neutral', onClick }) {
  return (
    <button type="button" className="ops-row" onClick={onClick}>
      <span className={`ops-row-icon ops-row-${tone}`}>
        <Icon size={14} />
      </span>
      <span className="ops-row-label">{label}</span>
      <span className={`ops-row-value ${value > 0 && tone !== 'neutral' ? `text-${tone}` : ''}`}>{value}</span>
    </button>
  );
}

function MemberStat({ label, value, tone = 'neutral' }) {
  return (
    <div className={`member-stat member-${tone}`}>
      <span className="member-stat-value">{value}</span>
      <span className="member-stat-label">{label}</span>
    </div>
  );
}

function AttentionItem({ tone, text, action, onClick }) {
  return (
    <div className={`attention-item attention-${tone}`}>
      <AlertCircle size={14} />
      <span>{text}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClick}>
        {action} <ArrowRight size={12} />
      </button>
    </div>
  );
}
