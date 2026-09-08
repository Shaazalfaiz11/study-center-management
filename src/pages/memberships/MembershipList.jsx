import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, RefreshCw, Eye, AlertTriangle, PauseCircle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, StatusBadge, DetailRow, Avatar, ActionButton, ProgressBar } from '../../components/ui/Primitives';
import membershipService from '../../services/membershipService';
import { formatCurrency, formatDate, relativeDay, daysUntil } from '../../services/businessRules';

const TITLES = {
  active: { empty: 'No active memberships', description: 'Memberships appear here once students are registered.' },
  expiring: { empty: 'Nothing expiring in the next 7 days', description: 'All memberships have comfortable time left.' },
  expired: { empty: 'No expired memberships', description: 'Everyone is up to date.' },
};

export default function MembershipList({ filter }) {
  const { students, membershipPlans, addToast } = useApp();
  const navigate = useNavigate();

  const [status, setStatus] = useState(filter || 'all');
  const [planId, setPlanId] = useState('all');
  const [renewing, setRenewing] = useState(null);

  // Route-level filter wins when the page is opened from the sidebar.
  const effectiveStatus = filter || status;

  const { data: rows, loading, error, retry } = useAsync(
    () => membershipService.getMemberships({ status: effectiveStatus, planId }),
    [effectiveStatus, planId, students],
  );

  const summary = useMemo(() => {
    const count = (s) => students.filter((st) => st.membershipStatus === s).length;
    return {
      active: count('active'),
      expiring: count('expiring'),
      expired: count('expired'),
      paused: count('paused'),
    };
  }, [students]);

  const columns = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      accessor: (s) => s.name,
      render: (s) => (
        <div className="cell-student">
          <Avatar name={s.name} size={28} />
          <div className="cell-student-info">
            <span className="cell-student-name">{s.name}</span>
            <span className="cell-student-sub">{s.studentId} · {s.deskNumber || 'No seat'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'membershipPlan',
      header: 'Plan',
      sortable: true,
      accessor: (s) => s.membershipPlan,
      render: (s) => (
        <div className="cell-stack">
          <span>{s.membershipPlan}</span>
          <span className="cell-student-sub">{formatCurrency(s.planPrice)}</span>
        </div>
      ),
    },
    { key: 'membershipStart', header: 'Start', hideBelow: 'lg', sortable: true, accessor: (s) => s.membershipStart, render: (s) => formatDate(s.membershipStart) },
    {
      key: 'membershipExpiry',
      header: 'Expiry',
      sortable: true,
      accessor: (s) => s.membershipExpiry,
      render: (s) => {
        const days = daysUntil(s.membershipExpiry);
        return (
          <div className="cell-stack">
            <span>{formatDate(s.membershipExpiry)}</span>
            <span className={`cell-student-sub ${days < 0 ? 'text-error' : days <= 7 ? 'text-warning' : ''}`}>{relativeDay(s.membershipExpiry)}</span>
          </div>
        );
      },
    },
    {
      key: 'progress',
      header: 'Period used',
      hideBelow: 'md',
      width: 130,
      accessor: (s) => s.membershipExpiry,
      render: (s) => {
        const plan = membershipPlans.find((p) => p.id === s.membershipPlanId);
        const total = plan?.durationDays || 30;
        const left = daysUntil(s.membershipExpiry);
        const pct = Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100)));
        return <ProgressBar value={pct} tone={left < 0 ? 'error' : left <= 7 ? 'warning' : 'success'} />;
      },
    },
    { key: 'membershipStatus', header: 'Status', sortable: true, accessor: (s) => s.membershipStatus, render: (s) => <StatusBadge status={s.membershipStatus} /> },
    { key: 'paymentStatus', header: 'Payment', sortable: true, accessor: (s) => s.paymentStatus, render: (s) => <StatusBadge status={s.paymentStatus} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 130,
      render: (s) => (
        <div className="cell-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRenewing(s)}>
            <RefreshCw size={12} /> Renew
          </button>
          <button type="button" className="icon-btn" title="View profile" onClick={() => navigate(`/students/${s.id}`)}>
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  const meta = TITLES[effectiveStatus] || { empty: 'No memberships found', description: 'Try a different filter.' };

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={CheckCircle2} label="Active" value={summary.active} tone="success" sublabel="In date" onClick={() => navigate('/memberships/active')} />
        <StatCard icon={AlertTriangle} label="Expiring soon" value={summary.expiring} tone={summary.expiring ? 'warning' : 'neutral'} sublabel="Within 7 days" onClick={() => navigate('/memberships/expiring')} />
        <StatCard icon={AlertTriangle} label="Expired" value={summary.expired} tone={summary.expired ? 'error' : 'neutral'} sublabel="Need renewal" onClick={() => navigate('/memberships/expired')} />
        <StatCard icon={PauseCircle} label="Paused" value={summary.paused} sublabel="On leave" onClick={() => navigate('/memberships/leave')} />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={(s) => navigate(`/students/${s.id}`)}
        pageSize={14}
        searchPlaceholder="Search by student name or ID…"
        searchKeys={['name', 'membershipPlan']}
        exportFileName={`memberships-${effectiveStatus}.csv`}
        emptyIcon={BadgeCheck}
        emptyTitle={meta.empty}
        emptyDescription={meta.description}
        filters={[
          ...(filter
            ? []
            : [
                {
                  key: 'status',
                  label: 'Status',
                  value: status,
                  onChange: setStatus,
                  options: [
                    { value: 'all', label: 'All' },
                    { value: 'active', label: 'Active' },
                    { value: 'expiring', label: 'Expiring' },
                    { value: 'expired', label: 'Expired' },
                    { value: 'paused', label: 'Paused' },
                  ],
                },
              ]),
          {
            key: 'plan',
            label: 'Plan',
            value: planId,
            onChange: setPlanId,
            options: [{ value: 'all', label: 'All plans' }, ...membershipPlans.map((p) => ({ value: p.id, label: p.name }))],
          },
        ]}
        actions={
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/memberships/plans')}>
            Manage plans
          </button>
        }
      />

      <RenewModal student={renewing} onClose={() => setRenewing(null)} membershipPlans={membershipPlans} addToast={addToast} />
    </div>
  );
}

function RenewModal({ student, onClose, membershipPlans, addToast }) {
  const [planId, setPlanId] = useState('');
  const [collectPayment, setCollectPayment] = useState(true);
  const [method, setMethod] = useState('UPI');
  const [pending, setPending] = useState(false);

  if (!student) return null;

  const selectedPlanId = planId || student.membershipPlanId;
  const plan = membershipPlans.find((p) => p.id === selectedPlanId);

  const close = () => {
    setPlanId('');
    setPending(false);
    onClose();
  };

  const submit = async () => {
    setPending(true);
    try {
      const result = await membershipService.renewMembership({ studentId: student.id, planId: selectedPlanId, collectPayment, method });
      addToast('Membership renewed', 'success', { description: `${student.name} · ${result.plan} until ${formatDate(result.newExpiry)}` });
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
      description={`${student.name} · ${student.studentId}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Renew</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="summary-panel">
          <DetailRow label="Current plan" value={student.membershipPlan} />
          <DetailRow label="Expires" value={`${formatDate(student.membershipExpiry)} · ${relativeDay(student.membershipExpiry)}`} />
          <DetailRow label="Outstanding" value={student.outstanding > 0 ? <strong className="text-error">{formatCurrency(student.outstanding)}</strong> : formatCurrency(0)} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ml-plan">Renew with</label>
          <select id="ml-plan" className="form-select" value={selectedPlanId} onChange={(e) => setPlanId(e.target.value)}>
            {membershipPlans.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} / {p.duration} {p.durationUnit}</option>
            ))}
          </select>
        </div>

        <label className="form-checkbox">
          <input type="checkbox" checked={collectPayment} onChange={(e) => setCollectPayment(e.target.checked)} />
          <span>Collect {formatCurrency(plan?.price || 0)} now</span>
        </label>

        {collectPayment && (
          <div className="form-group">
            <label className="form-label" htmlFor="ml-method">Payment method</label>
            <select id="ml-method" className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option>
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
