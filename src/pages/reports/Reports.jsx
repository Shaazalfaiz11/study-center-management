import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Armchair, CalendarCheck, IndianRupee, BadgeCheck, ArrowRight, FileBarChart } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import { SectionCard, ProgressBar, StatusBadge } from '../../components/ui/Primitives';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { SkeletonCards } from '../../components/ui/StateViews';
import reportService from '../../services/reportService';
import attendanceService from '../../services/attendanceService';
import { formatCurrency, formatCurrencyCompact, formatDate, daysSince, isPotentiallyInactive } from '../../services/businessRules';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const SERIES = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#dc2626', '#64748b', '#0891b2', '#65a30d'];

const TABS = [
  { key: 'occupancy', label: 'Occupancy', icon: Armchair },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'revenue', label: 'Revenue', icon: IndianRupee },
  { key: 'memberships', label: 'Memberships', icon: BadgeCheck },
  { key: 'students', label: 'Students', icon: Users },
];

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 10, font: { size: 11, family: 'Inter' } } },
  },
};

export default function Reports() {
  const { students, desks, attendance, payments, expenses, membershipPlans, stats } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('occupancy');

  const { data: occupancy, loading: occLoading } = useAsync(() => reportService.getOccupancyReport(), [desks, students]);
  const { data: revenue, loading: revLoading } = useAsync(() => reportService.getRevenueReport(), [payments, expenses]);
  const { data: slotAttendance } = useAsync(() => attendanceService.getSlotAttendance(), [attendance]);

  const sourceData = useMemo(() => {
    const counts = {};
    students.forEach((s) => {
      counts[s.source] = (counts[s.source] || 0) + 1;
    });
    return { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: SERIES, borderWidth: 0 }] };
  }, [students]);

  const examData = useMemo(() => {
    const counts = {};
    students.forEach((s) => {
      if (s.exam) counts[s.exam] = (counts[s.exam] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { labels: sorted.map(([k]) => k), datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: SERIES, borderWidth: 0 }] };
  }, [students]);

  const planData = useMemo(() => {
    const counts = {};
    students.forEach((s) => {
      counts[s.membershipPlan] = (counts[s.membershipPlan] || 0) + 1;
    });
    return {
      labels: Object.keys(counts),
      datasets: [{ label: 'Students', data: Object.values(counts), backgroundColor: SERIES[0], borderRadius: 3, barPercentage: 0.65 }],
    };
  }, [students]);

  const idleSeats = useMemo(() => students.filter(isPotentiallyInactive), [students]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b' } },
      y: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b', precision: 0 } },
    },
  };

  return (
    <div className="page-stack">
      <div className="data-table-toolbar">
        <div className="segmented">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`segmented-item ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
        <div className="data-table-toolbar-right">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/reports/daily')}>
            <FileBarChart size={14} /> Daily Operations Report
          </button>
        </div>
      </div>

      {/* ── Occupancy ── */}
      {tab === 'occupancy' && (
        <div className="page-stack">
          <StatGrid>
            <StatCard icon={Armchair} label="Occupancy" value={`${stats.occupancyRate}%`} sublabel={`${stats.assignedSeats + stats.occupiedSeats} of ${stats.totalSeats} seats`} />
            <StatCard label="Available" value={stats.availableSeats} tone="success" sublabel="Ready to assign" />
            <StatCard label="Temporarily free" value={stats.temporarilyReleasedSeats} tone="warning" sublabel="Holder on leave" />
            <StatCard label="Out of service" value={stats.maintenanceSeats + stats.blockedSeats} sublabel="Maintenance or blocked" />
          </StatGrid>

          <div className="reports-grid">
            <SectionCard title="Occupancy by section">
              {occLoading || !occupancy ? (
                <SkeletonCards count={1} height={180} />
              ) : (
                <div className="report-bars">
                  {occupancy.sections.map((s) => (
                    <div key={s.section} className="report-bar">
                      <div className="report-bar-head">
                        <span>Section {s.section} <span className="text-muted">· {s.zone}</span></span>
                        <span className="font-semibold">{s.rate}%</span>
                      </div>
                      <ProgressBar value={s.rate} />
                      <span className="report-bar-sub">{s.inUse} in use · {s.available} free · {s.blocked} unavailable</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Occupancy by shift">
              {occLoading || !occupancy ? (
                <SkeletonCards count={1} height={180} />
              ) : (
                <div className="report-bars">
                  {occupancy.shifts.map((s) => (
                    <div key={s.name} className="report-bar">
                      <div className="report-bar-head">
                        <span>{s.name}</span>
                        <span className={`font-semibold ${s.rate >= 90 ? 'text-error' : s.rate >= 75 ? 'text-warning' : ''}`}>{s.rate}%</span>
                      </div>
                      <ProgressBar value={s.rate} />
                      <span className="report-bar-sub">{s.assigned} of {s.capacity} places</span>
                    </div>
                  ))}
                  {occupancy.unseated > 0 && (
                    <div className="callout callout-warning">
                      <Users size={15} className="callout-icon" />
                      <div>{occupancy.unseated} active student{occupancy.unseated === 1 ? '' : 's'} without a seat.</div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Seats that may be idle"
              subtitle={`No attendance for 7+ days · ${idleSeats.length} seat${idleSeats.length === 1 ? '' : 's'}`}
              className="reports-span-2"
              padded={false}
            >
              {idleSeats.length === 0 ? (
                <div className="card-body text-sm text-secondary">Every assigned seat has been used in the last week.</div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Seat</th><th>Student</th><th>Shift</th><th>Last attendance</th><th>Membership</th><th /></tr>
                    </thead>
                    <tbody>
                      {idleSeats.map((s) => (
                        <tr key={s.id} className="is-clickable" onClick={() => navigate(`/students/${s.id}`)}>
                          <td className="cell-mono cell-strong">{s.deskNumber}</td>
                          <td className="cell-primary">{s.name}</td>
                          <td>{s.slotName}</td>
                          <td>
                            {s.lastAttendanceDate ? (
                              <span className="text-error">{formatDate(s.lastAttendanceDate)} · {daysSince(s.lastAttendanceDate)} days ago</span>
                            ) : (
                              <span className="text-error">Never checked in</span>
                            )}
                          </td>
                          <td><StatusBadge status={s.membershipStatus} /></td>
                          <td style={{ textAlign: 'right' }}><ArrowRight size={14} className="text-muted" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Attendance ── */}
      {tab === 'attendance' && (
        <div className="page-stack">
          <StatGrid>
            <StatCard icon={CalendarCheck} label="Present today" value={stats.todayPresent} tone="success" sublabel={`${stats.attendanceRate}% turnout`} />
            <StatCard label="Absent today" value={stats.todayAbsent} tone={stats.todayAbsent ? 'warning' : 'neutral'} sublabel="No check-in" />
            <StatCard label="Records held" value={attendance.length} sublabel="Last 45 days" />
            <StatCard label="Idle seat warnings" value={idleSeats.length} tone={idleSeats.length ? 'warning' : 'neutral'} sublabel="7+ days without attendance" />
          </StatGrid>

          <div className="reports-grid">
            <SectionCard title="Turnout by shift" subtitle="Today">
              <div className="report-bars">
                {(slotAttendance || []).map((s) => (
                  <div key={s.slotId} className="report-bar">
                    <div className="report-bar-head">
                      <span>{s.name}</span>
                      <span className="font-semibold">{s.attendanceRate}%</span>
                    </div>
                    <ProgressBar value={s.attendanceRate} tone={s.attendanceRate >= 75 ? 'success' : s.attendanceRate >= 50 ? 'warning' : 'error'} />
                    <span className="report-bar-sub">{s.present} present of {s.total} expected</span>
                  </div>
                ))}
                {(!slotAttendance || slotAttendance.length === 0) && <SkeletonCards count={1} height={140} />}
              </div>
            </SectionCard>

            <SectionCard title="Attendance mix" subtitle="Last 45 days">
              <div style={{ height: 240 }}>
                <Doughnut
                  data={{
                    labels: ['Present', 'Late', 'Absent', 'On leave'],
                    datasets: [
                      {
                        data: [
                          attendance.filter((a) => a.status === 'present').length,
                          attendance.filter((a) => a.status === 'late').length,
                          attendance.filter((a) => a.status === 'absent').length,
                          attendance.filter((a) => a.status === 'leave').length,
                        ],
                        backgroundColor: ['#16a34a', '#d97706', '#dc2626', '#64748b'],
                        borderWidth: 0,
                      },
                    ],
                  }}
                  options={doughnutOptions}
                />
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Revenue ── */}
      {tab === 'revenue' && (
        <div className="page-stack">
          <StatGrid>
            <StatCard icon={IndianRupee} label="This month" value={formatCurrency(stats.monthlyRevenue)} tone="success" sublabel="Collected" />
            <StatCard label="Expenses" value={formatCurrency(stats.monthlyExpenses)} tone="error" sublabel="This month" />
            <StatCard label="Net profit" value={formatCurrency(stats.netProfit)} tone={stats.netProfit >= 0 ? 'success' : 'error'} sublabel="Revenue minus expenses" />
            <StatCard label="Outstanding" value={formatCurrency(stats.totalOutstanding)} tone="warning" sublabel="Still to collect" />
          </StatGrid>

          <div className="reports-grid">
            <SectionCard title="Six-month trend" className="reports-span-2">
              <div style={{ height: 280 }}>
                {revLoading || !revenue ? (
                  <SkeletonCards count={1} height={260} />
                ) : (
                  <Bar
                    data={{
                      labels: revenue.months.map((m) => m.month),
                      datasets: [
                        { label: 'Revenue', data: revenue.months.map((m) => m.revenue), backgroundColor: SERIES[0], borderRadius: 3, barPercentage: 0.7 },
                        { label: 'Expenses', data: revenue.months.map((m) => m.expenses), backgroundColor: '#cbd5e1', borderRadius: 3, barPercentage: 0.7 },
                      ],
                    }}
                    options={{
                      ...barOptions,
                      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 14, font: { size: 11, family: 'Inter' } } } },
                      scales: { ...barOptions.scales, y: { ...barOptions.scales.y, ticks: { ...barOptions.scales.y.ticks, callback: (v) => formatCurrencyCompact(v) } } },
                    }}
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard title="Revenue by plan">
              <div style={{ height: 250 }}>
                {revenue && (
                  <Doughnut
                    data={{ labels: Object.keys(revenue.byPlan), datasets: [{ data: Object.values(revenue.byPlan), backgroundColor: SERIES, borderWidth: 0 }] }}
                    options={doughnutOptions}
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard title="Revenue by payment method">
              <div style={{ height: 250 }}>
                {revenue && (
                  <Doughnut
                    data={{ labels: Object.keys(revenue.byMethod), datasets: [{ data: Object.values(revenue.byMethod), backgroundColor: SERIES, borderWidth: 0 }] }}
                    options={doughnutOptions}
                  />
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Memberships ── */}
      {tab === 'memberships' && (
        <div className="page-stack">
          <StatGrid>
            <StatCard icon={BadgeCheck} label="Active" value={students.filter((s) => s.membershipStatus === 'active').length} tone="success" sublabel="In date" />
            <StatCard label="Expiring" value={stats.expiringMemberships} tone="warning" sublabel="Within 7 days" />
            <StatCard label="Expired" value={stats.expiredMemberships} tone="error" sublabel="Need renewal" />
            <StatCard label="Paused" value={stats.pausedMemberships} sublabel="On leave" />
          </StatGrid>

          <div className="reports-grid">
            <SectionCard title="Students per plan" className="reports-span-2">
              <div style={{ height: 260 }}>
                <Bar data={planData} options={barOptions} />
              </div>
            </SectionCard>

            <SectionCard title="Plan pricing" padded={false}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Plan</th><th>Duration</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Students</th></tr>
                  </thead>
                  <tbody>
                    {membershipPlans.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-primary">{p.name}</td>
                        <td>{p.duration} {p.durationUnit}</td>
                        <td className="cell-num" style={{ textAlign: 'right' }}>{formatCurrency(p.price)}</td>
                        <td className="cell-num" style={{ textAlign: 'right' }}>{students.filter((s) => s.membershipPlanId === p.id).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Students ── */}
      {tab === 'students' && (
        <div className="page-stack">
          <StatGrid>
            <StatCard icon={Users} label="Total on register" value={stats.totalStudents} sublabel={`${stats.activeStudents} active`} />
            <StatCard label="On leave" value={stats.onLeaveStudents} sublabel="Membership paused" />
            <StatCard label="Inactive" value={stats.inactiveStudents} sublabel="Lapsed and unseated" />
            <StatCard label="On the waitlist" value={stats.waitlistCount} sublabel="Waiting for a seat" onClick={() => navigate('/assignments/waitlist')} />
          </StatGrid>

          <div className="reports-grid">
            <SectionCard title="How students found us">
              <div style={{ height: 260 }}>
                <Doughnut data={sourceData} options={doughnutOptions} />
              </div>
            </SectionCard>

            <SectionCard title="What they are preparing for">
              <div style={{ height: 260 }}>
                <Doughnut data={examData} options={doughnutOptions} />
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
