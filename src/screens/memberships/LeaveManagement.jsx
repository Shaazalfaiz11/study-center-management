import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarOff, Plus, Play, CalendarPlus, XCircle, Eye, Armchair,
  PauseCircle, CalendarClock, CheckCircle2, Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, StatusBadge, DetailRow, Avatar, ActionButton, SectionCard } from '../../components/ui/Primitives';
import { SkeletonCards } from '../../components/ui/StateViews';
import membershipService from '../../services/membershipService';
import { formatDate, relativeDay, todayISO, addDays, daysBetween, daysUntil } from '../../services/businessRules';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

/**
 * Pausing a membership keeps the student on the books, preserves
 * their remaining days, and frees the seat only for the length of
 * the leave.
 */
export default function LeaveManagement() {
  const { leaves, students, desks, addToast, confirm } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState('active');
  const [showNew, setShowNew] = useState(false);
  const [action, setAction] = useState(null); // { type, leave }

  const { data: rows, loading, error, retry } = useAsync(() => membershipService.getLeaves({ status: tab }), [tab, leaves]);

  const summary = useMemo(() => {
    const count = (s) => leaves.filter((l) => l.status === s).length;
    return { active: count('active'), upcoming: count('upcoming'), completed: count('completed'), cancelled: count('cancelled') };
  }, [leaves]);

  const seatsReleased = useMemo(() => desks.filter((d) => d.status === 'temporarily_released').length, [desks]);

  const enrich = (leave) => {
    const student = students.find((s) => s.id === leave.studentId);
    const end = leave.extendedTo || leave.endDate;
    return {
      ...leave,
      end,
      student,
      totalDays: daysBetween(leave.startDate, end) + 1,
      daysLeft: leave.status === 'active' ? Math.max(0, daysUntil(end)) : null,
      remainingMembershipDays: student ? Math.max(0, daysUntil(student.membershipExpiry)) : 0,
    };
  };

  const enriched = (rows || []).map(enrich);

  const columns = [
    {
      key: 'studentName',
      header: 'Student',
      sortable: true,
      accessor: (r) => r.studentName,
      render: (r) => (
        <div className="cell-student">
          <Avatar name={r.studentName} size={28} />
          <div className="cell-student-info">
            <span className="cell-student-name">{r.studentName}</span>
            <span className="cell-student-sub">{r.studentIdNum} · {r.slotName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Leave Period',
      sortable: true,
      accessor: (r) => r.startDate,
      render: (r) => (
        <div className="cell-stack">
          <span>{formatDate(r.startDate)} → {formatDate(r.end)}</span>
          <span className="cell-student-sub">
            {r.totalDays} days{r.extendedTo ? ' · extended' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      hideBelow: 'lg',
      accessor: (r) => r.reason,
      render: (r) => <span className="cell-clamp">{r.reason || '—'}</span>,
    },
    {
      key: 'seat',
      header: 'Seat',
      hideBelow: 'md',
      accessor: (r) => r.deskNumber,
      render: (r) => (
        <div className="cell-stack">
          <span className="cell-mono">{r.deskNumber || '—'}</span>
          <span className="cell-student-sub">{r.seatAction === 'released' ? 'Temporarily released' : 'Held for student'}</span>
        </div>
      ),
    },
    {
      key: 'remaining',
      header: 'Days Left',
      align: 'right',
      sortable: true,
      accessor: (r) => r.remainingMembershipDays,
      render: (r) => (
        <div className="cell-stack cell-stack-right">
          <span className="cell-num cell-strong">{r.remainingMembershipDays}</span>
          <span className="cell-student-sub">membership days</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => (
        <div className="cell-stack">
          <StatusBadge status={r.status} />
          {r.status === 'active' && <span className="cell-student-sub">Returns {relativeDay(r.end)}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 210,
      render: (r) => (
        <div className="cell-actions">
          {r.status === 'active' && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAction({ type: 'resume', leave: r })}>
                <Play size={12} /> Resume
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'extend', leave: r })}>
                <CalendarPlus size={12} /> Extend
              </button>
            </>
          )}
          {r.status === 'upcoming' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'extend', leave: r })}>
              <CalendarPlus size={12} /> Change dates
            </button>
          )}
          {(r.status === 'active' || r.status === 'upcoming') && (
            <button type="button" className="icon-btn" title="Cancel leave" onClick={() => setAction({ type: 'cancel', leave: r })}>
              <XCircle size={14} />
            </button>
          )}
          <button type="button" className="icon-btn" title="View student" onClick={() => navigate(`/students/${r.studentId}`)}>
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      {loading && !rows ? (
        <SkeletonCards count={4} />
      ) : (
        <StatGrid>
          <StatCard icon={PauseCircle} label="On leave now" value={summary.active} tone={summary.active ? 'primary' : 'neutral'} sublabel="Memberships paused" onClick={() => setTab('active')} />
          <StatCard icon={CalendarClock} label="Upcoming" value={summary.upcoming} sublabel="Scheduled ahead" onClick={() => setTab('upcoming')} />
          <StatCard icon={Armchair} label="Seats released" value={seatsReleased} tone={seatsReleased ? 'warning' : 'neutral'} sublabel="Available short term" onClick={() => navigate('/seats/map')} />
          <StatCard icon={CheckCircle2} label="Completed" value={summary.completed} sublabel="Returned to the centre" onClick={() => setTab('completed')} />
        </StatGrid>
      )}

      <div className="callout callout-info">
        <Info size={15} className="callout-icon" />
        <div>
          <span className="callout-title">How a pause works</span>
          The student stays on the register, their remaining membership days are preserved, and the expiry date is pushed
          out by exactly the number of days paused when they resume. The seat can be offered to someone else in the meantime
          without giving up the original assignment.
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={enriched}
        loading={loading}
        error={error}
        onRetry={retry}
        pageSize={10}
        searchPlaceholder="Search by student name or ID…"
        searchKeys={['studentName', 'reason']}
        exportFileName={`leaves-${tab}.csv`}
        emptyIcon={CalendarOff}
        emptyTitle={tab === 'active' ? 'Nobody is on leave right now' : 'No leave records'}
        emptyDescription={tab === 'active' ? 'When a student goes home for a while, pause their membership so they do not lose days.' : 'Try another status filter.'}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <Plus size={14} /> Start a leave
          </button>
        }
        toolbarExtra={
          <div className="segmented">
            {TABS.map((t) => {
              const count = t.key === 'all' ? leaves.length : summary[t.key];
              return (
                <button key={t.key} type="button" className={`segmented-item ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
                  {t.label}
                  {count > 0 && <span className="segmented-count">{count}</span>}
                </button>
              );
            })}
          </div>
        }
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <Plus size={14} /> Start Leave
          </button>
        }
      />

      <StartLeaveModal open={showNew} onClose={() => setShowNew(false)} students={students} addToast={addToast} confirm={confirm} />
      <LeaveActionModals key={action ? `${action.type}-${action.leave.id}` : 'none'} action={action} onClose={() => setAction(null)} addToast={addToast} confirm={confirm} />
    </div>
  );
}

// ============================================================
// Start a new leave
// ============================================================
function StartLeaveModal({ open, onClose, students, addToast, confirm }) {
  const blank = { studentId: '', startDate: todayISO(), endDate: addDays(todayISO(), 10), reason: '', seatAction: 'released' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const student = students.find((s) => s.id === form.studentId);
  const totalDays = form.startDate && form.endDate ? daysBetween(form.startDate, form.endDate) + 1 : 0;
  const remainingDays = student ? Math.max(0, daysBetween(form.startDate, student.membershipExpiry)) : 0;

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const close = () => {
    setForm(blank);
    setErrors({});
    setPending(false);
    onClose();
  };

  const submit = async () => {
    const errs = {};
    if (!form.studentId) errs.studentId = 'Select a student';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (!form.endDate) errs.endDate = 'End date is required';
    if (form.endDate && form.startDate && form.endDate < form.startDate) errs.endDate = 'End date must be after the start date';
    if (!form.reason.trim()) errs.reason = 'Record the reason';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const startsToday = form.startDate <= todayISO();
    const ok = await confirm({
      title: startsToday ? 'Pause this membership?' : 'Schedule this leave?',
      confirmLabel: startsToday ? 'Pause membership' : 'Schedule leave',
      message: `${student.name}'s membership will be ${startsToday ? 'paused now' : `paused from ${formatDate(form.startDate)}`} for ${totalDays} days.`,
      details: (
        <div className="confirm-list">
          <DetailRow label="Membership" value="Paused" />
          <DetailRow label="Seat" value={student.deskNumber ? (form.seatAction === 'released' ? `${student.deskNumber} → temporarily released` : `${student.deskNumber} → held`) : 'No seat assigned'} />
          <DetailRow label="Days preserved" value={`${remainingDays} days`} />
          <DetailRow label="Student record" value="Stays active" />
        </div>
      ),
    });
    if (!ok) return;

    setPending(true);
    try {
      await membershipService.pauseMembership(form);
      addToast(startsToday ? 'Membership paused' : 'Leave scheduled', 'success', {
        description: `${student.name} · ${formatDate(form.startDate)} → ${formatDate(form.endDate)}`,
      });
      close();
    } catch (err) {
      addToast(err.message, 'error');
      setPending(false);
    }
  };

  const eligible = useMemo(
    () => students.filter((s) => s.status !== 'inactive' && !s.onLeave).sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Start a leave"
      description="Pause a membership without losing the student or their remaining days."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Continue</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="leave-student">Student <span className="required">*</span></label>
          <select id="leave-student" className={`form-select ${errors.studentId ? 'error' : ''}`} value={form.studentId} onChange={(e) => set('studentId', e.target.value)}>
            <option value="">Select a student…</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.studentId}){s.deskNumber ? ` — ${s.deskNumber}` : ''}
              </option>
            ))}
          </select>
          {errors.studentId && <span className="form-error">{errors.studentId}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="leave-start">From <span className="required">*</span></label>
            <input id="leave-start" type="date" className={`form-input ${errors.startDate ? 'error' : ''}`} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            {errors.startDate && <span className="form-error">{errors.startDate}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="leave-end">To <span className="required">*</span></label>
            <input id="leave-end" type="date" className={`form-input ${errors.endDate ? 'error' : ''}`} value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} />
            {errors.endDate && <span className="form-error">{errors.endDate}</span>}
          </div>
        </div>

        {student && (
          <SectionCard title="What will change" padded={false}>
            <div className="card-body" style={{ paddingTop: 0 }}>
              <DetailRow label="Leave length" value={`${totalDays} day${totalDays === 1 ? '' : 's'}`} />
              <DetailRow label="Membership" value={<><StatusBadge status="active" /> → <StatusBadge status="paused" /></>} />
              <DetailRow label="Current seat" value={student.deskNumber || 'None'} />
              <DetailRow label="Remaining days preserved" value={<strong>{remainingDays} days</strong>} />
              <DetailRow label="New expiry on resume" value={formatDate(addDays(student.membershipExpiry, totalDays))} />
            </div>
          </SectionCard>
        )}

        {student?.deskNumber && (
          <div className="form-group">
            <span className="form-label">Seat handling</span>
            <div className="radio-cards">
              <label className={`radio-card ${form.seatAction === 'released' ? 'is-selected' : ''}`}>
                <input type="radio" name="seatAction" value="released" checked={form.seatAction === 'released'} onChange={(e) => set('seatAction', e.target.value)} />
                <div>
                  <strong>Temporarily release</strong>
                  <span>Seat {student.deskNumber} can be offered to someone else until they return. The assignment is kept.</span>
                </div>
              </label>
              <label className={`radio-card ${form.seatAction === 'reserved' ? 'is-selected' : ''}`}>
                <input type="radio" name="seatAction" value="reserved" checked={form.seatAction === 'reserved'} onChange={(e) => set('seatAction', e.target.value)} />
                <div>
                  <strong>Hold the seat</strong>
                  <span>Keep {student.deskNumber} empty and reserved for their return.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="leave-reason">Reason <span className="required">*</span></label>
          <textarea
            id="leave-reason"
            className={`form-textarea ${errors.reason ? 'error' : ''}`}
            rows={2}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="e.g. Going home to Gorakhpur for a family function"
          />
          {errors.reason && <span className="form-error">{errors.reason}</span>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Resume / extend / cancel
// ============================================================
function LeaveActionModals({ action, onClose, addToast, confirm }) {
  const [newEnd, setNewEnd] = useState('');
  const [pending, setPending] = useState(false);

  const leave = action?.leave;

  const close = () => {
    setNewEnd('');
    setPending(false);
    onClose();
  };

  if (!action || !leave) return null;

  // ── Resume ───────────────────────────────────────────────
  if (action.type === 'resume') {
    const pausedDays = Math.max(0, daysBetween(leave.startDate, todayISO()));
    const newExpiry = leave.student ? addDays(leave.student.membershipExpiry, pausedDays) : null;

    const submit = async () => {
      const ok = await confirm({
        title: 'Resume this membership?',
        confirmLabel: 'Resume membership',
        message: `${leave.studentName} returns to the centre today. Their membership becomes active again and the paused days are added to the expiry date.`,
        details: (
          <div className="confirm-list">
            <DetailRow label="Days paused" value={`${pausedDays} days`} />
            <DetailRow label="New expiry" value={newExpiry ? formatDate(newExpiry) : '—'} />
            <DetailRow label="Seat" value={leave.deskNumber ? `${leave.deskNumber} returns to them` : 'No seat to restore'} />
          </div>
        ),
      });
      if (!ok) return;

      setPending(true);
      try {
        const result = await membershipService.resumeMembership({ leaveId: leave.id });
        addToast('Membership resumed', 'success', {
          description: result.tempStudentName
            ? `${leave.studentName} is back on ${result.seatNumber}. ${result.tempStudentName}'s temporary use has ended.`
            : `${leave.studentName} is active again until ${formatDate(result.newExpiry)}.`,
        });
        close();
      } catch (err) {
        addToast(err.message, 'error');
        setPending(false);
      }
    };

    return (
      <Modal
        open
        onClose={close}
        title="Resume membership"
        description={leave.studentName}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit}>
              <Play size={14} /> Resume
            </ActionButton>
          </>
        }
      >
        <div className="summary-panel">
          <DetailRow label="Leave started" value={formatDate(leave.startDate)} />
          <DetailRow label="Planned return" value={formatDate(leave.end)} />
          <DetailRow label="Days paused so far" value={`${pausedDays} days`} />
          <DetailRow label="Membership expiry moves to" value={newExpiry ? <strong>{formatDate(newExpiry)}</strong> : '—'} />
        </div>
      </Modal>
    );
  }

  // ── Extend ───────────────────────────────────────────────
  if (action.type === 'extend') {
    const submit = async () => {
      if (!newEnd) {
        addToast('Pick a new return date', 'error');
        return;
      }
      setPending(true);
      try {
        await membershipService.extendLeave({ leaveId: leave.id, newEndDate: newEnd });
        addToast('Leave extended', 'success', { description: `${leave.studentName} now returns on ${formatDate(newEnd)}.` });
        close();
      } catch (err) {
        addToast(err.message, 'error');
        setPending(false);
      }
    };

    return (
      <Modal
        open
        onClose={close}
        title="Extend leave"
        description={leave.studentName}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit}>Extend leave</ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="summary-panel">
            <DetailRow label="Current return date" value={formatDate(leave.end)} />
            <DetailRow label="Seat" value={leave.deskNumber || '—'} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="extend-date">New return date</label>
            <input id="extend-date" type="date" className="form-input" value={newEnd} min={addDays(leave.end, 1)} onChange={(e) => setNewEnd(e.target.value)} />
            <span className="form-hint">The extra days are also added back to the membership on resume.</span>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Cancel ───────────────────────────────────────────────
  const submitCancel = async () => {
    setPending(true);
    try {
      await membershipService.cancelLeave({ leaveId: leave.id });
      addToast('Leave cancelled', 'info', { description: `${leave.studentName}'s membership continues unchanged.` });
      close();
    } catch (err) {
      addToast(err.message, 'error');
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      title="Cancel this leave?"
      description={leave.studentName}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Keep leave</button>
          <ActionButton className="btn btn-danger" pending={pending} onClick={submitCancel}>
            <XCircle size={14} /> Cancel leave
          </ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="confirm-message">
          The membership continues as normal and no days are added to the expiry date.
        </p>
        <div className="summary-panel">
          <DetailRow label="Leave period" value={`${formatDate(leave.startDate)} → ${formatDate(leave.end)}`} />
          {leave.deskNumber && <DetailRow label="Seat" value={`${leave.deskNumber} returns to assigned`} />}
        </div>
      </div>
    </Modal>
  );
}
