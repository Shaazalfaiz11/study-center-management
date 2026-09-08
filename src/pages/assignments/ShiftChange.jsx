import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Repeat, Plus, ArrowRight, Check, X, CheckCircle2, Eye, AlertTriangle,
  Clock, Armchair, IndianRupee, MessageSquare, History,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Drawer, Modal, StatusBadge, DetailRow, Avatar, ActionButton, SectionCard } from '../../components/ui/Primitives';
import { SkeletonCards } from '../../components/ui/StateViews';
import assignmentService from '../../services/assignmentService';
import { formatDate, formatCurrency, relativeDay, todayISO, canApproveShiftChange, addDays } from '../../services/businessRules';

const STATUS_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export default function ShiftChange() {
  const { students, slots, desks, addToast, confirm, shiftChanges, stats } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [pending, setPending] = useState(false);

  const { data: requests, loading, error, retry } = useAsync(
    () => assignmentService.getShiftChanges({ status: tab }),
    [tab, shiftChanges],
  );

  const summary = useMemo(() => {
    const count = (s) => shiftChanges.filter((r) => r.status === s).length;
    return { pending: count('pending'), approved: count('approved'), completed: count('completed'), rejected: count('rejected') };
  }, [shiftChanges]);

  // Keep the drawer in sync after an action mutates the store.
  const current = selected ? shiftChanges.find((r) => r.id === selected.id) || selected : null;

  const columns = [
    {
      key: 'student',
      header: 'Student',
      accessor: (r) => r.studentName,
      sortable: true,
      render: (r) => (
        <div className="cell-student">
          <Avatar name={r.studentName} size={28} />
          <div className="cell-student-info">
            <span className="cell-student-name">{r.studentName}</span>
            <span className="cell-student-sub">{r.studentIdNum}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'change',
      header: 'Shift Change',
      accessor: (r) => `${r.currentSlotName} → ${r.requestedSlotName}`,
      render: (r) => (
        <span className="shift-change-arrow">
          <span className="shift-from">{r.currentSlotName}</span>
          <ArrowRight size={13} />
          <span className="shift-to">{r.requestedSlotName}</span>
        </span>
      ),
    },
    {
      key: 'seats',
      header: 'Seat',
      hideBelow: 'md',
      accessor: (r) => `${r.currentSeat || '—'} → ${r.newSeat || 'TBD'}`,
      render: (r) => (
        <span className="cell-mono">
          {r.currentSeat || '—'} <ArrowRight size={11} style={{ verticalAlign: 'middle', opacity: 0.5 }} /> {r.newSeat || <span className="text-muted">TBD</span>}
        </span>
      ),
    },
    {
      key: 'effectiveDate',
      header: 'Effective',
      sortable: true,
      accessor: (r) => r.effectiveDate,
      hideBelow: 'md',
      render: (r) => (
        <div className="cell-stack">
          <span>{formatDate(r.effectiveDate)}</span>
          <span className="cell-student-sub">{relativeDay(r.effectiveDate)}</span>
        </div>
      ),
    },
    {
      key: 'feeDifference',
      header: 'Fee Diff.',
      align: 'right',
      sortable: true,
      accessor: (r) => r.feeDifference,
      render: (r) =>
        r.feeDifference === 0 ? (
          <span className="text-muted">No change</span>
        ) : (
          <span className={`cell-num font-semibold ${r.feeDifference > 0 ? 'text-warning' : 'text-success'}`}>
            {r.feeDifference > 0 ? '+' : '−'}
            {formatCurrency(Math.abs(r.feeDifference))}
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 90,
      render: (r) => (
        <div className="cell-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(r)}>
            <Eye size={13} /> Review
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      {loading && !requests ? (
        <SkeletonCards count={4} />
      ) : (
        <StatGrid>
          <StatCard icon={Clock} label="Pending review" value={summary.pending} tone={summary.pending ? 'warning' : 'neutral'} sublabel="Awaiting a decision" onClick={() => setTab('pending')} />
          <StatCard icon={CheckCircle2} label="Approved" value={summary.approved} tone="primary" sublabel="Seat held, not yet moved" onClick={() => setTab('approved')} />
          <StatCard icon={Check} label="Completed" value={summary.completed} tone="success" sublabel="Transfer done" onClick={() => setTab('completed')} />
          <StatCard icon={Armchair} label="Seats free" value={stats.availableSeats} sublabel={`${stats.totalSeats} seats total`} onClick={() => navigate('/seats/map')} />
        </StatGrid>
      )}

      <DataTable
        columns={columns}
        rows={requests || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={setSelected}
        selectedRowId={current?.id}
        searchPlaceholder="Search by student name or ID…"
        searchKeys={['student', 'change']}
        pageSize={10}
        exportFileName="shift-changes.csv"
        emptyIcon={Repeat}
        emptyTitle={tab === 'pending' ? 'No pending shift change requests' : 'No shift change requests'}
        emptyDescription={tab === 'pending' ? 'New requests raised at the front desk will appear here for review.' : 'Try a different status filter.'}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New request
          </button>
        }
        toolbarExtra={
          <div className="segmented">
            {STATUS_TABS.map((t) => {
              const count = t.key === 'all' ? shiftChanges.length : summary[t.key];
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
            <Plus size={14} /> New Request
          </button>
        }
      />

      <RequestDrawer
        request={current}
        onClose={() => setSelected(null)}
        students={students}
        slots={slots}
        desks={desks}
        addToast={addToast}
        confirm={confirm}
        navigate={navigate}
        pending={pending}
        setPending={setPending}
      />

      <NewRequestModal
        open={showNew}
        onClose={() => setShowNew(false)}
        students={students}
        slots={slots}
        addToast={addToast}
      />
    </div>
  );
}

// ============================================================
// Review drawer — the full workflow for one request
// ============================================================
function RequestDrawer({ request, onClose, students, slots, desks, addToast, confirm, navigate, pending, setPending }) {
  const [seatId, setSeatId] = useState('');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const student = request ? students.find((s) => s.id === request.studentId) : null;
  const targetSlot = request ? slots.find((s) => s.id === request.requestedSlotId) : null;
  const availableSeats = useMemo(() => desks.filter((d) => d.status === 'available'), [desks]);

  const eligibility = useMemo(
    () => (request ? canApproveShiftChange({ targetSlot, availableSeats, student }) : { allowed: false, blockers: [] }),
    [request, targetSlot, availableSeats, student],
  );

  const heldSeat = request?.newSeatId ? desks.find((d) => d.id === request.newSeatId) : null;

  if (!request) return null;

  const reset = () => {
    setSeatId('');
    setNote('');
    setRejecting(false);
  };

  const handleApprove = async () => {
    if (!seatId) {
      addToast('Select a seat in the requested shift', 'error');
      return;
    }
    const seat = desks.find((d) => d.id === seatId);
    const ok = await confirm({
      title: 'Approve shift change?',
      tone: 'default',
      confirmLabel: 'Approve request',
      message: `${request.studentName} will be approved to move from the ${request.currentSlotName} shift to the ${request.requestedSlotName} shift.`,
      details: (
        <div className="confirm-list">
          <DetailRow label="Seat to hold" value={seat?.number} />
          <DetailRow label="Effective from" value={formatDate(request.effectiveDate)} />
          <DetailRow label="Fee difference" value={request.feeDifference ? formatCurrency(request.feeDifference) : 'No change'} />
          <DetailRow label="Seat status" value="Reserved until the transfer is completed" />
        </div>
      ),
    });
    if (!ok) return;

    setPending(true);
    try {
      await assignmentService.approveShiftChange({ requestId: request.id, newSeatId: seatId, note });
      addToast('Shift change approved', 'success', { description: `Seat ${seat?.number} is now reserved for ${request.studentName}.` });
      reset();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  const handleReject = async () => {
    if (!note.trim()) {
      addToast('Add a reason so the student can be told why', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Reject this request?',
      tone: 'danger',
      confirmLabel: 'Reject request',
      message: `${request.studentName} will stay in the ${request.currentSlotName} shift. The reason will be recorded in the approval history.`,
      details: <div className="confirm-quote">“{note}”</div>,
    });
    if (!ok) return;

    setPending(true);
    try {
      await assignmentService.rejectShiftChange({ requestId: request.id, note });
      addToast('Request rejected', 'info');
      reset();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  const handleComplete = async () => {
    const seat = heldSeat || desks.find((d) => d.id === seatId);
    if (!seat) {
      addToast('Select the seat to move the student to', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Complete the transfer?',
      tone: 'warning',
      confirmLabel: 'Complete transfer',
      message: `This moves ${request.studentName} to the ${request.requestedSlotName} shift and applies the seat change immediately.`,
      details: (
        <div className="confirm-list">
          <DetailRow label="Seat released" value={student?.deskNumber || '—'} />
          <DetailRow label="Seat assigned" value={seat.number} />
          <DetailRow label="New shift" value={request.requestedSlotName} />
          {request.feeDifference > 0 && <DetailRow label="Added to dues" value={formatCurrency(request.feeDifference)} />}
        </div>
      ),
    });
    if (!ok) return;

    setPending(true);
    try {
      const result = await assignmentService.completeShiftChange({ requestId: request.id, newSeatId: seat.id });
      addToast('Shift change completed', 'success', {
        description: `${request.studentName} moved to ${result.to} · ${result.shift} shift.`,
      });
      reset();
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={request.studentName}
      subtitle={`${request.studentIdNum} · Requested ${formatDate(request.requestedOn)}`}
      width={480}
      footer={
        request.status === 'pending' ? (
          <>
            <button type="button" className="btn btn-outline-danger" onClick={() => setRejecting((v) => !v)} disabled={pending}>
              <X size={14} /> Reject
            </button>
            <ActionButton className="btn btn-primary flex-1" pending={pending} onClick={handleApprove} disabled={!eligibility.allowed}>
              <Check size={14} /> Approve
            </ActionButton>
          </>
        ) : request.status === 'approved' ? (
          <ActionButton className="btn btn-primary btn-block" pending={pending} onClick={handleComplete}>
            <Repeat size={14} /> Complete Transfer
          </ActionButton>
        ) : (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => navigate(`/students/${request.studentId}`)}>
            View student profile
          </button>
        )
      }
    >
      {/* Status */}
      <div className="drawer-status-row">
        <StatusBadge status={request.status} />
        <span className="text-sm text-muted">Effective {formatDate(request.effectiveDate)} · {relativeDay(request.effectiveDate)}</span>
      </div>

      {/* The transfer at a glance */}
      <div className="transfer-visual">
        <div className="transfer-side">
          <span className="uppercase-label">Current</span>
          <span className="transfer-shift">{request.currentSlotName}</span>
          <span className="transfer-seat">{student?.deskNumber || request.currentSeat || 'No seat'}</span>
        </div>
        <div className="transfer-arrow">
          <ArrowRight size={18} />
        </div>
        <div className="transfer-side transfer-side-target">
          <span className="uppercase-label">Requested</span>
          <span className="transfer-shift">{request.requestedSlotName}</span>
          <span className="transfer-seat">{heldSeat?.number || request.newSeat || 'Seat to be picked'}</span>
        </div>
      </div>

      {/* Student snapshot */}
      {student && (
        <SectionCard title="Student" padded={false}>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <DetailRow label="Membership" value={`${student.membershipPlan} · ${formatCurrency(student.planPrice)}`} />
            <DetailRow label="Expires" value={`${formatDate(student.membershipExpiry)} (${relativeDay(student.membershipExpiry)})`} />
            <DetailRow label="Outstanding" value={student.outstanding > 0 ? <span className="text-error font-semibold">{formatCurrency(student.outstanding)}</span> : formatCurrency(0)} />
            <DetailRow label="Attendance" value={`${student.attendanceRate}%`} />
            <DetailRow label="Phone" value={student.phone} />
          </div>
        </SectionCard>
      )}

      {/* Reason */}
      <div className="drawer-block">
        <span className="uppercase-label">
          <MessageSquare size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          Reason
        </span>
        <p className="drawer-quote">{request.reason || 'No reason recorded.'}</p>
      </div>

      {/* Fee difference */}
      <div className={`callout ${request.feeDifference > 0 ? 'callout-warning' : 'callout-info'}`}>
        <IndianRupee size={15} className="callout-icon" />
        <div>
          <span className="callout-title">
            {request.feeDifference === 0 ? 'No fee difference' : request.feeDifference > 0 ? `Additional fee ${formatCurrency(request.feeDifference)}` : `Refund due ${formatCurrency(Math.abs(request.feeDifference))}`}
          </span>
          {request.feeDifference > 0
            ? 'This is added to the student’s outstanding balance when the transfer is completed.'
            : request.feeDifference < 0
              ? 'Adjust this against the next renewal.'
              : 'Both shifts are on the same plan rate.'}
        </div>
      </div>

      {/* Availability / approval gate */}
      {request.status === 'pending' && (
        <div className="drawer-block">
          <span className="uppercase-label">Seat availability</span>
          {!eligibility.allowed ? (
            <div className="callout callout-danger" style={{ marginTop: 8 }}>
              <AlertTriangle size={15} className="callout-icon" />
              <div>
                <span className="callout-title">Cannot approve yet</span>
                <ul className="blocker-list">
                  {eligibility.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-secondary mt-1">
                {availableSeats.length} seat{availableSeats.length === 1 ? '' : 's'} free · {targetSlot?.assigned}/{targetSlot?.capacity} used in the {targetSlot?.name} shift
              </p>
              <select className="form-select mt-2" value={seatId} onChange={(e) => setSeatId(e.target.value)}>
                <option value="">Select a seat to hold…</option>
                {availableSeats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.number} — {seat.floorName}, Section {seat.section} ({seat.zone})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {request.status === 'approved' && (
        <div className="drawer-block">
          <span className="uppercase-label">Seat to assign</span>
          {heldSeat ? (
            <div className="held-seat">
              <Armchair size={16} />
              <div>
                <strong>{heldSeat.number}</strong>
                <span>{heldSeat.floorName}, Section {heldSeat.section} · held for this transfer</span>
              </div>
            </div>
          ) : (
            <select className="form-select mt-2" value={seatId} onChange={(e) => setSeatId(e.target.value)}>
              <option value="">Select a seat…</option>
              {availableSeats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.number} — {seat.floorName}, Section {seat.section}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Reject reason box */}
      {rejecting && request.status === 'pending' && (
        <div className="drawer-block">
          <label className="form-label" htmlFor="reject-reason">
            Reason for rejection <span className="required">*</span>
          </label>
          <textarea
            id="reject-reason"
            className="form-textarea mt-1"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Evening shift is full, offer again next month"
          />
          <div className="btn-group mt-2">
            <ActionButton className="btn btn-danger btn-sm" pending={pending} onClick={handleReject}>
              Confirm rejection
            </ActionButton>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Optional approval note */}
      {request.status === 'pending' && !rejecting && eligibility.allowed && (
        <div className="drawer-block">
          <label className="form-label" htmlFor="approve-note">Note (optional)</label>
          <input id="approve-note" className="form-input mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the next person should know" />
        </div>
      )}

      {/* Approval history */}
      <div className="drawer-block">
        <span className="uppercase-label">
          <History size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
          Approval history
        </span>
        <div className="timeline mt-2">
          {request.history.map((h, i) => (
            <div key={`${h.date}-${i}`} className="timeline-item">
              <span className={`timeline-dot ${h.action === 'Rejected' ? 'timeline-dot-error' : h.action === 'Completed' ? 'timeline-dot-success' : ''}`} />
              <div className="timeline-content">
                <span className="timeline-text">
                  <strong>{h.action}</strong> by {h.by}
                </span>
                <span className="timeline-date">
                  {formatDate(h.date)} · {h.time}
                </span>
                {h.note && <span className="timeline-note">{h.note}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

// ============================================================
// New request modal
// ============================================================
function NewRequestModal({ open, onClose, students, slots, addToast }) {
  const blank = { studentId: '', requestedSlotId: '', effectiveDate: addDays(todayISO(), 1), reason: '', feeDifference: 0 };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const student = students.find((s) => s.id === form.studentId);
  const targetSlot = slots.find((s) => s.id === form.requestedSlotId);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const close = () => {
    setForm(blank);
    setErrors({});
    onClose();
  };

  const submit = async () => {
    const errs = {};
    if (!form.studentId) errs.studentId = 'Select a student';
    if (!form.requestedSlotId) errs.requestedSlotId = 'Select the requested shift';
    if (form.requestedSlotId && student && form.requestedSlotId === student.slotId) errs.requestedSlotId = 'That is already their shift';
    if (!form.reason.trim()) errs.reason = 'Record why they want to move';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await assignmentService.createShiftChangeRequest(form);
      addToast('Shift change request created', 'success', { description: `${student.name}: ${student.slotName} → ${targetSlot.name}` });
      close();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  const eligibleStudents = useMemo(() => students.filter((s) => s.status !== 'inactive').sort((a, b) => a.name.localeCompare(b.name)), [students]);

  return (
    <Modal
      open={open}
      onClose={close}
      title="New shift change request"
      description="Record a request raised at the front desk. Nothing moves until it is approved and completed."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Create request</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="sc-student">Student <span className="required">*</span></label>
          <select id="sc-student" className={`form-select ${errors.studentId ? 'error' : ''}`} value={form.studentId} onChange={(e) => set('studentId', e.target.value)}>
            <option value="">Select a student…</option>
            {eligibleStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.studentId}) — {s.slotName}{s.deskNumber ? `, ${s.deskNumber}` : ''}
              </option>
            ))}
          </select>
          {errors.studentId && <span className="form-error">{errors.studentId}</span>}
        </div>

        {student && (
          <div className="callout callout-info">
            <Clock size={15} className="callout-icon" />
            <div>
              Currently in the <strong>{student.slotName}</strong> shift
              {student.deskNumber ? <> on seat <strong>{student.deskNumber}</strong></> : ' with no seat assigned'}.
            </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="sc-slot">Requested shift <span className="required">*</span></label>
            <select id="sc-slot" className={`form-select ${errors.requestedSlotId ? 'error' : ''}`} value={form.requestedSlotId} onChange={(e) => set('requestedSlotId', e.target.value)}>
              <option value="">Select…</option>
              {slots.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === student?.slotId}>
                  {s.name} ({s.startTime} – {s.endTime}) — {s.capacity - s.assigned} free
                </option>
              ))}
            </select>
            {errors.requestedSlotId && <span className="form-error">{errors.requestedSlotId}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sc-date">Effective from</label>
            <input id="sc-date" type="date" className="form-input" value={form.effectiveDate} min={todayISO()} onChange={(e) => set('effectiveDate', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sc-fee">Fee difference (₹)</label>
          <input id="sc-fee" type="number" className="form-input" value={form.feeDifference} onChange={(e) => set('feeDifference', Number(e.target.value))} placeholder="0" />
          <span className="form-hint">Positive to charge extra, negative for a refund. Leave at 0 if the rate is the same.</span>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sc-reason">Reason <span className="required">*</span></label>
          <textarea
            id="sc-reason"
            className={`form-textarea ${errors.reason ? 'error' : ''}`}
            rows={2}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="e.g. Coaching timing changed to the morning"
          />
          {errors.reason && <span className="form-error">{errors.reason}</span>}
        </div>
      </div>
    </Modal>
  );
}
