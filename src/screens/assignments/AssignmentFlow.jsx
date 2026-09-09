import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ArrowLeft, AlertTriangle, Armchair, Search, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import seatService from '../../services/seatService';
import { SectionCard, DetailRow, Avatar, ActionButton, StatusBadge } from '../../components/ui/Primitives';
import { EmptyState } from '../../components/ui/StateViews';
import { formatCurrency, formatDate, relativeDay } from '../../services/businessRules';
import './AssignmentFlow.css';

const STEPS = ['Student', 'Shift', 'Seat', 'Confirm'];

export default function AssignmentFlow() {
  const { students, slots, desks, addToast, confirm } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [student, setStudent] = useState(null);
  const [slot, setSlot] = useState(null);
  const [seat, setSeat] = useState(null);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(null);

  // Only active students without a seat need assigning.
  const candidates = useMemo(() => {
    const list = students.filter((s) => s.status === 'active' && !s.deskId);
    if (!search.trim()) return list.slice(0, 40);
    const q = search.toLowerCase();
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.phone.includes(q));
  }, [students, search]);

  const availableSeats = useMemo(() => {
    const list = desks.filter((d) => d.status === 'available');
    return section === 'all' ? list : list.filter((d) => d.section === section);
  }, [desks, section]);

  const sections = useMemo(() => [...new Set(desks.map((d) => d.section))].sort(), [desks]);

  const reset = () => {
    setStep(0);
    setStudent(null);
    setSlot(null);
    setSeat(null);
    setSearch('');
    setDone(null);
  };

  const submit = async () => {
    const ok = await confirm({
      title: 'Confirm this assignment?',
      confirmLabel: 'Assign seat',
      message: `${student.name} will be assigned seat ${seat.number} in the ${slot.name} shift.`,
      details: (
        <div className="confirm-list">
          <DetailRow label="Seat" value={`${seat.number} · ${seat.floorName}, Section ${seat.section}`} />
          <DetailRow label="Shift" value={`${slot.name} (${slot.startTime} – ${slot.endTime})`} />
          <DetailRow label="Membership valid to" value={formatDate(student.membershipExpiry)} />
        </div>
      ),
    });
    if (!ok) return;

    setPending(true);
    try {
      const result = await seatService.assignSeat({ studentId: student.id, seatId: seat.id, slotId: slot.id });
      addToast('Seat assigned', 'success', { description: `${result.seatNumber} → ${result.studentName}` });
      setDone({ student, slot, seat });
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setPending(false);
    }
  };

  // ── Success ──────────────────────────────────────────────
  if (done) {
    return (
      <div className="assignment-success">
        <div className="assignment-success-icon">
          <CheckCircle2 size={28} />
        </div>
        <h2>Seat assigned</h2>
        <p className="text-secondary">{done.student.name} is now on seat {done.seat.number}.</p>

        <SectionCard className="assignment-success-card">
          <DetailRow label="Student" value={done.student.name} strong />
          <DetailRow label="Student ID" value={done.student.studentId} />
          <DetailRow label="Shift" value={`${done.slot.name} · ${done.slot.startTime} – ${done.slot.endTime}`} />
          <DetailRow label="Seat" value={`${done.seat.number} · ${done.seat.floorName}, Section ${done.seat.section}`} />
        </SectionCard>

        <div className="btn-group">
          <button type="button" className="btn btn-secondary" onClick={reset}>New assignment</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/students/${done.student.id}`)}>View student</button>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/seats/map?seat=${done.seat.number}`)}>View on seat map</button>
        </div>
      </div>
    );
  }

  return (
    <div className="assignment-flow">
      {/* Steps */}
      <ol className="step-indicator">
        {STEPS.map((label, i) => (
          <li key={label} className={`step ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`}>
            <span className="step-marker">{i < step ? <Check size={13} /> : i + 1}</span>
            <span className="step-label">{label}</span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="step-arrow" />}
          </li>
        ))}
      </ol>

      {/* Step 0 — student */}
      {step === 0 && (
        <SectionCard title="Select a student" subtitle={`${candidates.length} active student${candidates.length === 1 ? '' : 's'} without a seat`}>
          <div className="search-field w-full mb-3">
            <Search size={15} className="search-field-icon" />
            <input className="form-input search-field-input" placeholder="Search by name, ID or phone…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>

          {candidates.length === 0 ? (
            <EmptyState
              compact
              icon={CheckCircle2}
              title={search ? 'No matching students' : 'Everyone has a seat'}
              description={search ? 'Try a different search.' : 'Every active student is already assigned a seat.'}
            />
          ) : (
            <div className="pick-list">
              {candidates.map((s) => (
                <button key={s.id} type="button" className={`pick-item ${student?.id === s.id ? 'is-selected' : ''}`} onClick={() => setStudent(s)}>
                  <Avatar name={s.name} size={32} />
                  <div className="pick-item-body">
                    <span className="pick-item-title">{s.name}</span>
                    <span className="pick-item-sub">{s.studentId} · {s.membershipPlan} · {s.slotName} shift</span>
                  </div>
                  <StatusBadge status={s.membershipStatus} />
                  {student?.id === s.id && <Check size={16} className="text-primary" />}
                </button>
              ))}
            </div>
          )}

          <div className="step-footer">
            <span />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!student}
              onClick={() => {
                setSlot(slots.find((s) => s.id === student.slotId) || null);
                setStep(1);
              }}
            >
              Next
            </button>
          </div>
        </SectionCard>
      )}

      {/* Step 1 — shift */}
      {step === 1 && (
        <SectionCard title="Select a shift" subtitle={`For ${student?.name}`}>
          <div className="pick-list">
            {slots.filter((s) => s.active).map((s) => {
              const free = s.capacity - s.assigned;
              const full = free <= 0;
              return (
                <button key={s.id} type="button" className={`pick-item ${slot?.id === s.id ? 'is-selected' : ''} ${full ? 'is-disabled' : ''}`} disabled={full} onClick={() => setSlot(s)}>
                  <div className="pick-item-body">
                    <span className="pick-item-title">{s.name}</span>
                    <span className="pick-item-sub">{s.startTime} – {s.endTime}</span>
                  </div>
                  <div className="pick-item-side">
                    <span className={`pick-item-value ${full ? 'text-error' : free < 5 ? 'text-warning' : ''}`}>{full ? 'Full' : `${free} free`}</span>
                    <span className="pick-item-sub">{s.assigned}/{s.capacity}</span>
                  </div>
                  {slot?.id === s.id && <Check size={16} className="text-primary" />}
                </button>
              );
            })}
          </div>

          <div className="step-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!slot} onClick={() => setStep(2)}>Next</button>
          </div>
        </SectionCard>
      )}

      {/* Step 2 — seat */}
      {step === 2 && (
        <SectionCard
          title="Select a seat"
          subtitle={`${availableSeats.length} available`}
          actions={
            <select className="form-select form-select-sm" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
          }
        >
          {availableSeats.length === 0 ? (
            <EmptyState
              compact
              icon={Armchair}
              title="No seats available"
              description="Free up a seat, or add the student to the waitlist."
              action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/assignments/waitlist')}>Open waitlist</button>}
            />
          ) : (
            <div className="seat-picker">
              {availableSeats.map((d) => (
                <button key={d.id} type="button" className={`seat-pick ${seat?.id === d.id ? 'is-selected' : ''}`} onClick={() => setSeat(d)}>
                  <span className="seat-pick-number">{d.number}</span>
                  <span className="seat-pick-sub">{d.zone}</span>
                </button>
              ))}
            </div>
          )}

          <div className="step-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!seat} onClick={() => setStep(3)}>Next</button>
          </div>
        </SectionCard>
      )}

      {/* Step 3 — confirm */}
      {step === 3 && (
        <SectionCard title="Confirm assignment">
          <div className="confirm-summary">
            <DetailRow label="Student" value={`${student.name} (${student.studentId})`} strong />
            <DetailRow label="Phone" value={student.phone} />
            <DetailRow label="Membership" value={`${student.membershipPlan} · ${formatCurrency(student.planPrice)}`} />
            <DetailRow label="Valid until" value={`${formatDate(student.membershipExpiry)} · ${relativeDay(student.membershipExpiry)}`} />
            <DetailRow label="Shift" value={`${slot.name} (${slot.startTime} – ${slot.endTime})`} />
            <DetailRow label="Seat" value={`${seat.number} · ${seat.floorName}, Section ${seat.section}`} />
          </div>

          <div className="check-list">
            <Checkline ok label="Seat is available" />
            <Checkline ok={slot.assigned < slot.capacity} label={slot.assigned < slot.capacity ? `${slot.name} shift has ${slot.capacity - slot.assigned} places free` : `${slot.name} shift is full`} />
            <Checkline ok={student.membershipStatus !== 'expired'} label={student.membershipStatus === 'expired' ? 'Membership has expired — renew before assigning' : 'Membership is valid'} />
            <Checkline ok={student.outstanding === 0} label={student.outstanding > 0 ? `${formatCurrency(student.outstanding)} outstanding` : 'No outstanding dues'} warnOnly />
          </div>

          <div className="step-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={14} /> Back
            </button>
            <ActionButton pending={pending} onClick={submit}>Confirm assignment</ActionButton>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function Checkline({ ok, label, warnOnly }) {
  return (
    <div className={`check-line ${ok ? 'is-ok' : warnOnly ? 'is-warn' : 'is-bad'}`}>
      {ok ? <Check size={14} /> : <AlertTriangle size={14} />}
      <span>{label}</span>
    </div>
  );
}
