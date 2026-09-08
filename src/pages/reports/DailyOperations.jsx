import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer, Download, FileText, Users, Armchair, IndianRupee, BadgeCheck,
  Settings2, ArrowRight, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import reportService, { exportDailyOperationsCsv, printReport } from '../../services/reportService';
import { SectionCard, ProgressBar, StatusBadge } from '../../components/ui/Primitives';
import { SkeletonCards, ErrorState, EmptyState } from '../../components/ui/StateViews';
import { formatCurrency, formatDate, formatDateLong, todayISO, relativeDay } from '../../services/businessRules';
import './DailyOperations.css';

/**
 * The owner's one-page read on the day: attendance, seats, money,
 * renewals and everything still waiting for a decision.
 */
export default function DailyOperations() {
  const { students, payments, attendance, addToast } = useApp();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());

  const { data: report, loading, error, retry } = useAsync(
    () => reportService.getDailyOperationsReport(date),
    [date, students, payments, attendance],
  );

  const handleCsv = () => {
    exportDailyOperationsCsv(report);
    addToast('CSV downloaded', 'success', { description: `daily-operations-${report.date}.csv` });
  };

  const handlePdf = () => {
    addToast('Opening print dialog', 'info', { description: 'Choose “Save as PDF” as the destination.' });
    setTimeout(printReport, 350);
  };

  if (loading && !report) {
    return (
      <div className="page-stack">
        <SkeletonCards count={4} height={120} />
        <SkeletonCards count={2} height={260} />
      </div>
    );
  }

  if (error) return <ErrorState title="Unable to load the daily report" description={error.message} onRetry={retry} />;
  if (!report) return <EmptyState title="No report available" />;

  const { students: st, attendance: att, seats, finance, memberships, operations } = report;

  return (
    <div className="page-stack daily-report">
      {/* ── Report toolbar ── */}
      <div className="report-toolbar no-print">
        <div className="report-toolbar-left">
          <label className="inline-field">
            <span className="inline-field-label">Report date</span>
            <input type="date" className="form-input form-select-sm" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          {date !== todayISO() && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(todayISO())}>
              <RefreshCw size={13} /> Back to today
            </button>
          )}
        </div>
        <div className="report-toolbar-right">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCsv}>
            <Download size={14} /> Export CSV
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handlePdf}>
            <FileText size={14} /> Export PDF
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={printReport}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* ── Report head ── */}
      <header className="report-head">
        <div>
          <span className="report-eyebrow">Daily Operations</span>
          <h2 className="report-date">{formatDateLong(report.date)}</h2>
        </div>
        <div className="report-head-meta">
          <span>Generated {report.generatedAt}</span>
          <span>{report.dateLabel === formatDateLong(todayISO()) ? 'Live figures' : 'Historical'}</span>
        </div>
      </header>

      {/* ── Headline numbers ── */}
      <div className="report-headline">
        <HeadlineBlock
          icon={Users}
          title="Students"
          primary={`${st.active}`}
          primaryLabel="Active"
          rows={[
            { label: 'Present', value: st.present, tone: 'success' },
            { label: 'Absent', value: st.absent, tone: st.absent > 0 ? 'error' : undefined },
            { label: 'On leave', value: st.onLeave },
          ]}
          footer={`${st.attendanceRate}% attendance today`}
          onClick={() => navigate('/attendance')}
        />
        <HeadlineBlock
          icon={Armchair}
          title="Seats"
          primary={`${seats.occupancyRate}%`}
          primaryLabel="Occupancy"
          rows={[
            { label: 'In use', value: seats.inUse },
            { label: 'Available', value: seats.available, tone: 'success' },
            { label: 'Temporarily free', value: seats.temporarilyReleased, tone: seats.temporarilyReleased ? 'warning' : undefined },
          ]}
          footer={`${seats.total} seats · ${seats.maintenance} under maintenance`}
          onClick={() => navigate('/seats/map')}
        />
        <HeadlineBlock
          icon={IndianRupee}
          title="Finance"
          primary={formatCurrency(finance.collectedToday)}
          primaryLabel="Collected"
          rows={[
            { label: 'Payments', value: finance.paymentCount },
            { label: 'Outstanding', value: formatCurrency(finance.outstanding), tone: finance.outstanding > 0 ? 'warning' : undefined },
            { label: 'Overdue', value: `${finance.overdueCount} students`, tone: finance.overdueCount ? 'error' : undefined },
          ]}
          footer={`${formatCurrency(finance.expensesToday)} spent today`}
          onClick={() => navigate('/billing/collection')}
        />
        <HeadlineBlock
          icon={BadgeCheck}
          title="Memberships"
          primary={`${memberships.renewedToday}`}
          primaryLabel="Renewed"
          rows={[
            { label: 'Expired today', value: memberships.expiredToday, tone: memberships.expiredToday ? 'error' : undefined },
            { label: 'Expiring in 7 days', value: memberships.expiringSoon, tone: memberships.expiringSoon ? 'warning' : undefined },
            { label: 'Paused', value: memberships.paused },
          ]}
          footer={`${st.newAdmissions} new admission${st.newAdmissions === 1 ? '' : 's'} today`}
          onClick={() => navigate('/memberships/expiring')}
        />
      </div>

      <div className="report-grid">
        {/* ── Attendance by shift ── */}
        <SectionCard title="Attendance & occupancy by shift" subtitle="Who turned up, and how full each shift is">
          <div className="shift-report">
            {att.bySlot.map((slot) => (
              <div key={slot.name} className="shift-report-row">
                <div className="shift-report-head">
                  <span className="shift-report-name">{slot.name}</span>
                  <span className="shift-report-figures">
                    <strong>{slot.present}</strong> present of {slot.total} expected
                  </span>
                </div>
                <ProgressBar value={slot.occupancy} />
                <div className="shift-report-foot">
                  <span>
                    {slot.assigned}/{slot.capacity} seats assigned
                  </span>
                  <span className={slot.occupancy >= 90 ? 'text-error font-semibold' : slot.occupancy >= 75 ? 'text-warning font-semibold' : ''}>
                    {slot.occupancy}% occupancy
                  </span>
                </div>
              </div>
            ))}
            {att.bySlot.length === 0 && <EmptyState compact title="No shift data for this date" />}
          </div>
          <div className="report-inline-stats">
            <InlineStat label="Checked in" value={att.checkedIn} />
            <InlineStat label="Checked out" value={att.checkedOut} />
            <InlineStat label="Late arrivals" value={att.late} />
          </div>
        </SectionCard>

        {/* ── Collection ── */}
        <SectionCard
          title="Revenue & collection"
          subtitle="Money in today and what is still owed"
          actions={
            <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => navigate('/billing/collection')}>
              Open collection <ArrowRight size={13} />
            </button>
          }
        >
          <div className="money-rows">
            <MoneyRow label="Collected today" value={formatCurrency(finance.collectedToday)} tone="success" strong />
            <MoneyRow label="Expenses today" value={formatCurrency(finance.expensesToday)} tone="error" />
            <MoneyRow label="Net today" value={formatCurrency(finance.collectedToday - finance.expensesToday)} strong divider />
            <MoneyRow label={`Due today (${finance.dueTodayCount})`} value={formatCurrency(finance.dueTodayAmount)} tone="warning" />
            <MoneyRow label={`Overdue (${finance.overdueCount})`} value={formatCurrency(finance.overdueAmount)} tone="error" />
            <MoneyRow label="Total outstanding" value={formatCurrency(finance.outstanding)} strong divider />
          </div>

          {Object.keys(finance.byMethod).length > 0 && (
            <div className="method-split">
              <span className="uppercase-label">Collected by method</span>
              <div className="method-split-rows">
                {Object.entries(finance.byMethod).map(([method, amount]) => (
                  <div key={method} className="method-split-row">
                    <span>{method}</span>
                    <strong>{formatCurrency(amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Memberships expiring ── */}
        <SectionCard
          title="Memberships to follow up"
          subtitle={`${memberships.expiringSoon} expiring within 7 days`}
          actions={
            <button type="button" className="btn btn-ghost btn-sm no-print" onClick={() => navigate('/memberships/expiring')}>
              View all <ArrowRight size={13} />
            </button>
          }
          padded={false}
        >
          {memberships.expiringSoonList.length === 0 ? (
            <EmptyState compact title="Nothing expiring this week" description="No renewals need chasing today." />
          ) : (
            <ul className="report-list">
              {memberships.expiringSoonList.map((m) => (
                <li key={m.name} className="report-list-item">
                  <div className="report-list-main">
                    <span className="report-list-title">{m.name}</span>
                    <span className="report-list-sub">{m.plan}</span>
                  </div>
                  <div className="report-list-side">
                    <span className="report-list-value">{formatDate(m.expiry)}</span>
                    <StatusBadge status={m.days === 0 ? 'due' : 'expiring'} label={m.days === 0 ? 'Today' : `${m.days} days`} dot={false} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ── Operations queue ── */}
        <SectionCard title="Operations queue" subtitle="Decisions waiting on you">
          <div className="ops-grid">
            <OpsTile label="Shift change requests" value={operations.shiftChangeRequests} tone={operations.shiftChangeRequests ? 'warning' : 'neutral'} onClick={() => navigate('/assignments/shift-changes')} />
            <OpsTile label="Approved, not moved" value={operations.shiftChangesApproved} onClick={() => navigate('/assignments/shift-changes')} />
            <OpsTile label="Active leaves" value={operations.activeLeaves} onClick={() => navigate('/memberships/leave')} />
            <OpsTile label="Upcoming leaves" value={operations.upcomingLeaves} onClick={() => navigate('/memberships/leave')} />
            <OpsTile label="Open maintenance" value={operations.maintenanceOpen} tone={operations.maintenanceHigh ? 'error' : 'neutral'} sub={operations.maintenanceHigh ? `${operations.maintenanceHigh} high priority` : undefined} onClick={() => navigate('/maintenance')} />
            <OpsTile label="Waiting for a seat" value={operations.waitlist} onClick={() => navigate('/assignments/waitlist')} />
          </div>

          {operations.inactiveWarnings.length > 0 && (
            <div className="callout callout-warning mt-4">
              <AlertTriangle size={15} className="callout-icon" />
              <div>
                <span className="callout-title">
                  {operations.inactiveWarnings.length} seat{operations.inactiveWarnings.length === 1 ? '' : 's'} may be sitting idle
                </span>
                <span className="text-sm">
                  No attendance for {report.thresholds.inactiveAfterDays}+ days:{' '}
                  {operations.inactiveWarnings.slice(0, 4).map((w) => `${w.name} (${w.seat})`).join(', ')}
                  {operations.inactiveWarnings.length > 4 ? ` and ${operations.inactiveWarnings.length - 4} more` : ''}.
                </span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Seat breakdown ── */}
        <SectionCard title="Seat utilisation" subtitle={`${seats.inUse} of ${seats.total} seats in use`} className="report-span-2">
          <div className="seat-breakdown">
            <SeatStat label="In use" value={seats.inUse} tone="primary" total={seats.total} />
            <SeatStat label="Available" value={seats.available} tone="success" total={seats.total} />
            <SeatStat label="Temporarily released" value={seats.temporarilyReleased} tone="amber" total={seats.total} />
            <SeatStat label="Reserved" value={seats.reserved} tone="warning" total={seats.total} />
            <SeatStat label="Maintenance" value={seats.maintenance} tone="gray" total={seats.total} />
            <SeatStat label="Blocked" value={seats.blocked} tone="dark" total={seats.total} />
          </div>
        </SectionCard>
      </div>

      {/* ── New admissions ── */}
      {st.newAdmissionNames.length > 0 && (
        <SectionCard title="New admissions today" subtitle={`${st.newAdmissions} student${st.newAdmissions === 1 ? '' : 's'} joined`}>
          <div className="chip-row">
            {st.newAdmissionNames.map((name) => (
              <span key={name} className="chip">{name}</span>
            ))}
          </div>
        </SectionCard>
      )}

      <footer className="report-footer">
        <Settings2 size={13} />
        <span>
          Thresholds: memberships flagged {report.thresholds.expiringWithinDays} days before expiry · seats flagged after{' '}
          {report.thresholds.inactiveAfterDays} days without attendance · report generated {relativeDay(report.date)}.
        </span>
      </footer>
    </div>
  );
}

// ============================================================
// Building blocks
// ============================================================
function HeadlineBlock({ icon: Icon, title, primary, primaryLabel, rows, footer, onClick }) {
  return (
    <button type="button" className="headline-block" onClick={onClick}>
      <div className="headline-head">
        <Icon size={15} />
        <span>{title}</span>
      </div>
      <div className="headline-primary">
        <span className="headline-value">{primary}</span>
        <span className="headline-label">{primaryLabel}</span>
      </div>
      <div className="headline-rows">
        {rows.map((r) => (
          <div key={r.label} className="headline-row">
            <span>{r.label}</span>
            <strong className={r.tone ? `text-${r.tone}` : ''}>{r.value}</strong>
          </div>
        ))}
      </div>
      <div className="headline-footer">{footer}</div>
    </button>
  );
}

function InlineStat({ label, value }) {
  return (
    <div className="inline-stat">
      <span className="inline-stat-value">{value}</span>
      <span className="inline-stat-label">{label}</span>
    </div>
  );
}

function MoneyRow({ label, value, tone, strong, divider }) {
  return (
    <div className={`money-row ${divider ? 'has-divider' : ''} ${strong ? 'is-strong' : ''}`}>
      <span>{label}</span>
      <strong className={tone ? `text-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function OpsTile({ label, value, tone = 'neutral', sub, onClick }) {
  return (
    <button type="button" className={`ops-tile ops-${tone}`} onClick={onClick}>
      <span className="ops-value">{value}</span>
      <span className="ops-label">{label}</span>
      {sub && <span className="ops-sub">{sub}</span>}
    </button>
  );
}

function SeatStat({ label, value, tone, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="seat-stat">
      <span className={`seat-stat-swatch swatch-${tone}`} />
      <div className="seat-stat-body">
        <div className="seat-stat-head">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
        <div className="seat-stat-bar">
          <span className={`seat-stat-fill swatch-${tone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
