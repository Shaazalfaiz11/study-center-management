import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Eye, Armchair, Wrench, Ban, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, StatusBadge, ActionButton } from '../../components/ui/Primitives';
import seatService from '../../services/seatService';
import { SEAT_STATUS_META, formatDate, relativeDay } from '../../services/businessRules';

export default function DeskManagement() {
  const { desks, students, floors, stats, addToast } = useApp();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ floor: 'all', section: 'all', status: 'all' });
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: rows, loading, error, retry } = useAsync(() => seatService.getSeats(filters), [filters, desks]);

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const holderOf = (seat) => (seat.studentId ? students.find((s) => s.id === seat.studentId) : null);

  const columns = [
    { key: 'number', header: 'Seat', sortable: true, accessor: (d) => d.number, className: 'cell-mono cell-strong' },
    { key: 'floorName', header: 'Floor', sortable: true, hideBelow: 'md', accessor: (d) => d.floorName },
    {
      key: 'section',
      header: 'Section',
      sortable: true,
      accessor: (d) => d.section,
      render: (d) => (
        <div className="cell-stack">
          <span>Section {d.section}</span>
          <span className="cell-student-sub">{d.zone}</span>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Assigned Student',
      sortable: true,
      accessor: (d) => holderOf(d)?.name || '',
      render: (d) => {
        const holder = holderOf(d);
        if (!holder) return <span className="text-muted">Unassigned</span>;
        return (
          <div className="cell-stack">
            <button type="button" className="link-button" onClick={(e) => { e.stopPropagation(); navigate(`/students/${holder.id}`); }}>
              {holder.name}
            </button>
            <span className="cell-student-sub">{holder.slotName} shift</span>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (d) => d.status, render: (d) => <StatusBadge status={d.status} /> },
    {
      key: 'lastUsed',
      header: 'Last Used',
      sortable: true,
      hideBelow: 'lg',
      accessor: (d) => d.lastUsed,
      render: (d) => (d.lastUsed ? <div className="cell-stack"><span>{formatDate(d.lastUsed)}</span><span className="cell-student-sub">{relativeDay(d.lastUsed)}</span></div> : <span className="text-muted">—</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 90,
      render: (d) => (
        <div className="cell-actions">
          <button type="button" className="icon-btn" title="Edit seat" onClick={() => setEditing(d)}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="icon-btn" title="Open on seat map" onClick={() => navigate(`/seats/map?seat=${d.number}`)}>
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={Armchair} label="Total seats" value={stats.totalSeats} sublabel={`${stats.occupancyRate}% occupancy`} />
        <StatCard icon={CheckCircle2} label="Available" value={stats.availableSeats} tone="success" sublabel="Ready to assign" onClick={() => setFilter('status')('available')} />
        <StatCard icon={Wrench} label="Maintenance" value={stats.maintenanceSeats} tone={stats.maintenanceSeats ? 'warning' : 'neutral'} sublabel="Out of service" onClick={() => setFilter('status')('maintenance')} />
        <StatCard icon={Ban} label="Blocked" value={stats.blockedSeats} sublabel="Not in circulation" onClick={() => setFilter('status')('blocked')} />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={(d) => navigate(`/seats/map?seat=${d.number}`)}
        pageSize={16}
        searchPlaceholder="Search by seat number…"
        searchKeys={['number', 'student']}
        exportFileName="seats.csv"
        emptyIcon={Armchair}
        emptyTitle="No seats match these filters"
        emptyDescription="Adjust the filters or add a new seat."
        filters={[
          {
            key: 'floor',
            label: 'Floor',
            value: filters.floor,
            onChange: setFilter('floor'),
            options: [{ value: 'all', label: 'All floors' }, ...floors.map((f) => ({ value: String(f.id), label: f.name }))],
          },
          {
            key: 'section',
            label: 'Section',
            value: filters.section,
            onChange: setFilter('section'),
            options: [{ value: 'all', label: 'All sections' }, ...[...new Set(floors.flatMap((f) => f.sections))].map((s) => ({ value: s, label: `Section ${s}` }))],
          },
          {
            key: 'status',
            label: 'Status',
            value: filters.status,
            onChange: setFilter('status'),
            options: [{ value: 'all', label: 'All statuses' }, ...Object.entries(SEAT_STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))],
          },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Seat
          </button>
        }
      />

      <SeatFormModal
        open={showAdd || Boolean(editing)}
        seat={editing}
        floors={floors}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        addToast={addToast}
      />
    </div>
  );
}

function SeatFormModal({ open, seat, floors, onClose, addToast }) {
  const [form, setForm] = useState({ number: '', floor: 1, section: 'A' });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [initialised, setInitialised] = useState(false);

  // Seed the form once when the modal opens.
  if (open && !initialised) {
    setForm(seat ? { number: seat.number, floor: seat.floor, section: seat.section } : { number: '', floor: 1, section: 'A' });
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
    if (!form.number.trim()) {
      setErrors({ number: 'Seat number is required' });
      return;
    }
    setPending(true);
    try {
      if (seat) {
        await seatService.updateSeat({ seatId: seat.id, ...form });
        addToast('Seat updated', 'success');
      } else {
        await seatService.createSeat(form);
        addToast('Seat added', 'success', { description: `${form.number} is now available.` });
      }
      close();
    } catch (err) {
      addToast(err.message, 'error');
      setPending(false);
    }
  };

  const sections = floors.find((f) => f.id === Number(form.floor))?.sections || ['A'];

  return (
    <Modal
      open
      onClose={close}
      title={seat ? `Edit seat ${seat.number}` : 'Add a seat'}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>{seat ? 'Save changes' : 'Add seat'}</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="seat-number">Seat number <span className="required">*</span></label>
          <input id="seat-number" className={`form-input ${errors.number ? 'error' : ''}`} value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="e.g. A-41" />
          {errors.number && <span className="form-error">{errors.number}</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="seat-floor">Floor</label>
            <select id="seat-floor" className="form-select" value={form.floor} onChange={(e) => set('floor', Number(e.target.value))}>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="seat-section">Section</label>
            <select id="seat-section" className="form-select" value={form.section} onChange={(e) => set('section', e.target.value)}>
              {sections.map((s) => (
                <option key={s} value={s}>Section {s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
