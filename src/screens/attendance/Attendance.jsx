import { useState, useMemo } from 'react';
import { LogIn, LogOut, Check, X as XIcon, CalendarCheck, CalendarDays, Users, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { StatusBadge, ProgressBar } from '../../components/ui/Primitives';
import { SkeletonCards } from '../../components/ui/StateViews';
import attendanceService from '../../services/attendanceService';
import { formatDate, todayISO } from '../../services/businessRules';
import './Attendance.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Attendance() {
  const { attendance, slots, addToast } = useApp();
  const [view, setView] = useState('daily');
  const [date, setDate] = useState(todayISO());
  const [slotId, setSlotId] = useState('all');
  const [status, setStatus] = useState('all');

  const { data: records, loading, error, retry } = useAsync(
    () => attendanceService.getAttendance({ date, slotId, status }),
    [date, slotId, status, attendance],
  );

  const { data: summary } = useAsync(() => attendanceService.getAttendanceSummary(date), [date, attendance]);
  const { data: bySlot } = useAsync(() => attendanceService.getSlotAttendance(date), [date, attendance]);
  const { data: monthDays } = useAsync(() => attendanceService.getMonthlyOverview(date.slice(0, 7)), [date.slice(0, 7), attendance]);

  const act = async (fn, message) => {
    try {
      const result = await fn();
      addToast(message(result), 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const columns = [
    { key: 'deskNumber', header: 'Seat', sortable: true, accessor: (r) => r.deskNumber, render: (r) => (r.deskNumber ? <span className="cell-mono cell-primary">{r.deskNumber}</span> : <span className="text-muted">—</span>) },
    { key: 'studentName', header: 'Student', sortable: true, accessor: (r) => r.studentName, className: 'cell-primary' },
    { key: 'slotName', header: 'Shift', sortable: true, hideBelow: 'md', accessor: (r) => r.slotName },
    { key: 'checkIn', header: 'Check-in', sortable: true, accessor: (r) => r.checkIn, render: (r) => r.checkIn || <span className="text-muted">—</span> },
    { key: 'checkOut', header: 'Check-out', sortable: true, accessor: (r) => r.checkOut, render: (r) => r.checkOut || <span className="text-muted">—</span> },
    { key: 'markedBy', header: 'Source', hideBelow: 'lg', accessor: (r) => r.markedBy },
    { key: 'status', header: 'Status', sortable: true, accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 140,
      render: (r) => (
        <div className="cell-actions">
          {!r.checkIn && (
            <button type="button" className="icon-btn" title="Check in" onClick={() => act(() => attendanceService.checkIn({ recordId: r.id }), (res) => `${res.studentName} checked in`)}>
              <LogIn size={14} />
            </button>
          )}
          {r.checkIn && !r.checkOut && (
            <button type="button" className="icon-btn" title="Check out" onClick={() => act(() => attendanceService.checkOut({ recordId: r.id }), (res) => `${res.studentName} checked out`)}>
              <LogOut size={14} />
            </button>
          )}
          <button type="button" className="icon-btn" title="Mark present" onClick={() => act(() => attendanceService.markAttendance({ recordId: r.id, status: 'present' }), () => 'Marked present')}>
            <Check size={14} />
          </button>
          <button type="button" className="icon-btn" title="Mark absent" onClick={() => act(() => attendanceService.markAttendance({ recordId: r.id, status: 'absent' }), () => 'Marked absent')}>
            <XIcon size={14} />
          </button>
        </div>
      ),
    },
  ];

  const calendarCells = useMemo(() => {
    if (!monthDays || monthDays.length === 0) return [];
    const leading = monthDays[0].weekday;
    return [...Array.from({ length: leading }, () => null), ...monthDays];
  }, [monthDays]);

  return (
    <div className="page-stack">
      {!summary ? (
        <SkeletonCards count={4} />
      ) : (
        <StatGrid>
          <StatCard icon={Users} label="Present" value={summary.present} tone="success" sublabel={`${summary.rate}% of ${summary.total} expected`} />
          <StatCard icon={XIcon} label="Absent" value={summary.absent} tone={summary.absent ? 'error' : 'neutral'} sublabel="No check-in recorded" />
          <StatCard icon={Clock} label="Late arrivals" value={summary.late} tone={summary.late ? 'warning' : 'neutral'} sublabel="After shift start" />
          <StatCard icon={CalendarCheck} label="Currently inside" value={Math.max(0, summary.checkedIn - summary.checkedOut)} sublabel={`${summary.checkedOut} checked out`} />
        </StatGrid>
      )}

      <div className="data-table-toolbar">
        <div className="segmented">
          <button type="button" className={`segmented-item ${view === 'daily' ? 'is-active' : ''}`} onClick={() => setView('daily')}>
            <CalendarCheck size={13} /> Daily
          </button>
          <button type="button" className={`segmented-item ${view === 'monthly' ? 'is-active' : ''}`} onClick={() => setView('monthly')}>
            <CalendarDays size={13} /> Monthly
          </button>
        </div>

        <label className="inline-field">
          <span className="inline-field-label">Date</span>
          <input type="date" className="form-input form-select-sm" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>

        {date !== todayISO() && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(todayISO())}>
            Back to today
          </button>
        )}
      </div>

      {/* Shift breakdown */}
      {bySlot && bySlot.length > 0 && (
        <div className="attendance-shifts">
          {bySlot.map((s) => (
            <div key={s.slotId} className="attendance-shift">
              <div className="attendance-shift-head">
                <span className="attendance-shift-name">{s.name}</span>
                <span className="attendance-shift-figure">
                  <strong>{s.present}</strong>/{s.total}
                </span>
              </div>
              <ProgressBar value={s.attendanceRate} tone={s.attendanceRate >= 75 ? 'success' : s.attendanceRate >= 50 ? 'warning' : 'error'} />
              <span className="attendance-shift-sub">{s.attendanceRate}% present · {s.assigned} assigned</span>
            </div>
          ))}
        </div>
      )}

      {view === 'daily' ? (
        <DataTable
          columns={columns}
          rows={records || []}
          loading={loading}
          error={error}
          onRetry={retry}
          pageSize={14}
          searchPlaceholder="Search by student or seat…"
          searchKeys={['studentName', 'deskNumber']}
          exportFileName={`attendance-${date}.csv`}
          emptyIcon={CalendarCheck}
          emptyTitle="No attendance records for this date"
          emptyDescription={date === todayISO() ? 'Records appear as students check in.' : 'The centre may have been closed on this date.'}
          filters={[
            {
              key: 'slot',
              label: 'Shift',
              value: slotId,
              onChange: setSlotId,
              options: [{ value: 'all', label: 'All shifts' }, ...slots.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))],
            },
            {
              key: 'status',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: [
                { value: 'all', label: 'All' },
                { value: 'present', label: 'Present' },
                { value: 'late', label: 'Late' },
                { value: 'absent', label: 'Absent' },
                { value: 'leave', label: 'On leave' },
              ],
            },
          ]}
        />
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{formatDate(date).split(' ').slice(1).join(' ')}</span>
            <input type="month" className="form-input form-select-sm" value={date.slice(0, 7)} onChange={(e) => setDate(`${e.target.value}-01`)} style={{ width: 'auto' }} />
          </div>
          <div className="card-body">
            <div className="attendance-calendar">
              {WEEKDAYS.map((d) => (
                <div key={d} className="attendance-calendar-head">{d}</div>
              ))}
              {calendarCells.map((day, i) =>
                day === null ? (
                  <div key={`blank-${i}`} />
                ) : (
                  <button
                    key={day.date}
                    type="button"
                    className={`attendance-day ${day.total === 0 ? 'is-empty' : ''} ${day.date === todayISO() ? 'is-today' : ''}`}
                    onClick={() => {
                      setDate(day.date);
                      setView('daily');
                    }}
                  >
                    <span className="attendance-day-num">{day.day}</span>
                    {day.total > 0 && (
                      <>
                        <span
                          className="attendance-day-bar"
                          style={{ '--fill': `${Math.round((day.present / day.total) * 100)}%` }}
                        />
                        <span className="attendance-day-count">{day.present}/{day.total}</span>
                      </>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
