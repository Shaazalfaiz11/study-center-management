import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Clock, ToggleLeft, ToggleRight, Users, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal, SectionCard, ProgressBar, ActionButton, StatusBadge } from '../../components/ui/Primitives';
import { slotService } from '../../services/operationsService';

export default function SlotManagement() {
  const { slots, addToast, confirm } = useApp();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const toggle = async (slot) => {
    const ok = await confirm({
      title: slot.active ? `Deactivate the ${slot.name} shift?` : `Activate the ${slot.name} shift?`,
      tone: slot.active ? 'warning' : 'default',
      confirmLabel: slot.active ? 'Deactivate shift' : 'Activate shift',
      message: slot.active
        ? 'Students will no longer be assignable to this shift. Existing assignments are not changed.'
        : 'This shift becomes available for new assignments.',
    });
    if (!ok) return;
    try {
      await slotService.toggleSlot({ id: slot.id });
      addToast(`${slot.name} shift ${slot.active ? 'deactivated' : 'activated'}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="page-stack">
      <div className="data-table-toolbar">
        <span className="text-sm text-secondary">
          {slots.filter((s) => s.active).length} active of {slots.length} configured shifts
        </span>
        <div className="data-table-toolbar-right">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Shift
          </button>
        </div>
      </div>

      <div className="slot-grid">
        {slots.map((slot) => {
          const pct = slot.capacity ? Math.round((slot.assigned / slot.capacity) * 100) : 0;
          const free = slot.capacity - slot.assigned;
          return (
            <SectionCard
              key={slot.id}
              className={slot.active ? '' : 'is-inactive'}
              title={slot.name}
              subtitle={`${slot.startTime} – ${slot.endTime}`}
              actions={
                <button type="button" className="icon-btn" title={slot.active ? 'Deactivate' : 'Activate'} onClick={() => toggle(slot)}>
                  {slot.active ? <ToggleRight size={19} className="text-success" /> : <ToggleLeft size={19} className="text-muted" />}
                </button>
              }
            >
              <div className="slot-body">
                <div className="slot-numbers">
                  <div className="slot-number">
                    <span className="slot-number-value">{slot.assigned}</span>
                    <span className="slot-number-label">Assigned</span>
                  </div>
                  <div className="slot-number">
                    <span className="slot-number-value">{slot.seated}</span>
                    <span className="slot-number-label">With a seat</span>
                  </div>
                  <div className="slot-number">
                    <span className={`slot-number-value ${free <= 0 ? 'text-error' : free < 5 ? 'text-warning' : ''}`}>{free}</span>
                    <span className="slot-number-label">Places left</span>
                  </div>
                </div>

                <div>
                  <div className="slot-meter-head">
                    <span className="text-sm text-secondary">Capacity used</span>
                    <span className={`text-sm font-semibold ${pct >= 90 ? 'text-error' : pct >= 75 ? 'text-warning' : ''}`}>{pct}%</span>
                  </div>
                  <ProgressBar value={pct} />
                  <span className="text-xs text-muted">{slot.assigned} of {slot.capacity} places</span>
                </div>

                <div className="slot-footer">
                  <StatusBadge status={slot.active ? 'active' : 'inactive'} />
                  <div className="btn-group">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/students?slot=${slot.id}`)}>
                      <Users size={13} /> Students
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(slot)}>
                      <Edit2 size={13} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <div className="callout callout-info">
        <Clock size={15} className="callout-icon" />
        <div>
          Shift capacity limits how many students can be assigned. When a shift is full, shift change requests into it are
          blocked automatically —{' '}
          <button type="button" className="link-button" onClick={() => navigate('/assignments/shift-changes')}>
            review pending requests <ArrowRight size={11} style={{ verticalAlign: '-1px' }} />
          </button>
        </div>
      </div>

      <SlotFormModal
        open={showAdd || Boolean(editing)}
        slot={editing}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        addToast={addToast}
      />
    </div>
  );
}

function SlotFormModal({ open, slot, onClose, addToast }) {
  const [form, setForm] = useState({ name: '', startTime: '', endTime: '', capacity: 40 });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [initialised, setInitialised] = useState(false);

  if (open && !initialised) {
    setForm(slot ? { name: slot.name, startTime: slot.startTime, endTime: slot.endTime, capacity: slot.capacity } : { name: '', startTime: '', endTime: '', capacity: 40 });
    setInitialised(true);
  }

  const close = () => {
    setInitialised(false);
    setErrors({});
    setPending(false);
    onClose();
  };

  if (!open) return null;

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const submit = async () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Shift name is required';
    if (!form.startTime.trim()) errs.startTime = 'Start time is required';
    if (!form.endTime.trim()) errs.endTime = 'End time is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await slotService.saveSlot({ id: slot?.id, ...form });
      addToast(slot ? 'Shift updated' : 'Shift created', 'success');
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
      title={slot ? `Edit ${slot.name} shift` : 'Add a shift'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>{slot ? 'Save changes' : 'Create shift'}</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="sl-name">Shift name <span className="required">*</span></label>
          <input id="sl-name" className={`form-input ${errors.name ? 'error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning" />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="sl-start">Start time <span className="required">*</span></label>
            <input id="sl-start" className={`form-input ${errors.startTime ? 'error' : ''}`} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} placeholder="06:00 AM" />
            {errors.startTime && <span className="form-error">{errors.startTime}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sl-end">End time <span className="required">*</span></label>
            <input id="sl-end" className={`form-input ${errors.endTime ? 'error' : ''}`} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} placeholder="12:00 PM" />
            {errors.endTime && <span className="form-error">{errors.endTime}</span>}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="sl-capacity">Capacity</label>
          <input id="sl-capacity" type="number" className="form-input" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
          <span className="form-hint">How many students can be assigned to this shift at once.</span>
        </div>
      </div>
    </Modal>
  );
}
