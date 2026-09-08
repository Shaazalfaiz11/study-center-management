import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Armchair, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import studentService from '../../services/studentService';
import { SectionCard, ActionButton, DetailRow } from '../../components/ui/Primitives';
import { formatCurrency, formatDate, todayISO, addDays, addMonths } from '../../services/businessRules';

const SOURCES = ['Walk-in', 'Google', 'Instagram', 'Referral', 'Pamphlet', 'Friend'];
const EXAMS = ['UPSC CSE', 'SSC CGL', 'NEET UG', 'JEE Advanced', 'IBPS PO', 'UPPSC', 'RRB NTPC', 'CA Foundation', 'CAT', 'CLAT', 'Other'];

export default function AddStudent() {
  const { slots, membershipPlans, desks, addToast } = useApp();
  const navigate = useNavigate();

  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    firstName: '', lastName: '', gender: 'Male', email: '', phone: '',
    address: '', city: 'Lucknow', pincode: '',
    emergencyName: '', emergencyContact: '', exam: '',
    membershipPlanId: '', slotId: '', deskId: '',
    source: 'Walk-in', referredBy: '', notes: '',
  });

  const availableSeats = useMemo(() => desks.filter((d) => d.status === 'available'), [desks]);
  const plan = membershipPlans.find((p) => p.id === form.membershipPlanId);
  const slot = slots.find((s) => s.id === form.slotId);
  const seat = desks.find((d) => d.id === form.deskId);

  const expiry = plan
    ? plan.durationUnit.startsWith('day')
      ? addDays(todayISO(), plan.duration)
      : addMonths(todayISO(), plan.duration)
    : null;

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    else if (form.phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter a valid 10-digit phone number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.membershipPlanId) errs.membershipPlanId = 'Select a membership plan';
    if (!form.slotId) errs.slotId = 'Select a shift';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      addToast('Please fix the highlighted fields', 'error');
      return;
    }
    setPending(true);
    try {
      const student = await studentService.createStudent(form);
      addToast('Student admitted', 'success', {
        description: `${student.name} · ${student.studentId}${seat ? ` · seat ${seat.number}` : ''}`,
      });
      navigate(`/students/${student.id}`);
    } catch (err) {
      addToast(err.message, 'error');
      setPending(false);
    }
  };

  return (
    <div className="add-student">
      <button type="button" className="btn btn-ghost btn-sm back-link" onClick={() => navigate('/students')}>
        <ArrowLeft size={14} /> All students
      </button>

      <form onSubmit={submit} className="add-student-layout">
        <div className="add-student-main">
          <SectionCard title="Personal details">
            <div className="flex flex-col gap-4">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="as-first">First name <span className="required">*</span></label>
                  <input id="as-first" className={`form-input ${errors.firstName ? 'error' : ''}`} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Rahul" autoFocus />
                  {errors.firstName && <span className="form-error">{errors.firstName}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="as-last">Last name <span className="required">*</span></label>
                  <input id="as-last" className={`form-input ${errors.lastName ? 'error' : ''}`} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Kumar" />
                  {errors.lastName && <span className="form-error">{errors.lastName}</span>}
                </div>
                <div className="form-group" style={{ maxWidth: 130 }}>
                  <label className="form-label" htmlFor="as-gender">Gender</label>
                  <select id="as-gender" className="form-select" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="as-phone">Phone <span className="required">*</span></label>
                  <input id="as-phone" className={`form-input ${errors.phone ? 'error' : ''}`} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                  {errors.phone && <span className="form-error">{errors.phone}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="as-email">Email</label>
                  <input id="as-email" type="email" className={`form-input ${errors.email ? 'error' : ''}`} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@gmail.com" />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="as-exam">Preparing for</label>
                <select id="as-exam" className="form-select" value={form.exam} onChange={(e) => set('exam', e.target.value)}>
                  <option value="">Not specified</option>
                  {EXAMS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Address & emergency contact">
            <div className="flex flex-col gap-4">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="as-address">Address</label>
                  <input id="as-address" className="form-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="House / street" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="as-city">City</label>
                  <input id="as-city" className="form-input" value={form.city} onChange={(e) => set('city', e.target.value)} />
                </div>
                <div className="form-group" style={{ maxWidth: 140 }}>
                  <label className="form-label" htmlFor="as-pin">PIN code</label>
                  <input id="as-pin" className="form-input" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="226001" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="as-econtact">Emergency contact name</label>
                  <input id="as-econtact" className="form-input" value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} placeholder="Parent or guardian" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="as-ephone">Emergency phone</label>
                  <input id="as-ephone" className="form-input" value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Membership, shift & seat">
            <div className="flex flex-col gap-4">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="as-plan">Membership plan <span className="required">*</span></label>
                  <select id="as-plan" className={`form-select ${errors.membershipPlanId ? 'error' : ''}`} value={form.membershipPlanId} onChange={(e) => set('membershipPlanId', e.target.value)}>
                    <option value="">Select a plan…</option>
                    {membershipPlans.filter((p) => p.active).map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} / {p.duration} {p.durationUnit}</option>
                    ))}
                  </select>
                  {errors.membershipPlanId && <span className="form-error">{errors.membershipPlanId}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="as-slot">Shift <span className="required">*</span></label>
                  <select id="as-slot" className={`form-select ${errors.slotId ? 'error' : ''}`} value={form.slotId} onChange={(e) => set('slotId', e.target.value)}>
                    <option value="">Select a shift…</option>
                    {slots.filter((s) => s.active).map((s) => {
                      const free = s.capacity - s.assigned;
                      return (
                        <option key={s.id} value={s.id} disabled={free <= 0}>
                          {s.name} ({s.startTime} – {s.endTime}) — {free > 0 ? `${free} free` : 'Full'}
                        </option>
                      );
                    })}
                  </select>
                  {errors.slotId && <span className="form-error">{errors.slotId}</span>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="as-seat">Seat (optional)</label>
                <select id="as-seat" className="form-select" value={form.deskId} onChange={(e) => set('deskId', e.target.value)}>
                  <option value="">Assign later</option>
                  {availableSeats.map((d) => (
                    <option key={d.id} value={d.id}>{d.number} — {d.floorName}, Section {d.section} ({d.zone})</option>
                  ))}
                </select>
                <span className="form-hint">
                  {availableSeats.length} seat{availableSeats.length === 1 ? '' : 's'} available right now.
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="How did they find us?">
            <div className="flex flex-col gap-4">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="as-source">Source</label>
                  <select id="as-source" className="form-select" value={form.source} onChange={(e) => set('source', e.target.value)}>
                    {SOURCES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {form.source === 'Referral' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="as-ref">Referred by</label>
                    <input id="as-ref" className="form-input" value={form.referredBy} onChange={(e) => set('referredBy', e.target.value)} placeholder="Existing student's name" />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="as-notes">Notes</label>
                <textarea id="as-notes" className="form-textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything the front desk should remember" />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Summary rail */}
        <aside className="add-student-side">
          <SectionCard title="Admission summary">
            <DetailRow label="Name" value={`${form.firstName} ${form.lastName}`.trim() || '—'} strong />
            <DetailRow label="Phone" value={form.phone || '—'} />
            <DetailRow label="Plan" value={plan ? `${plan.name}` : '—'} />
            <DetailRow label="Fee" value={plan ? formatCurrency(plan.price) : '—'} />
            <DetailRow label="Shift" value={slot ? slot.name : '—'} />
            <DetailRow label="Seat" value={seat ? seat.number : 'Assign later'} />
            <DetailRow label="Starts" value={formatDate(todayISO())} />
            <DetailRow label="Expires" value={expiry ? formatDate(expiry) : '—'} />
          </SectionCard>

          <div className="callout callout-info">
            <Info size={15} className="callout-icon" />
            <div>
              The plan fee is added as an outstanding balance so it shows up on the{' '}
              <strong>Fee Collection</strong> screen until it is paid.
            </div>
          </div>

          {seat && (
            <div className="callout callout-success">
              <Armchair size={15} className="callout-icon" />
              <div>
                Seat <strong>{seat.number}</strong> will be assigned immediately and marked as taken on the seat map.
              </div>
            </div>
          )}

          <div className="add-student-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/students')}>Cancel</button>
            <ActionButton pending={pending} onClick={submit} className="btn btn-primary flex-1">
              {pending ? 'Saving…' : <><Save size={14} /> Admit student</>}
            </ActionButton>
          </div>
        </aside>
      </form>
    </div>
  );
}
