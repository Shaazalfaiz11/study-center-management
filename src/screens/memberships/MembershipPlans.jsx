import { useState, useMemo } from 'react';
import { Plus, Edit2, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DataTable from '../../components/ui/DataTable';
import { Modal, StatusBadge, ActionButton } from '../../components/ui/Primitives';
import membershipService from '../../services/membershipService';
import { formatCurrency } from '../../services/businessRules';

export default function MembershipPlans() {
  const { membershipPlans, students, addToast, confirm } = useApp();
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const usage = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      map[s.membershipPlanId] = (map[s.membershipPlanId] || 0) + 1;
    });
    return map;
  }, [students]);

  const toggle = async (plan) => {
    const inUse = usage[plan.id] || 0;
    const ok = await confirm({
      title: plan.active ? `Deactivate ${plan.name}?` : `Activate ${plan.name}?`,
      tone: plan.active ? 'warning' : 'default',
      confirmLabel: plan.active ? 'Deactivate plan' : 'Activate plan',
      message: plan.active
        ? `New students will not be able to choose this plan.${inUse ? ` ${inUse} existing student${inUse === 1 ? '' : 's'} keep it until renewal.` : ''}`
        : 'This plan becomes selectable for new admissions and renewals.',
    });
    if (!ok) return;
    try {
      await membershipService.togglePlan({ id: plan.id });
      addToast(`${plan.name} ${plan.active ? 'deactivated' : 'activated'}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Plan',
      sortable: true,
      accessor: (p) => p.name,
      render: (p) => (
        <div className="cell-stack">
          <span className="cell-strong">{p.name}</span>
          <span className="cell-student-sub">{p.description}</span>
        </div>
      ),
    },
    { key: 'duration', header: 'Duration', sortable: true, accessor: (p) => p.durationDays, render: (p) => `${p.duration} ${p.durationUnit}` },
    { key: 'price', header: 'Price', align: 'right', sortable: true, accessor: (p) => p.price, render: (p) => <span className="cell-num cell-strong">{formatCurrency(p.price)}</span> },
    {
      key: 'perDay',
      header: 'Per day',
      align: 'right',
      hideBelow: 'md',
      accessor: (p) => Math.round(p.price / p.durationDays),
      render: (p) => <span className="cell-num text-muted">{formatCurrency(Math.round(p.price / p.durationDays))}</span>,
    },
    {
      key: 'usage',
      header: 'Students',
      align: 'right',
      sortable: true,
      accessor: (p) => usage[p.id] || 0,
      render: (p) => (
        <span className="cell-num">
          <Users size={12} style={{ verticalAlign: '-1px', marginRight: 4, opacity: 0.5 }} />
          {usage[p.id] || 0}
        </span>
      ),
    },
    { key: 'active', header: 'Status', sortable: true, accessor: (p) => (p.active ? 'active' : 'inactive'), render: (p) => <StatusBadge status={p.active ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 90,
      render: (p) => (
        <div className="cell-actions">
          <button type="button" className="icon-btn" title="Edit plan" onClick={() => setEditing(p)}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="icon-btn" title={p.active ? 'Deactivate' : 'Activate'} onClick={() => toggle(p)}>
            {p.active ? <ToggleRight size={17} className="text-success" /> : <ToggleLeft size={17} className="text-muted" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <DataTable
        columns={columns}
        rows={membershipPlans}
        pageSize={12}
        searchPlaceholder="Search plans…"
        searchKeys={['name']}
        exportFileName="membership-plans.csv"
        emptyTitle="No plans configured"
        emptyDescription="Create at least one plan so students can be admitted."
        rowClassName={(p) => (p.active ? '' : 'row-inactive')}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Create Plan
          </button>
        }
      />

      <PlanFormModal
        open={showAdd || Boolean(editing)}
        plan={editing}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        addToast={addToast}
      />
    </div>
  );
}

function PlanFormModal({ open, plan, onClose, addToast }) {
  const [form, setForm] = useState({ name: '', duration: 1, durationUnit: 'month', price: '', description: '' });
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [initialised, setInitialised] = useState(false);

  if (open && !initialised) {
    setForm(
      plan
        ? { name: plan.name, duration: plan.duration, durationUnit: plan.durationUnit, price: plan.price, description: plan.description || '' }
        : { name: '', duration: 1, durationUnit: 'month', price: '', description: '' },
    );
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
    if (!form.name.trim()) errs.name = 'Plan name is required';
    if (!Number(form.price) || Number(form.price) <= 0) errs.price = 'Enter a valid price';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await membershipService.savePlan({ id: plan?.id, ...form });
      addToast(plan ? 'Plan updated' : 'Plan created', 'success');
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
      title={plan ? `Edit ${plan.name}` : 'Create a plan'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>{plan ? 'Save changes' : 'Create plan'}</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="pl-name">Plan name <span className="required">*</span></label>
          <input id="pl-name" className={`form-input ${errors.name ? 'error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Premium Monthly" />
          {errors.name && <span className="form-error">{errors.name}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pl-duration">Duration</label>
            <input id="pl-duration" type="number" className="form-input" value={form.duration} onChange={(e) => set('duration', Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pl-unit">Unit</label>
            <select id="pl-unit" className="form-select" value={form.durationUnit} onChange={(e) => set('durationUnit', e.target.value)}>
              <option value="day">Day</option>
              <option value="days">Days</option>
              <option value="month">Month</option>
              <option value="months">Months</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pl-price">Price (₹) <span className="required">*</span></label>
            <input id="pl-price" type="number" className={`form-input ${errors.price ? 'error' : ''}`} value={form.price} onChange={(e) => set('price', e.target.value)} />
            {errors.price && <span className="form-error">{errors.price}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="pl-desc">Description</label>
          <input id="pl-desc" className="form-input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What the student gets — seat type, locker, etc." />
        </div>
      </div>
    </Modal>
  );
}
