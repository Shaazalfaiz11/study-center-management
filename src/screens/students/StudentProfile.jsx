import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, User, BadgeCheck, Armchair, CalendarCheck, CreditCard, FileText,
  StickyNote, Activity, CreditCard as PayIcon, RefreshCw, Repeat, CalendarOff,
  Phone, Mail, MapPin, Upload, Trash2, Plus, ArrowRight, AlertTriangle, Clock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import studentService from '../../services/studentService';
import paymentService from '../../services/paymentService';
import membershipService from '../../services/membershipService';
import assignmentService from '../../services/assignmentService';
import seatService from '../../services/seatService';
import DataTable from '../../components/ui/DataTable';
import { Modal, StatusBadge, DetailRow, Avatar, ActionButton, SectionCard, ProgressBar } from '../../components/ui/Primitives';
import { EmptyState, ErrorState, SkeletonText, SkeletonCards } from '../../components/ui/StateViews';
import { formatCurrency, formatDate, relativeDay, daysUntil, todayISO, addDays, daysSince } from '../../services/businessRules';
import './StudentProfile.css';

const TABS = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'membership', label: 'Membership', icon: BadgeCheck },
  { key: 'seat', label: 'Seat', icon: Armchair },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'activity', label: 'Activity', icon: Activity },
];

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { students, payments, attendance, leaves, desks, addToast, confirm, membershipPlans, slots } = useApp();

  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const [action, setAction] = useState(null);

  const { data, loading, error, retry } = useAsync(
    () => studentService.getStudentDetail(id),
    [id, students, payments, attendance, leaves, desks],
  );

  const changeTab = (key) => {
    setTab(key);
    searchParams.set('tab', key);
    setSearchParams(searchParams, { replace: true });
  };

  if (loading && !data) {
    return (
      <div className="page-stack">
        <SkeletonCards count={1} height={132} />
        <SkeletonCards count={4} height={90} />
      </div>
    );
  }

  if (error) return <ErrorState title="Unable to load this student" description={error.message} onRetry={retry} />;

  if (!data) {
    return (
      <EmptyState
        icon={User}
        title="Student not found"
        description="This student may have been removed."
        action={<button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/students')}>Back to students</button>}
      />
    );
  }

  const { student, plan, seat } = data;
  const activeLeave = data.leaves.find((l) => l.status === 'active' || l.status === 'upcoming');
  const daysLeft = daysUntil(student.membershipExpiry);

  return (
    <div className="page-stack student-profile">
      <button type="button" className="btn btn-ghost btn-sm back-link" onClick={() => navigate('/students')}>
        <ArrowLeft size={14} /> All students
      </button>

      {/* ── Header ── */}
      <header className="profile-header">
        <div className="profile-identity">
          <Avatar name={student.name} size={56} />
          <div className="profile-identity-text">
            <h2 className="profile-name">{student.name}</h2>
            <div className="profile-badges">
              <StatusBadge status={student.status} />
              <StatusBadge status={student.membershipStatus} />
              {student.paymentStatus !== 'paid' && <StatusBadge status={student.paymentStatus} />}
              <span className="profile-id">{student.studentId}</span>
            </div>
            <div className="profile-contact">
              <a href={`tel:${student.phone.replace(/\s/g, '')}`}><Phone size={11} /> {student.phone}</a>
              {student.email && <span><Mail size={11} /> {student.email}</span>}
              <span><MapPin size={11} /> {student.address}, {student.city}</span>
            </div>
          </div>
        </div>

        {/* At-a-glance facts */}
        <div className="profile-facts">
          <Fact label="Membership" value={student.membershipPlan} sub={formatCurrency(student.planPrice)} />
          <Fact label="Seat" value={student.deskNumber || 'Not assigned'} sub={seat ? `${seat.floorName}, Section ${seat.section}` : '—'} />
          <Fact label="Shift" value={student.slotName} sub={slots.find((s) => s.id === student.slotId)?.startTime} />
          <Fact
            label="Attendance"
            value={`${student.attendanceRate}%`}
            sub={student.lastAttendanceDate ? `Last seen ${relativeDay(student.lastAttendanceDate)}` : 'Never checked in'}
            tone={student.attendanceRate >= 80 ? 'success' : student.attendanceRate >= 50 ? 'warning' : 'error'}
          />
          <Fact
            label="Expires"
            value={formatDate(student.membershipExpiry)}
            sub={daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`}
            tone={daysLeft < 0 ? 'error' : daysLeft <= 7 ? 'warning' : 'success'}
          />
          <Fact
            label="Outstanding"
            value={formatCurrency(student.outstanding)}
            sub={student.outstanding > 0 ? `Due ${formatDate(student.feeDueDate)}` : 'All clear'}
            tone={student.outstanding > 0 ? 'error' : 'success'}
          />
        </div>
      </header>

      {/* ── Alerts ── */}
      {student.onLeave && activeLeave && (
        <div className="callout callout-info">
          <Clock size={15} className="callout-icon" />
          <div>
            <span className="callout-title">On leave until {formatDate(activeLeave.extendedTo || activeLeave.endDate)}</span>
            {activeLeave.reason} · Membership is paused and {student.deskNumber ? `seat ${student.deskNumber} is temporarily released` : 'no seat is held'}.
          </div>
        </div>
      )}
      {student.outstanding > 0 && student.paymentStatus === 'overdue' && (
        <div className="callout callout-danger">
          <AlertTriangle size={15} className="callout-icon" />
          <div>
            <span className="callout-title">{formatCurrency(student.outstanding)} overdue</span>
            Payment was due on {formatDate(student.feeDueDate)} — {relativeDay(student.feeDueDate)}.
          </div>
        </div>
      )}
      {!student.onLeave && student.deskNumber && student.lastAttendanceDate && daysSince(student.lastAttendanceDate) >= 7 && (
        <div className="callout callout-warning">
          <AlertTriangle size={15} className="callout-icon" />
          <div>
            <span className="callout-title">Seat may be idle</span>
            No attendance for {daysSince(student.lastAttendanceDate)} days while holding seat {student.deskNumber}.
          </div>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="profile-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAction({ type: 'payment' })}>
          <PayIcon size={14} /> Record Payment
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'renew' })}>
          <RefreshCw size={14} /> Renew
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'shift' })}>
          <Repeat size={14} /> Change Shift
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'transfer' })} disabled={!student.deskId}>
          <Armchair size={14} /> Transfer Seat
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'leave' })} disabled={student.onLeave}>
          <CalendarOff size={14} /> Add Leave
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeTab('attendance')}>
          <CalendarCheck size={14} /> View Attendance
        </button>
      </div>

      {/* ── Tabs ── */}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => changeTab(t.key)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      <div className="profile-content">
        {tab === 'overview' && <OverviewTab data={data} plan={plan} />}
        {tab === 'membership' && <MembershipTab data={data} plan={plan} onRenew={() => setAction({ type: 'renew' })} onLeave={() => setAction({ type: 'leave' })} />}
        {tab === 'seat' && <SeatTab data={data} navigate={navigate} onTransfer={() => setAction({ type: 'transfer' })} onShift={() => setAction({ type: 'shift' })} />}
        {tab === 'attendance' && <AttendanceTab records={data.attendance} student={student} />}
        {tab === 'payments' && <PaymentsTab payments={data.payments} student={student} onRecord={() => setAction({ type: 'payment' })} />}
        {tab === 'documents' && <DocumentsTab student={student} addToast={addToast} />}
        {tab === 'notes' && <NotesTab student={student} addToast={addToast} confirm={confirm} />}
        {tab === 'activity' && <ActivityTab data={data} />}
      </div>

      <ProfileActionModals
        key={action?.type || 'none'}
        action={action}
        onClose={() => setAction(null)}
        student={student}
        membershipPlans={membershipPlans}
        slots={slots}
        desks={desks}
        addToast={addToast}
        confirm={confirm}
      />
    </div>
  );
}

// ============================================================
// Header fact
// ============================================================
function Fact({ label, value, sub, tone }) {
  return (
    <div className="profile-fact">
      <span className="profile-fact-label">{label}</span>
      <span className={`profile-fact-value ${tone ? `text-${tone}` : ''}`}>{value}</span>
      {sub && <span className="profile-fact-sub">{sub}</span>}
    </div>
  );
}

// ============================================================
// Tabs
// ============================================================
function OverviewTab({ data, plan }) {
  const { student, payments, attendance } = data;
  const recentPayments = payments.slice(0, 4);
  const recentAttendance = attendance.slice(0, 7);

  return (
    <div className="profile-grid">
      <SectionCard title="Personal details">
        <div className="detail-grid">
          <div className="detail-grid-item"><dt>Student ID</dt><dd>{student.studentId}</dd></div>
          <div className="detail-grid-item"><dt>Preparing for</dt><dd>{student.exam || '—'}</dd></div>
          <div className="detail-grid-item"><dt>Phone</dt><dd>{student.phone}</dd></div>
          <div className="detail-grid-item"><dt>Email</dt><dd>{student.email || '—'}</dd></div>
          <div className="detail-grid-item"><dt>Address</dt><dd>{student.address}, {student.city} {student.pincode}</dd></div>
          <div className="detail-grid-item"><dt>Emergency contact</dt><dd>{student.emergencyName} · {student.emergencyContact}</dd></div>
          <div className="detail-grid-item"><dt>Joined</dt><dd>{formatDate(student.joinDate)}</dd></div>
          <div className="detail-grid-item"><dt>Source</dt><dd>{student.source}</dd></div>
        </div>
      </SectionCard>

      <SectionCard title="Account summary">
        <DetailRow label="Membership" value={`${student.membershipPlan} · ${formatCurrency(plan?.price || student.planPrice)}`} />
        <DetailRow label="Valid" value={`${formatDate(student.membershipStart)} → ${formatDate(student.membershipExpiry)}`} />
        <DetailRow label="Status" value={<StatusBadge status={student.membershipStatus} />} />
        <DetailRow label="Total paid" value={<strong>{formatCurrency(student.totalPaid)}</strong>} />
        <DetailRow label="Outstanding" value={student.outstanding > 0 ? <strong className="text-error">{formatCurrency(student.outstanding)}</strong> : formatCurrency(0)} />
        <DetailRow label="Last payment" value={student.lastPaymentDate ? `${formatCurrency(student.lastPaymentAmount)} on ${formatDate(student.lastPaymentDate)}` : 'None yet'} />
        {student.pausedDays > 0 && <DetailRow label="Days added from leave" value={`${student.pausedDays} days`} />}
      </SectionCard>

      <SectionCard title="Recent attendance" subtitle={`${student.attendanceRate}% over the last 45 days`} padded={false}>
        {recentAttendance.length === 0 ? (
          <EmptyState compact title="No attendance yet" />
        ) : (
          <ul className="mini-list">
            {recentAttendance.map((a) => (
              <li key={a.id}>
                <span>{formatDate(a.date)}</span>
                <span className="mini-list-mid">{a.checkIn || '—'}{a.checkOut ? ` → ${a.checkOut}` : ''}</span>
                <StatusBadge status={a.status} dot={false} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Recent payments" padded={false}>
        {recentPayments.length === 0 ? (
          <EmptyState compact title="No payments recorded" />
        ) : (
          <ul className="mini-list">
            {recentPayments.map((p) => (
              <li key={p.id}>
                <span>{formatDate(p.date)}</span>
                <span className="mini-list-mid">{p.method} · {p.receiptNumber}</span>
                <strong>{formatCurrency(p.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function MembershipTab({ data, plan, onRenew, onLeave }) {
  const { student, leaves } = data;
  const daysLeft = daysUntil(student.membershipExpiry);
  const totalDays = plan?.durationDays || 30;
  const usedPct = Math.min(100, Math.max(0, Math.round(((totalDays - daysLeft) / totalDays) * 100)));

  return (
    <div className="profile-grid">
      <SectionCard
        title="Current membership"
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={onRenew}>
            <RefreshCw size={13} /> Renew
          </button>
        }
      >
        <div className="membership-meter">
          <div className="membership-meter-head">
            <span>{student.membershipPlan}</span>
            <span className={daysLeft < 0 ? 'text-error' : daysLeft <= 7 ? 'text-warning' : ''}>
              {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)} days ago` : `${daysLeft} days remaining`}
            </span>
          </div>
          <ProgressBar value={usedPct} tone={daysLeft < 0 ? 'error' : daysLeft <= 7 ? 'warning' : 'success'} />
          <div className="membership-meter-foot">
            <span>{formatDate(student.membershipStart)}</span>
            <span>{formatDate(student.membershipExpiry)}</span>
          </div>
        </div>

        <div className="mt-4">
          <DetailRow label="Plan" value={student.membershipPlan} />
          <DetailRow label="Price" value={formatCurrency(plan?.price || student.planPrice)} />
          <DetailRow label="Duration" value={plan ? `${plan.duration} ${plan.durationUnit}` : '—'} />
          <DetailRow label="Status" value={<StatusBadge status={student.membershipStatus} />} />
          <DetailRow label="Fee due" value={`${formatDate(student.feeDueDate)} · ${relativeDay(student.feeDueDate)}`} />
          {student.pausedDays > 0 && <DetailRow label="Days credited from leave" value={`${student.pausedDays}`} />}
        </div>
      </SectionCard>

      <SectionCard
        title="Leave history"
        subtitle={`${leaves.length} record${leaves.length === 1 ? '' : 's'}`}
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={onLeave} disabled={student.onLeave}>
            <CalendarOff size={13} /> Add leave
          </button>
        }
        padded={false}
      >
        {leaves.length === 0 ? (
          <EmptyState compact icon={CalendarOff} title="No leave taken" description="Pause the membership when they travel so days are not lost." />
        ) : (
          <ul className="mini-list">
            {leaves.map((l) => (
              <li key={l.id}>
                <span>{formatDate(l.startDate)} → {formatDate(l.extendedTo || l.endDate)}</span>
                <span className="mini-list-mid">{l.reason}</span>
                <StatusBadge status={l.status} dot={false} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function SeatTab({ data, navigate, onTransfer, onShift }) {
  const { student, seat, seatHistory, shiftChanges } = data;

  return (
    <div className="profile-grid">
      <SectionCard
        title="Current seat"
        actions={
          <div className="btn-group">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onShift}>
              <Repeat size={13} /> Change shift
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onTransfer} disabled={!seat}>
              <Armchair size={13} /> Transfer
            </button>
          </div>
        }
      >
        {seat ? (
          <>
            <div className="seat-hero">
              <span className="seat-hero-number">{seat.number}</span>
              <StatusBadge status={seat.status} />
            </div>
            <DetailRow label="Location" value={`${seat.floorName}, Section ${seat.section}`} />
            <DetailRow label="Zone" value={seat.zone} />
            <DetailRow label="Shift" value={student.slotName} />
            <DetailRow label="Last used" value={seat.lastUsed ? `${formatDate(seat.lastUsed)} · ${relativeDay(seat.lastUsed)}` : 'No record'} />
            {seat.temporary && (
              <div className="callout callout-warning mt-3">
                <Clock size={15} className="callout-icon" />
                <div>Temporarily released until {formatDate(seat.temporary.to)} — the assignment is still theirs.</div>
              </div>
            )}
            <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => navigate(`/seats/map?seat=${seat.number}`)}>
              View on seat map <ArrowRight size={13} />
            </button>
          </>
        ) : (
          <EmptyState
            compact
            icon={Armchair}
            title="No seat assigned"
            description="Assign a seat so the student has a fixed place in their shift."
            action={<button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/assignments')}>Assign a seat</button>}
          />
        )}
      </SectionCard>

      <SectionCard title="Assignment history" padded={false}>
        {seatHistory.length === 0 ? (
          <EmptyState compact title="No seat changes recorded" />
        ) : (
          <div className="card-body">
            <div className="timeline">
              {seatHistory.map((h) => (
                <div key={h.id} className="timeline-item">
                  <span className={`timeline-dot ${h.type === 'released' ? 'timeline-dot-error' : h.type === 'temp_released' ? 'timeline-dot-warning' : 'timeline-dot-success'}`} />
                  <div className="timeline-content">
                    <span className="timeline-text">
                      {h.type === 'assigned' && <>Assigned seat <strong>{h.toSeat}</strong></>}
                      {h.type === 'transferred' && <>Moved <strong>{h.fromSeat}</strong> → <strong>{h.toSeat}</strong></>}
                      {h.type === 'released' && <>Released seat <strong>{h.fromSeat}</strong></>}
                      {h.type === 'temp_released' && <>Seat <strong>{h.fromSeat}</strong> temporarily released</>}
                      {h.type === 'temp_allocated' && <>Temporary use of <strong>{h.toSeat}</strong></>}
                      {h.type === 'resumed' && <>Returned to seat <strong>{h.toSeat}</strong></>}
                      {h.type === 'shift_changed' && <>Shift changed</>}
                    </span>
                    <span className="timeline-date">{formatDate(h.date)} · {h.by}</span>
                    {h.note && <span className="timeline-note">{h.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {shiftChanges.length > 0 && (
        <SectionCard title="Shift change requests" padded={false} className="profile-span-2">
          <ul className="mini-list">
            {shiftChanges.map((r) => (
              <li key={r.id}>
                <span>{r.currentSlotName} → {r.requestedSlotName}</span>
                <span className="mini-list-mid">Effective {formatDate(r.effectiveDate)}</span>
                <StatusBadge status={r.status} dot={false} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function AttendanceTab({ records, student }) {
  const present = records.filter((a) => a.status === 'present' || a.status === 'late').length;
  const absent = records.filter((a) => a.status === 'absent').length;

  const columns = [
    { key: 'date', header: 'Date', sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: 'status', header: 'Status', sortable: true, accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'checkIn', header: 'Check-in', accessor: (r) => r.checkIn, render: (r) => r.checkIn || <span className="text-muted">—</span> },
    { key: 'checkOut', header: 'Check-out', accessor: (r) => r.checkOut, render: (r) => r.checkOut || <span className="text-muted">—</span> },
    { key: 'slotName', header: 'Shift', hideBelow: 'md', accessor: (r) => r.slotName },
    { key: 'markedBy', header: 'Marked by', hideBelow: 'lg', accessor: (r) => r.markedBy },
  ];

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <div className="stat-card"><span className="stat-card-label">Attendance rate</span><span className="stat-card-value">{student.attendanceRate}%</span></div>
        <div className="stat-card"><span className="stat-card-label">Days present</span><span className="stat-card-value">{present}</span></div>
        <div className="stat-card"><span className="stat-card-label">Days absent</span><span className="stat-card-value">{absent}</span></div>
        <div className="stat-card"><span className="stat-card-label">Last seen</span><span className="stat-card-value" style={{ fontSize: 'var(--font-lg)' }}>{student.lastAttendanceDate ? relativeDay(student.lastAttendanceDate) : 'Never'}</span></div>
      </div>
      <DataTable
        columns={columns}
        rows={records}
        pageSize={12}
        searchable={false}
        exportFileName={`attendance-${student.studentId}.csv`}
        emptyIcon={CalendarCheck}
        emptyTitle="No attendance records"
        emptyDescription="Records appear once the student starts checking in."
      />
    </div>
  );
}

function PaymentsTab({ payments, student, onRecord }) {
  const columns = [
    { key: 'receiptNumber', header: 'Receipt', sortable: true, accessor: (r) => r.receiptNumber, className: 'cell-mono' },
    { key: 'date', header: 'Date', sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, accessor: (r) => r.amount, render: (r) => <span className="cell-num cell-strong">{formatCurrency(r.amount)}</span> },
    { key: 'method', header: 'Method', accessor: (r) => r.method, render: (r) => <span className="badge badge-gray">{r.method}</span> },
    { key: 'membershipPlan', header: 'Plan', hideBelow: 'md', accessor: (r) => r.membershipPlan },
    { key: 'period', header: 'Period', hideBelow: 'lg', accessor: (r) => r.periodStart, render: (r) => (r.periodEnd ? `${formatDate(r.periodStart)} → ${formatDate(r.periodEnd)}` : formatDate(r.periodStart)) },
    { key: 'status', header: 'Status', accessor: (r) => r.status, render: (r) => <StatusBadge status={r.status === 'completed' ? 'paid' : 'pending'} /> },
  ];

  return (
    <div className="page-stack">
      <div className="stat-grid">
        <div className="stat-card"><span className="stat-card-label">Total paid</span><span className="stat-card-value">{formatCurrency(student.totalPaid)}</span></div>
        <div className="stat-card"><span className="stat-card-label">Outstanding</span><span className={`stat-card-value ${student.outstanding > 0 ? 'text-error' : ''}`}>{formatCurrency(student.outstanding)}</span></div>
        <div className="stat-card"><span className="stat-card-label">Payments</span><span className="stat-card-value">{payments.length}</span></div>
        <div className="stat-card"><span className="stat-card-label">Next due</span><span className="stat-card-value" style={{ fontSize: 'var(--font-lg)' }}>{formatDate(student.feeDueDate)}</span></div>
      </div>
      <DataTable
        columns={columns}
        rows={payments}
        pageSize={10}
        searchable={false}
        exportFileName={`payments-${student.studentId}.csv`}
        emptyIcon={CreditCard}
        emptyTitle="No payments recorded"
        emptyAction={<button type="button" className="btn btn-primary btn-sm" onClick={onRecord}>Record a payment</button>}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={onRecord}>
            <Plus size={14} /> Record Payment
          </button>
        }
      />
    </div>
  );
}

function DocumentsTab({ student, addToast }) {
  return (
    <SectionCard
      title="Documents"
      subtitle={`${student.documents.length} on file`}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => addToast('Document upload is not available in this demo', 'info')}>
          <Upload size={13} /> Upload
        </button>
      }
    >
      {student.documents.length === 0 ? (
        <EmptyState compact icon={FileText} title="No documents uploaded" description="Collect an ID proof and a photo at admission." />
      ) : (
        <div className="doc-grid">
          {student.documents.map((doc) => (
            <div key={doc.id} className="doc-card">
              <FileText size={18} className="text-primary" />
              <div className="doc-card-body">
                <span className="doc-card-title">{doc.type}</span>
                <span className="doc-card-sub">{doc.name}</span>
                <span className="doc-card-date">Uploaded {formatDate(doc.uploadDate)}</span>
              </div>
              <StatusBadge status={doc.status === 'verified' ? 'approved' : 'pending'} label={doc.status === 'verified' ? 'Verified' : 'Pending'} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function NotesTab({ student, addToast, confirm }) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);

  const add = async () => {
    if (!text.trim()) return;
    setPending(true);
    try {
      await studentService.addNote({ studentId: student.id, text });
      setText('');
      addToast('Note added', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  const remove = async (note) => {
    const ok = await confirm({ title: 'Delete this note?', tone: 'danger', confirmLabel: 'Delete note', message: 'This cannot be undone.' });
    if (!ok) return;
    await studentService.deleteNote({ studentId: student.id, noteId: note.id });
    addToast('Note deleted', 'info');
  };

  return (
    <SectionCard title="Internal notes" subtitle="Visible to staff only">
      <div className="note-composer">
        <input
          className="form-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Asked to be moved away from the entrance"
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <ActionButton pending={pending} onClick={add} disabled={!text.trim()}>Add note</ActionButton>
      </div>

      {(student.notes || []).length === 0 ? (
        <EmptyState compact icon={StickyNote} title="No notes yet" description="Record anything the next person on the desk should know." />
      ) : (
        <ul className="note-list">
          {student.notes.map((note) => (
            <li key={note.id} className="note-item">
              <div className="note-item-body">
                <p>{note.text}</p>
                <span className="note-item-meta">{formatDate(note.date)} · {note.by}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => remove(note)} aria-label="Delete note">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ActivityTab({ data }) {
  const { activity, student } = data;

  const events = useMemo(() => {
    const list = activity.map((a) => ({ date: a.date, time: a.time, title: a.summary, by: a.admin }));
    list.push({ date: student.membershipStart, title: `Membership started — ${student.membershipPlan}`, by: 'System' });
    list.push({ date: student.joinDate, title: 'Student registered', by: 'System' });
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [activity, student]);

  return (
    <SectionCard title="Activity" subtitle="Everything recorded against this student">
      {events.length === 0 ? (
        <EmptyState compact title="No activity yet" />
      ) : (
        <div className="timeline">
          {events.map((e, i) => (
            <div key={`${e.date}-${i}`} className="timeline-item">
              <span className="timeline-dot" />
              <div className="timeline-content">
                <span className="timeline-text">{e.title}</span>
                <span className="timeline-date">{formatDate(e.date)}{e.time ? ` · ${e.time}` : ''} · {e.by}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================
// Quick-action modals
// ============================================================
function ProfileActionModals({ action, onClose, student, membershipPlans, slots, desks, addToast, confirm }) {
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    method: 'UPI',
    planId: student.membershipPlanId,
    collectPayment: true,
    slotId: '',
    seatId: '',
    reason: '',
    startDate: todayISO(),
    endDate: addDays(todayISO(), 10),
    seatAction: 'released',
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const availableSeats = useMemo(() => desks.filter((d) => d.status === 'available'), [desks]);

  if (!action) return null;

  const close = () => {
    setPending(false);
    onClose();
  };

  // ── Record payment ───────────────────────────────────────
  if (action.type === 'payment') {
    const value = form.amount === '' ? student.outstanding : Number(form.amount);
    const submit = async () => {
      setPending(true);
      try {
        const payment = await paymentService.recordPayment({ studentId: student.id, amount: value, method: form.method });
        addToast('Payment recorded', 'success', { description: `${formatCurrency(value)} · Receipt ${payment.receiptNumber}` });
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
        title="Record payment"
        description={student.name}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit} disabled={!value || value <= 0}>Record {formatCurrency(value || 0)}</ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="summary-panel">
            <DetailRow label="Outstanding" value={<strong className={student.outstanding > 0 ? 'text-error' : ''}>{formatCurrency(student.outstanding)}</strong>} />
            <DetailRow label="Membership" value={student.membershipPlan} />
            <DetailRow label="Fee due" value={formatDate(student.feeDueDate)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="pp-amount">Amount (₹)</label>
              <input id="pp-amount" type="number" className="form-input" value={form.amount} placeholder={String(student.outstanding || student.planPrice)} onChange={(e) => set('amount', e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pp-method">Method</label>
              <select id="pp-method" className="form-select" value={form.method} onChange={(e) => set('method', e.target.value)}>
                <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Renew ────────────────────────────────────────────────
  if (action.type === 'renew') {
    const plan = membershipPlans.find((p) => p.id === form.planId);
    const submit = async () => {
      setPending(true);
      try {
        const result = await membershipService.renewMembership({ studentId: student.id, planId: form.planId, collectPayment: form.collectPayment, method: form.method });
        addToast('Membership renewed', 'success', { description: `${result.plan} until ${formatDate(result.newExpiry)}` });
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
        title="Renew membership"
        description={`${student.name} · expires ${formatDate(student.membershipExpiry)}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit}>Renew</ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="pr-plan">Plan</label>
            <select id="pr-plan" className="form-select" value={form.planId} onChange={(e) => set('planId', e.target.value)}>
              {membershipPlans.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} / {p.duration} {p.durationUnit}</option>
              ))}
            </select>
          </div>
          <label className="form-checkbox">
            <input type="checkbox" checked={form.collectPayment} onChange={(e) => set('collectPayment', e.target.checked)} />
            <span>Collect {formatCurrency(plan?.price || 0)} now</span>
          </label>
          {form.collectPayment && (
            <div className="form-group">
              <label className="form-label" htmlFor="pr-method">Payment method</label>
              <select id="pr-method" className="form-select" value={form.method} onChange={(e) => set('method', e.target.value)}>
                <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option>
              </select>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // ── Change shift ─────────────────────────────────────────
  if (action.type === 'shift') {
    const submit = async () => {
      if (!form.slotId) {
        addToast('Select the new shift', 'error');
        return;
      }
      const slot = slots.find((s) => s.id === form.slotId);
      const seat = form.seatId ? desks.find((d) => d.id === form.seatId) : null;
      const ok = await confirm({
        title: 'Change shift?',
        tone: 'warning',
        confirmLabel: 'Change shift',
        message: `${student.name} moves from the ${student.slotName} shift to the ${slot.name} shift.`,
        details: (
          <div className="confirm-list">
            <DetailRow label="Seat" value={seat ? `${student.deskNumber || '—'} → ${seat.number}` : `${student.deskNumber || 'None'} (unchanged)`} />
            <DetailRow label="Recorded in" value="Assignment history and audit log" />
          </div>
        ),
      });
      if (!ok) return;

      setPending(true);
      try {
        const result = await assignmentService.changeShift({ studentId: student.id, slotId: form.slotId, newSeatId: form.seatId || null, reason: form.reason });
        addToast('Shift changed', 'success', { description: `${student.name} is now in the ${result.shift} shift.` });
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
        title="Change shift"
        description={`${student.name} · currently ${student.slotName}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit} disabled={!form.slotId}>Change shift</ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="ps-slot">New shift</label>
            <select id="ps-slot" className="form-select" value={form.slotId} onChange={(e) => set('slotId', e.target.value)}>
              <option value="">Select…</option>
              {slots.filter((s) => s.active && s.id !== student.slotId).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime}) — {s.capacity - s.assigned} free</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ps-seat">New seat (optional)</label>
            <select id="ps-seat" className="form-select" value={form.seatId} onChange={(e) => set('seatId', e.target.value)}>
              <option value="">Keep {student.deskNumber || 'no seat'}</option>
              {availableSeats.map((d) => (
                <option key={d.id} value={d.id}>{d.number} — {d.floorName}, Section {d.section}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ps-reason">Reason</label>
            <input id="ps-reason" className="form-input" value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Coaching timings changed" />
          </div>
        </div>
      </Modal>
    );
  }

  // ── Transfer seat ────────────────────────────────────────
  if (action.type === 'transfer') {
    const submit = async () => {
      const seat = desks.find((d) => d.id === form.seatId);
      if (!seat) {
        addToast('Select the seat to move them to', 'error');
        return;
      }
      const ok = await confirm({
        title: 'Transfer seat?',
        tone: 'warning',
        confirmLabel: 'Transfer seat',
        message: `${student.name} moves from ${student.deskNumber} to ${seat.number}.`,
        details: (
          <div className="confirm-list">
            <DetailRow label={`${student.deskNumber} becomes`} value="Available" />
            <DetailRow label={`${seat.number} becomes`} value="Assigned" />
          </div>
        ),
      });
      if (!ok) return;

      setPending(true);
      try {
        const result = await seatService.transferSeat({ studentId: student.id, toSeatId: form.seatId, reason: form.reason });
        addToast('Seat transferred', 'success', { description: `${result.from} → ${result.to}` });
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
        title="Transfer seat"
        description={`${student.name} · currently on ${student.deskNumber}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit} disabled={!form.seatId}>Transfer</ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="pt-seat">Move to</label>
            <select id="pt-seat" className="form-select" value={form.seatId} onChange={(e) => set('seatId', e.target.value)}>
              <option value="">Select an available seat…</option>
              {availableSeats.map((d) => (
                <option key={d.id} value={d.id}>{d.number} — {d.floorName}, Section {d.section} ({d.zone})</option>
              ))}
            </select>
            {availableSeats.length === 0 && <span className="form-hint">No seats are free right now.</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pt-reason">Reason (optional)</label>
            <input id="pt-reason" className="form-input" value={form.reason} onChange={(e) => set('reason', e.target.value)} />
          </div>
        </div>
      </Modal>
    );
  }

  // ── Add leave ────────────────────────────────────────────
  const submitLeave = async () => {
    if (!form.reason.trim()) {
      addToast('Record the reason for the leave', 'error');
      return;
    }
    setPending(true);
    try {
      await membershipService.pauseMembership({
        studentId: student.id,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        seatAction: form.seatAction,
      });
      addToast('Membership paused', 'success', { description: `${formatDate(form.startDate)} → ${formatDate(form.endDate)}` });
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
      title="Add leave"
      description={`${student.name} · membership will be paused`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submitLeave}>Pause membership</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pl-start">From</label>
            <input id="pl-start" type="date" className="form-input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pl-end">To</label>
            <input id="pl-end" type="date" className="form-input" value={form.endDate} min={form.startDate} onChange={(e) => set('endDate', e.target.value)} />
          </div>
        </div>

        <div className="summary-panel">
          <DetailRow label="Days paused" value={`${Math.max(0, daysUntil(form.endDate) - daysUntil(form.startDate) + 1)} days`} />
          <DetailRow label="Current expiry" value={formatDate(student.membershipExpiry)} />
          <DetailRow label="Seat" value={student.deskNumber || 'None'} />
        </div>

        {student.deskNumber && (
          <div className="form-group">
            <span className="form-label">Seat handling</span>
            <div className="radio-cards">
              <label className={`radio-card ${form.seatAction === 'released' ? 'is-selected' : ''}`}>
                <input type="radio" name="ps-seat-action" checked={form.seatAction === 'released'} onChange={() => set('seatAction', 'released')} />
                <div>
                  <strong>Temporarily release</strong>
                  <span>Someone else may use {student.deskNumber} until they return.</span>
                </div>
              </label>
              <label className={`radio-card ${form.seatAction === 'reserved' ? 'is-selected' : ''}`}>
                <input type="radio" name="ps-seat-action" checked={form.seatAction === 'reserved'} onChange={() => set('seatAction', 'reserved')} />
                <div>
                  <strong>Hold the seat</strong>
                  <span>Keep {student.deskNumber} empty for their return.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="pl-reason">Reason</label>
          <textarea id="pl-reason" className="form-textarea" rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Going home for a family function" />
        </div>
      </div>
    </Modal>
  );
}
