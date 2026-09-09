import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, Plus, Phone, UserPlus, Trash2, Armchair } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, StatusBadge, ActionButton, Avatar } from '../../components/ui/Primitives';
import assignmentService from '../../services/assignmentService';
import { formatDate, relativeDay } from '../../services/businessRules';

export default function Waitlist() {
  const { slots, waitlist, desks, addToast, confirm } = useApp();
  const navigate = useNavigate();
  const [slotFilter, setSlotFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const { data: rows, loading, error, retry } = useAsync(
    () => assignmentService.getWaitlist({ slotId: slotFilter }),
    [slotFilter, waitlist],
  );

  const bySlot = useMemo(() => {
    const map = {};
    waitlist.forEach((w) => {
      map[w.preferredSlotId] = (map[w.preferredSlotId] || 0) + 1;
    });
    return map;
  }, [waitlist]);

  const freeSeats = desks.filter((d) => d.status === 'available').length;

  const remove = async (entry) => {
    const ok = await confirm({
      title: `Remove ${entry.name} from the waitlist?`,
      tone: 'danger',
      confirmLabel: 'Remove',
      message: 'They will no longer appear when a seat opens up in their preferred shift.',
    });
    if (!ok) return;
    try {
      await assignmentService.removeFromWaitlist({ id: entry.id, reason: 'Removed by admin' });
      addToast(`${entry.name} removed from the waitlist`, 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      accessor: (r) => r.name,
      render: (r) => (
        <div className="cell-student">
          <Avatar name={r.name} size={28} />
          <div className="cell-student-info">
            <span className="cell-student-name">{r.name}</span>
            <span className="cell-student-sub">{r.exam || 'Not specified'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (r) => r.phone,
      render: (r) => (
        <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="phone-link" onClick={(e) => e.stopPropagation()}>
          <Phone size={12} /> {r.phone}
        </a>
      ),
    },
    {
      key: 'preferredSlotName',
      header: 'Preferred Shift',
      sortable: true,
      accessor: (r) => r.preferredSlotName,
      render: (r) => (
        <div className="cell-stack">
          <span>{r.preferredSlotName}</span>
          <span className="cell-student-sub">Section {r.preferredSection}</span>
        </div>
      ),
    },
    {
      key: 'addedOn',
      header: 'Waiting Since',
      sortable: true,
      accessor: (r) => r.addedOn,
      render: (r) => (
        <div className="cell-stack">
          <span>{formatDate(r.addedOn)}</span>
          <span className="cell-student-sub">{relativeDay(r.addedOn)}</span>
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      hideBelow: 'lg',
      accessor: (r) => r.note,
      render: (r) => <span className="cell-clamp">{r.note || '—'}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      accessor: (r) => r.priority,
      render: (r) => <StatusBadge status={r.priority === 'normal' ? 'medium' : r.priority} label={r.priority === 'normal' ? 'Normal' : r.priority === 'high' ? 'High' : 'Low'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 150,
      render: (r) => (
        <div className="cell-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/students/add')}>
            <UserPlus size={12} /> Admit
          </button>
          <button type="button" className="icon-btn" title="Remove" onClick={() => remove(r)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={ListOrdered} label="Total waiting" value={waitlist.length} sublabel="Across all shifts" />
        <StatCard icon={Armchair} label="Seats free now" value={freeSeats} tone={freeSeats ? 'success' : 'warning'} sublabel="Ready to assign" onClick={() => navigate('/seats/map')} />
        {slots
          .filter((s) => s.active && bySlot[s.id])
          .slice(0, 3)
          .map((slot) => (
            <StatCard
              key={slot.id}
              label={`${slot.name} shift`}
              value={bySlot[slot.id] || 0}
              sublabel={`${slot.capacity - slot.assigned} places left`}
              onClick={() => setSlotFilter(slot.id)}
            />
          ))}
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        pageSize={12}
        searchPlaceholder="Search by name or phone…"
        searchKeys={['name', 'phone']}
        exportFileName="waitlist.csv"
        emptyIcon={ListOrdered}
        emptyTitle="Nobody is on the waitlist"
        emptyDescription="Add people who enquire when the shift they want is full."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add to waitlist
          </button>
        }
        filters={[
          {
            key: 'slot',
            label: 'Shift',
            value: slotFilter,
            onChange: setSlotFilter,
            options: [{ value: 'all', label: 'All shifts' }, ...slots.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))],
          },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add to Waitlist
          </button>
        }
      />

      <AddWaitlistModal open={showAdd} onClose={() => setShowAdd(false)} slots={slots} addToast={addToast} />
    </div>
  );
}

function AddWaitlistModal({ open, onClose, slots, addToast }) {
  const blank = { name: '', phone: '', preferredSlotId: '', preferredSection: 'Any', exam: '', note: '', priority: 'normal' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

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
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (!form.preferredSlotId) errs.preferredSlotId = 'Select the shift they want';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await assignmentService.addToWaitlist(form);
      addToast('Added to the waitlist', 'success', { description: `${form.name} will be contacted when a seat opens.` });
      close();
    } catch (err) {
      addToast(err.message, 'error');
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add to waitlist"
      description="Record an enquiry when the shift they want has no free seat."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Add to waitlist</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="wl-name">Name <span className="required">*</span></label>
            <input id="wl-name" className={`form-input ${errors.name ? 'error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="wl-phone">Phone <span className="required">*</span></label>
            <input id="wl-phone" className={`form-input ${errors.phone ? 'error' : ''}`} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            {errors.phone && <span className="form-error">{errors.phone}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="wl-slot">Preferred shift <span className="required">*</span></label>
            <select id="wl-slot" className={`form-select ${errors.preferredSlotId ? 'error' : ''}`} value={form.preferredSlotId} onChange={(e) => set('preferredSlotId', e.target.value)}>
              <option value="">Select…</option>
              {slots.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime} – {s.endTime})</option>
              ))}
            </select>
            {errors.preferredSlotId && <span className="form-error">{errors.preferredSlotId}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="wl-section">Preferred section</label>
            <select id="wl-section" className="form-select" value={form.preferredSection} onChange={(e) => set('preferredSection', e.target.value)}>
              <option value="Any">Any section</option>
              <option value="A">Section A — Silent Zone</option>
              <option value="B">Section B — General</option>
              <option value="C">Section C — Cabins</option>
              <option value="D">Section D — Group Study</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="wl-exam">Preparing for</label>
            <input id="wl-exam" className="form-input" value={form.exam} onChange={(e) => set('exam', e.target.value)} placeholder="e.g. UPSC CSE" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="wl-priority">Priority</label>
            <select id="wl-priority" className="form-select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="wl-note">Note</label>
          <input id="wl-note" className="form-input" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Can start from next Monday" />
        </div>
      </div>
    </Modal>
  );
}
