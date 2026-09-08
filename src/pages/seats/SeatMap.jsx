import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, RefreshCw, SlidersHorizontal, User, Eye, Repeat, Wrench, Ban,
  CheckCircle2, Armchair, Clock, UserPlus, Undo2, History, AlertTriangle, ArrowRight, Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import seatService from '../../services/seatService';
import assignmentService from '../../services/assignmentService';
import { Drawer, Modal, StatusBadge, DetailRow, Avatar, ActionButton, SectionCard } from '../../components/ui/Primitives';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/StateViews';
import { SEAT_STATUS_META, formatDate, relativeDay, daysSince, statusLabel } from '../../services/businessRules';
import './SeatMap.css';

const LEGEND = ['available', 'assigned', 'occupied', 'reserved', 'temporarily_released', 'maintenance', 'blocked'];

export default function LiveSeatMap() {
  const { desks, students, floors, slots, addToast, confirm, waitlist } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState({ floor: 'all', section: 'all', slotId: 'all', status: 'all' });
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: seats, loading, error, retry } = useAsync(
    () => seatService.getSeats({ ...filters, search }),
    [filters, search, desks],
  );

  // Deep link: /seats/map?seat=A-24
  useEffect(() => {
    const seatNumber = searchParams.get('seat');
    if (seatNumber) {
      const match = desks.find((d) => d.number.toLowerCase() === seatNumber.toLowerCase());
      if (match) setSelectedId(match.id);
      searchParams.delete('seat');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, desks, setSearchParams]);

  const selected = selectedId ? desks.find((d) => d.id === selectedId) : null;

  const grouped = useMemo(() => {
    const groups = new Map();
    (seats || []).forEach((seat) => {
      const key = `${seat.floorName} · Section ${seat.section}`;
      if (!groups.has(key)) groups.set(key, { key, zone: seat.zone, seats: [] });
      groups.get(key).seats.push(seat);
    });
    return [...groups.values()];
  }, [seats]);

  const counts = useMemo(() => {
    const map = {};
    desks.forEach((d) => {
      map[d.status] = (map[d.status] || 0) + 1;
    });
    return map;
  }, [desks]);

  const sections = useMemo(() => {
    if (filters.floor === 'all') return [...new Set(floors.flatMap((f) => f.sections))];
    return floors.find((f) => f.id === Number(filters.floor))?.sections || [];
  }, [filters.floor, floors]);

  const refresh = async () => {
    setRefreshing(true);
    await retry();
    setTimeout(() => {
      setRefreshing(false);
      addToast('Seat map refreshed', 'info');
    }, 400);
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, ...(key === 'floor' ? { section: 'all' } : {}) }));
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== 'all').length;

  return (
    <div className="page-stack">
      {/* Status summary strip */}
      <div className="seat-summary">
        {LEGEND.map((status) => {
          const meta = SEAT_STATUS_META[status];
          const active = filters.status === status;
          return (
            <button
              key={status}
              type="button"
              className={`seat-summary-item ${active ? 'is-active' : ''}`}
              onClick={() => setFilter('status', active ? 'all' : status)}
            >
              <span className="seat-summary-dot" style={{ background: meta.color }} />
              <span className="seat-summary-count">{counts[status] || 0}</span>
              <span className="seat-summary-label">{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="data-table-toolbar">
        <div className="search-field">
          <Search size={15} className="search-field-icon" />
          <input
            type="search"
            className="form-input search-field-input"
            placeholder="Find a seat, e.g. A-24"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search seats"
          />
        </div>

        <button type="button" className={`btn btn-secondary btn-sm filter-toggle ${showFilters || activeFilters ? 'is-active' : ''}`} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={14} /> Filters
          {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </button>

        <div className={`data-table-filters ${showFilters ? 'is-open' : ''}`}>
          <label className="inline-field">
            <span className="inline-field-label">Floor</span>
            <select className="form-select form-select-sm" value={filters.floor} onChange={(e) => setFilter('floor', e.target.value)}>
              <option value="all">All</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span className="inline-field-label">Section</span>
            <select className="form-select form-select-sm" value={filters.section} onChange={(e) => setFilter('section', e.target.value)}>
              <option value="all">All</option>
              {sections.map((s) => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span className="inline-field-label">Shift</span>
            <select className="form-select form-select-sm" value={filters.slotId} onChange={(e) => setFilter('slotId', e.target.value)}>
              <option value="all">All</option>
              {slots.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          {activeFilters > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({ floor: 'all', section: 'all', slotId: 'all', status: 'all' })}>
              Clear
            </button>
          )}
        </div>

        <div className="data-table-toolbar-right">
          <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} /> Refresh
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/assignments')}>
            <UserPlus size={14} /> Assign Seat
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading && !seats ? (
        <div className="seat-map-skeleton">
          {Array.from({ length: 40 }, (_, i) => (
            <Skeleton key={i} height={52} radius={8} />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Unable to load the seat map" description={error.message} onRetry={retry} />
      ) : grouped.length === 0 ? (
        <div className="table-container">
          <EmptyState
            icon={Armchair}
            title="No seats match these filters"
            description="Try clearing the filters or searching for a different seat number."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFilters({ floor: 'all', section: 'all', slotId: 'all', status: 'all' }); setSearch(''); }}>
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="seat-map-sections">
          {grouped.map((group) => (
            <section key={group.key} className="seat-map-section">
              <header className="seat-map-section-head">
                <h3 className="seat-map-section-title">{group.key}</h3>
                <span className="seat-map-section-meta">
                  {group.zone} · {group.seats.length} seats
                </span>
              </header>
              <div className="seat-grid">
                {group.seats.map((seat) => {
                  const meta = SEAT_STATUS_META[seat.status];
                  const holder = seat.studentId ? students.find((s) => s.id === seat.studentId) : null;
                  const temp = seat.temporary?.tempStudentId ? students.find((s) => s.id === seat.temporary.tempStudentId) : null;
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      className={`seat-cell seat-${seat.status} ${selectedId === seat.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedId(seat.id)}
                      title={`${seat.number} — ${meta.label}${holder ? ` · ${holder.name}` : ''}`}
                    >
                      <span className="seat-number">{seat.number}</span>
                      <span className="seat-occupant">{temp ? temp.firstName : holder ? holder.firstName : meta.label}</span>
                      {seat.temporary && <span className="seat-flag" title="Temporarily released" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <SeatDrawer
        seat={selected}
        onClose={() => setSelectedId(null)}
        students={students}
        slots={slots}
        waitlist={waitlist}
        addToast={addToast}
        confirm={confirm}
        navigate={navigate}
      />
    </div>
  );
}

// ============================================================
// Seat detail drawer
// ============================================================
function SeatDrawer({ seat, onClose, students, slots, waitlist, addToast, confirm, navigate }) {
  const [pending, setPending] = useState(false);
  const [showReallocate, setShowReallocate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: history } = useAsync(
    () => (seat ? assignmentService.getAssignmentHistory({ seatNumber: seat.number }) : Promise.resolve([])),
    [seat?.number],
  );

  if (!seat) return null;

  const holder = seat.studentId ? students.find((s) => s.id === seat.studentId) : null;
  const tempStudent = seat.temporary?.tempStudentId ? students.find((s) => s.id === seat.temporary.tempStudentId) : null;
  const isTemporarilyReleased = Boolean(seat.temporary);
  const waitingCount = waitlist.filter((w) => !holder || w.preferredSlotId === holder.slotId).length;

  const run = async (fn, successMessage, description) => {
    setPending(true);
    try {
      await fn();
      addToast(successMessage, 'success', description ? { description } : undefined);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  const markMaintenance = async () => {
    const ok = await confirm({
      title: `Mark ${seat.number} for maintenance?`,
      tone: 'warning',
      confirmLabel: 'Mark for maintenance',
      message: 'The seat will not be offered for assignment until maintenance is cleared.',
    });
    if (!ok) return;
    run(() => seatService.setSeatStatus({ seatId: seat.id, override: 'maintenance' }), `${seat.number} marked for maintenance`);
  };

  const blockSeat = async () => {
    const ok = await confirm({
      title: `Block ${seat.number}?`,
      tone: 'danger',
      confirmLabel: 'Block seat',
      message: 'Blocked seats are taken out of circulation entirely — use this for staff seats or seats that are unusable.',
    });
    if (!ok) return;
    run(() => seatService.setSeatStatus({ seatId: seat.id, override: 'blocked' }), `${seat.number} blocked`);
  };

  const makeAvailable = () =>
    run(() => seatService.setSeatStatus({ seatId: seat.id, override: null }), `${seat.number} is available again`);

  const keepReserved = () =>
    run(() => seatService.keepReserved({ seatId: seat.id }), `${seat.number} held for ${holder?.name || 'the holder'}`,
      'The seat will stay empty until they return.');

  const endTempAllocation = async () => {
    const ok = await confirm({
      title: 'End the temporary allocation?',
      tone: 'warning',
      confirmLabel: 'End temporary use',
      message: `${tempStudent?.name} will give up ${seat.number}. The seat goes back to being temporarily released for ${holder?.name}.`,
    });
    if (!ok) return;
    run(() => seatService.endTemporaryAllocation({ seatId: seat.id }), 'Temporary allocation ended');
  };

  const releaseSeat = async () => {
    const ok = await confirm({
      title: `Release ${seat.number} permanently?`,
      tone: 'danger',
      confirmLabel: 'Release seat',
      message: `${holder?.name} will lose this seat and it becomes available to anyone. This is not the same as a temporary release.`,
      details: (
        <div className="confirm-list">
          <DetailRow label="Student" value={holder?.name} />
          <DetailRow label="Membership" value={`${holder?.membershipPlan} · expires ${formatDate(holder?.membershipExpiry)}`} />
          <DetailRow label="After release" value="Seat becomes available" />
        </div>
      ),
    });
    if (!ok) return;
    run(() => seatService.releaseSeat({ studentId: holder.id, reason: 'Released from seat map' }), `${seat.number} released`);
    onClose();
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={`Seat ${seat.number}`}
        subtitle={`${seat.floorName} · Section ${seat.section} · ${seat.zone}`}
        width={440}
      >
        {/* Status */}
        <div className="drawer-status-row">
          <StatusBadge status={seat.status} />
          {isTemporarilyReleased && (
            <span className="text-sm text-muted">
              Until {formatDate(seat.temporary.to)} · {relativeDay(seat.temporary.to)}
            </span>
          )}
        </div>

        {/* Temporary release banner — the key distinction */}
        {isTemporarilyReleased && (
          <div className="callout callout-warning">
            <Clock size={15} className="callout-icon" />
            <div>
              <span className="callout-title">Temporary release, not a reassignment</span>
              {holder?.name} still holds this seat. It is free until {formatDate(seat.temporary.to)}, after which it returns
              to them automatically.
            </div>
          </div>
        )}

        {/* Holder */}
        {holder ? (
          <SectionCard title={isTemporarilyReleased ? 'Seat holder (on leave)' : 'Assigned student'} padded={false}>
            <button type="button" className="student-card" onClick={() => { onClose(); navigate(`/students/${holder.id}`); }}>
              <Avatar name={holder.name} size={36} />
              <div className="student-card-info">
                <span className="student-card-name">{holder.name}</span>
                <span className="student-card-sub">{holder.studentId} · {holder.exam}</span>
              </div>
              <ArrowRight size={15} className="text-muted" />
            </button>
            <div className="card-body" style={{ paddingTop: 0 }}>
              <DetailRow label="Shift" value={holder.slotName} />
              <DetailRow label="Membership" value={holder.membershipPlan} />
              <DetailRow label="Expires" value={`${formatDate(holder.membershipExpiry)} · ${relativeDay(holder.membershipExpiry)}`} />
              <DetailRow
                label="Last attendance"
                value={
                  holder.lastAttendanceDate ? (
                    <>
                      {formatDate(holder.lastAttendanceDate)}
                      {daysSince(holder.lastAttendanceDate) >= 7 && <span className="text-error"> · {daysSince(holder.lastAttendanceDate)} days ago</span>}
                    </>
                  ) : (
                    'Never checked in'
                  )
                }
              />
              <DetailRow label="Payment" value={<StatusBadge status={holder.paymentStatus} />} />
            </div>
          </SectionCard>
        ) : (
          <div className="seat-empty-holder">
            <User size={20} className="text-muted" />
            <span className="text-sm text-secondary">No student assigned to this seat</span>
          </div>
        )}

        {/* Temporary occupant */}
        {tempStudent && (
          <SectionCard title="Temporary occupant" subtitle={`Until ${formatDate(seat.temporary.to)}`} padded={false}>
            <button type="button" className="student-card" onClick={() => { onClose(); navigate(`/students/${tempStudent.id}`); }}>
              <Avatar name={tempStudent.name} size={36} />
              <div className="student-card-info">
                <span className="student-card-name">{tempStudent.name}</span>
                <span className="student-card-sub">{tempStudent.studentId} · {tempStudent.slotName}</span>
              </div>
              <ArrowRight size={15} className="text-muted" />
            </button>
          </SectionCard>
        )}

        {/* Waiting list signal */}
        {(seat.status === 'available' || isTemporarilyReleased) && waitingCount > 0 && (
          <div className="callout callout-info">
            <User size={15} className="callout-icon" />
            <div>
              <strong>{waitingCount}</strong> student{waitingCount === 1 ? ' is' : 's are'} waiting for a seat.{' '}
              <button type="button" className="link-button" onClick={() => { onClose(); navigate('/assignments/waitlist'); }}>
                View waitlist
              </button>
            </div>
          </div>
        )}

        {/* Seat facts */}
        <SectionCard title="Seat details" padded={false}>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <DetailRow label="Floor" value={seat.floorName} />
            <DetailRow label="Section" value={`Section ${seat.section} · ${seat.zone}`} />
            <DetailRow label="Shift" value={slots.find((s) => s.id === seat.slotId)?.name || 'Not tied to a shift'} />
            <DetailRow label="Last used" value={seat.lastUsed ? `${formatDate(seat.lastUsed)} · ${relativeDay(seat.lastUsed)}` : 'No record'} />
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="drawer-block">
          <span className="uppercase-label">Actions</span>
          <div className="drawer-actions">
            {isTemporarilyReleased && !tempStudent && (
              <>
                <ActionButton className="btn btn-primary btn-block" pending={pending} onClick={() => setShowReallocate(true)}>
                  <UserPlus size={14} /> Reallocate temporarily
                </ActionButton>
                <ActionButton className="btn btn-secondary btn-block" pending={pending} onClick={keepReserved}>
                  <Lock size={14} /> Keep reserved for holder
                </ActionButton>
              </>
            )}

            {tempStudent && (
              <ActionButton className="btn btn-secondary btn-block" pending={pending} onClick={endTempAllocation}>
                <Undo2 size={14} /> End temporary use
              </ActionButton>
            )}

            {holder && (
              <>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => { onClose(); navigate(`/students/${holder.id}`); }}>
                  <Eye size={14} /> View student
                </button>
                {!isTemporarilyReleased && (
                  <>
                    <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowTransfer(true)}>
                      <Repeat size={14} /> Transfer to another seat
                    </button>
                    <ActionButton className="btn btn-outline-danger btn-block" pending={pending} onClick={releaseSeat}>
                      <Undo2 size={14} /> Release seat permanently
                    </ActionButton>
                  </>
                )}
              </>
            )}

            {!holder && seat.status === 'available' && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => { onClose(); navigate('/assignments'); }}>
                <UserPlus size={14} /> Assign a student
              </button>
            )}

            {!holder && (seat.status === 'available' || seat.status === 'reserved') && (
              <>
                <ActionButton className="btn btn-secondary btn-block" pending={pending} onClick={markMaintenance}>
                  <Wrench size={14} /> Mark for maintenance
                </ActionButton>
                <ActionButton className="btn btn-secondary btn-block" pending={pending} onClick={blockSeat}>
                  <Ban size={14} /> Block seat
                </ActionButton>
              </>
            )}

            {(seat.status === 'maintenance' || seat.status === 'blocked' || seat.status === 'reserved') && (
              <ActionButton className="btn btn-success btn-block" pending={pending} onClick={makeAvailable}>
                <CheckCircle2 size={14} /> Make available
              </ActionButton>
            )}
          </div>
        </div>

        {/* Assignment history */}
        <div className="drawer-block">
          <span className="uppercase-label">
            <History size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Assignment history
          </span>
          {history && history.length > 0 ? (
            <div className="timeline mt-2">
              {history.map((h) => (
                <div key={h.id} className="timeline-item">
                  <span className={`timeline-dot ${h.type === 'released' ? 'timeline-dot-error' : h.type === 'temp_released' ? 'timeline-dot-warning' : h.type === 'assigned' ? 'timeline-dot-success' : ''}`} />
                  <div className="timeline-content">
                    <span className="timeline-text">
                      <strong>{h.studentName}</strong> — {historyLabel(h)}
                    </span>
                    <span className="timeline-date">{formatDate(h.date)} · {h.by}</span>
                    {h.note && <span className="timeline-note">{h.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted mt-2">No assignment history for this seat yet.</p>
          )}
        </div>
      </Drawer>

      <ReallocateModal
        open={showReallocate}
        onClose={() => setShowReallocate(false)}
        seat={seat}
        holder={holder}
        students={students}
        waitlist={waitlist}
        addToast={addToast}
      />

      <TransferModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        seat={seat}
        holder={holder}
        addToast={addToast}
        confirm={confirm}
      />
    </>
  );
}

const historyLabel = (h) => {
  switch (h.type) {
    case 'assigned': return `assigned to ${h.toSeat}`;
    case 'transferred': return `moved ${h.fromSeat} → ${h.toSeat}`;
    case 'released': return `released ${h.fromSeat}`;
    case 'temp_released': return `${h.fromSeat} temporarily released`;
    case 'temp_allocated': return `given temporary use of ${h.toSeat}`;
    case 'resumed': return `returned to ${h.toSeat}`;
    default: return statusLabel(h.type);
  }
};

// ============================================================
// Reallocate a temporarily released seat
// ============================================================
function ReallocateModal({ open, onClose, seat, holder, students, waitlist, addToast }) {
  const [studentId, setStudentId] = useState('');
  const [pending, setPending] = useState(false);

  const candidates = useMemo(
    () => students.filter((s) => !s.deskId && s.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  const waitingHere = waitlist.filter((w) => !holder || w.preferredSlotId === holder.slotId);

  if (!open || !seat?.temporary) return null;

  const submit = async () => {
    if (!studentId) {
      addToast('Select a student', 'error');
      return;
    }
    setPending(true);
    try {
      const result = await seatService.reallocateTemporarily({ seatId: seat.id, tempStudentId: studentId, until: seat.temporary.to });
      addToast('Seat temporarily allocated', 'success', {
        description: `${result.tempStudentName} can use ${result.seatNumber} until ${formatDate(seat.temporary.to)}.`,
      });
      setStudentId('');
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reallocate ${seat.number} temporarily`}
      description={`${holder?.name} keeps this seat — someone else may use it until they return.`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <ActionButton pending={pending} onClick={submit} disabled={!studentId}>Allocate temporarily</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="callout callout-warning">
          <AlertTriangle size={15} className="callout-icon" />
          <div>
            <span className="callout-title">This does not transfer the seat</span>
            {holder?.name} remains the assigned holder. On {formatDate(seat.temporary.to)} the seat returns to them and the
            temporary occupant is moved off automatically.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="realloc-student">Student without a seat</label>
          <select id="realloc-student" className="form-select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select a student…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.studentId}) — {s.slotName} shift
              </option>
            ))}
          </select>
          {candidates.length === 0 && <span className="form-hint">Every active student already has a seat.</span>}
        </div>

        {waitingHere.length > 0 && (
          <div className="waitlist-preview">
            <span className="uppercase-label">Also waiting for a {holder?.slotName} seat</span>
            <ul className="waitlist-preview-list">
              {waitingHere.slice(0, 3).map((w) => (
                <li key={w.id}>
                  <span>{w.name}</span>
                  <span className="text-muted">{w.phone} · waiting since {formatDate(w.addedOn)}</span>
                </li>
              ))}
            </ul>
            <span className="form-hint">Waitlisted people are not students yet — admit them first to allocate a seat.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// Permanent transfer
// ============================================================
function TransferModal({ open, onClose, seat, holder, addToast, confirm }) {
  const { desks } = useApp();
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  const available = useMemo(() => desks.filter((d) => d.status === 'available'), [desks]);

  if (!open || !holder) return null;

  const submit = async () => {
    const target = desks.find((d) => d.id === targetId);
    if (!target) {
      addToast('Select the seat to move them to', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Transfer this seat?',
      tone: 'warning',
      confirmLabel: 'Transfer seat',
      message: `${holder.name} moves from ${seat.number} to ${target.number}.`,
      details: (
        <div className="confirm-list">
          <DetailRow label={`${seat.number} becomes`} value="Available" />
          <DetailRow label={`${target.number} becomes`} value="Assigned" />
          <DetailRow label="Recorded in" value="Assignment history and audit log" />
        </div>
      ),
    });
    if (!ok) return;

    setPending(true);
    try {
      const result = await seatService.transferSeat({ studentId: holder.id, toSeatId: targetId, reason });
      addToast('Seat transferred', 'success', { description: `${holder.name}: ${result.from} → ${result.to}` });
      setTargetId('');
      setReason('');
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer seat"
      description={`${holder.name} · currently on ${seat.number}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <ActionButton pending={pending} onClick={submit} disabled={!targetId}>Transfer</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="transfer-seat">Move to</label>
          <select id="transfer-seat" className="form-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Select an available seat…</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} — {d.floorName}, Section {d.section} ({d.zone})
              </option>
            ))}
          </select>
          {available.length === 0 && <span className="form-hint">No seats are free right now.</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="transfer-reason">Reason (optional)</label>
          <input id="transfer-reason" className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wants a seat away from the door" />
        </div>
      </div>
    </Modal>
  );
}
