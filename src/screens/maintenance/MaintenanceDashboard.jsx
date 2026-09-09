import { useState } from 'react';
import { Plus, Wrench, AlertTriangle, Clock, CheckCircle2, Play, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, StatusBadge, ActionButton } from '../../components/ui/Primitives';
import { maintenanceService } from '../../services/operationsService';
import { formatDate, relativeDay } from '../../services/businessRules';

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

export default function MaintenanceDashboard() {
  const { maintenance, staff, addToast, confirm } = useApp();
  const [tab, setTab] = useState('open');
  const [priority, setPriority] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const { data: rows, loading, error, retry } = useAsync(
    () => maintenanceService.getIssues({ status: tab, priority }),
    [tab, priority, maintenance],
  );

  const counts = {
    open: maintenance.filter((m) => m.status === 'open').length,
    in_progress: maintenance.filter((m) => m.status === 'in_progress').length,
    resolved: maintenance.filter((m) => m.status === 'resolved').length,
    highPriority: maintenance.filter((m) => m.status !== 'resolved' && (m.priority === 'high' || m.priority === 'critical')).length,
  };

  const updateStatus = async (issue, status) => {
    if (status === 'resolved') {
      const ok = await confirm({
        title: 'Mark this issue resolved?',
        confirmLabel: 'Mark resolved',
        message: `${issue.deskNumber} — ${issue.issue}`,
        details: issue.blocksSeat ? <p className="text-sm">The seat will be returned to circulation.</p> : null,
      });
      if (!ok) return;
    }
    try {
      await maintenanceService.updateStatus({ id: issue.id, status });
      addToast(status === 'resolved' ? 'Issue resolved' : 'Issue updated', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const columns = [
    { key: 'deskNumber', header: 'Seat / Area', sortable: true, accessor: (m) => m.deskNumber, className: 'cell-mono cell-strong' },
    { key: 'issue', header: 'Issue', sortable: true, accessor: (m) => m.issue, className: 'cell-primary' },
    { key: 'priority', header: 'Priority', sortable: true, accessor: (m) => m.priority, render: (m) => <StatusBadge status={m.priority} /> },
    {
      key: 'reportedDate',
      header: 'Reported',
      sortable: true,
      accessor: (m) => m.reportedDate,
      render: (m) => (
        <div className="cell-stack">
          <span>{formatDate(m.reportedDate)}</span>
          <span className="cell-student-sub">{relativeDay(m.reportedDate)} by {m.reportedBy}</span>
        </div>
      ),
    },
    { key: 'assignedStaff', header: 'Assigned', hideBelow: 'md', sortable: true, accessor: (m) => m.assignedStaff, render: (m) => m.assignedStaff || <span className="text-muted">Unassigned</span> },
    {
      key: 'expectedResolution',
      header: 'Target',
      hideBelow: 'lg',
      sortable: true,
      accessor: (m) => m.expectedResolution,
      render: (m) => (m.status === 'resolved' ? <span className="text-success">Resolved {formatDate(m.resolvedDate)}</span> : m.expectedResolution ? formatDate(m.expectedResolution) : '—'),
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (m) => m.status, render: (m) => <StatusBadge status={m.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 180,
      render: (m) => (
        <div className="cell-actions">
          {m.status === 'open' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateStatus(m, 'in_progress')}>
              <Play size={12} /> Start
            </button>
          )}
          {m.status !== 'resolved' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => updateStatus(m, 'resolved')}>
              <Check size={12} /> Resolve
            </button>
          )}
          {m.status === 'resolved' && <span className="text-sm text-muted">Closed</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={AlertTriangle} label="Open" value={counts.open} tone={counts.open ? 'error' : 'neutral'} sublabel="Not yet started" onClick={() => setTab('open')} />
        <StatCard icon={Clock} label="In progress" value={counts.in_progress} tone={counts.in_progress ? 'warning' : 'neutral'} sublabel="Being worked on" onClick={() => setTab('in_progress')} />
        <StatCard icon={AlertTriangle} label="High priority" value={counts.highPriority} tone={counts.highPriority ? 'error' : 'neutral'} sublabel="Needs attention today" onClick={() => setPriority('high')} />
        <StatCard icon={CheckCircle2} label="Resolved" value={counts.resolved} tone="success" sublabel="Completed" onClick={() => setTab('resolved')} />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        pageSize={12}
        searchPlaceholder="Search by seat or issue…"
        searchKeys={['deskNumber', 'issue']}
        exportFileName={`maintenance-${tab}.csv`}
        emptyIcon={Wrench}
        emptyTitle={tab === 'open' ? 'No open maintenance issues' : 'No issues found'}
        emptyDescription={tab === 'open' ? 'Everything is in working order.' : 'Try a different status filter.'}
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Report an issue
          </button>
        }
        toolbarExtra={
          <div className="segmented">
            {TABS.map((t) => {
              const count = t.key === 'all' ? maintenance.length : counts[t.key];
              return (
                <button key={t.key} type="button" className={`segmented-item ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
                  {t.label}
                  {count > 0 && <span className="segmented-count">{count}</span>}
                </button>
              );
            })}
          </div>
        }
        filters={[
          {
            key: 'priority',
            label: 'Priority',
            value: priority,
            onChange: setPriority,
            options: [
              { value: 'all', label: 'All' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ],
          },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Report Issue
          </button>
        }
      />

      <ReportIssueModal open={showAdd} onClose={() => setShowAdd(false)} staff={staff} addToast={addToast} />
    </div>
  );
}

function ReportIssueModal({ open, onClose, staff, addToast }) {
  const blank = { deskNumber: '', issue: '', priority: 'medium', assignedStaff: '', blocksSeat: false };
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
    if (!form.deskNumber.trim()) errs.deskNumber = 'Seat or area is required';
    if (!form.issue.trim()) errs.issue = 'Describe the issue';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await maintenanceService.reportIssue(form);
      addToast('Issue reported', 'success', { description: `${form.deskNumber} — ${form.issue}` });
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
      title="Report a maintenance issue"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Report issue</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="mt-seat">Seat or area <span className="required">*</span></label>
            <input id="mt-seat" className={`form-input ${errors.deskNumber ? 'error' : ''}`} value={form.deskNumber} onChange={(e) => set('deskNumber', e.target.value)} placeholder="e.g. A-14 or Floor 2 — Common" />
            {errors.deskNumber && <span className="form-error">{errors.deskNumber}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mt-priority">Priority</label>
            <select id="mt-priority" className="form-select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="mt-issue">What is wrong? <span className="required">*</span></label>
          <textarea id="mt-issue" className={`form-textarea ${errors.issue ? 'error' : ''}`} rows={3} value={form.issue} onChange={(e) => set('issue', e.target.value)} placeholder="e.g. Power socket not working" />
          {errors.issue && <span className="form-error">{errors.issue}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="mt-staff">Assign to</label>
          <select id="mt-staff" className="form-select" value={form.assignedStaff} onChange={(e) => set('assignedStaff', e.target.value)}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.name}>{s.name} — {s.role}</option>
            ))}
          </select>
        </div>

        <label className="form-checkbox">
          <input type="checkbox" checked={form.blocksSeat} onChange={(e) => set('blocksSeat', e.target.checked)} />
          <span>Take this seat out of service until the issue is fixed</span>
        </label>
      </div>
    </Modal>
  );
}
