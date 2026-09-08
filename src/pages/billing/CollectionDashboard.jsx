import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, AlertTriangle, CalendarClock, IndianRupee, Phone, Bell, Eye,
  RefreshCw, StickyNote, CheckCircle2, Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, StatusBadge, DetailRow, Avatar, ActionButton } from '../../components/ui/Primitives';
import { SkeletonCards } from '../../components/ui/StateViews';
import paymentService from '../../services/paymentService';
import membershipService from '../../services/membershipService';
import studentService from '../../services/studentService';
import { formatDate, formatCurrency, relativeDay } from '../../services/businessRules';

const FILTERS = [
  { key: 'dueToday', label: 'Today' },
  { key: 'dueTomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'expiringSoon', label: 'Expiring Soon' },
  { key: 'all', label: 'All' },
];

/**
 * The screen the front desk opens every morning: who owes money
 * today, who is late, and whose membership runs out this week.
 */
export default function CollectionDashboard() {
  const { students, payments, addToast, confirm, membershipPlans } = useApp();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('dueToday');
  const [action, setAction] = useState(null); // { type, row }

  const { data: queue, loading, error, retry } = useAsync(() => paymentService.getCollectionQueue(), [students, payments]);

  const rows = queue ? queue[filter] || [] : [];
  const totals = queue?.totals;

  const collectedToday = useMemo(() => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return payments.filter((p) => p.date === iso && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const isExpiryView = filter === 'expiringSoon';

  const columns = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      accessor: (r) => r.name,
      render: (r) => (
        <div className="cell-student">
          <Avatar name={r.name} size={28} />
          <div className="cell-student-info">
            <span className="cell-student-name">{r.name}</span>
            <span className="cell-student-sub">
              {r.studentIdNum} · {r.deskNumber || 'No seat'} · {r.slotName}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'lg',
      accessor: (r) => r.phone,
      render: (r) => (
        <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="phone-link" onClick={(e) => e.stopPropagation()}>
          <Phone size={12} /> {r.phone}
        </a>
      ),
    },
    {
      key: 'membershipPlan',
      header: 'Membership',
      hideBelow: 'md',
      sortable: true,
      accessor: (r) => r.membershipPlan,
      render: (r) => (
        <div className="cell-stack">
          <span>{r.membershipPlan}</span>
          <span className="cell-student-sub">{formatCurrency(r.planPrice)}</span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      accessor: (r) => r.amount,
      render: (r) => (r.amount > 0 ? <span className="cell-num cell-strong">{formatCurrency(r.amount)}</span> : <span className="text-muted">—</span>),
    },
    {
      key: 'dueDate',
      header: isExpiryView ? 'Expires' : 'Due Date',
      sortable: true,
      accessor: (r) => (isExpiryView ? r.membershipExpiry : r.dueDate),
      render: (r) => {
        const date = isExpiryView ? r.membershipExpiry : r.dueDate;
        const days = isExpiryView ? r.daysToExpiry : r.daysUntilDue;
        return (
          <div className="cell-stack">
            <span>{formatDate(date)}</span>
            <span className={`cell-student-sub ${days < 0 ? 'text-error' : days === 0 ? 'text-warning' : ''}`}>{relativeDay(date)}</span>
          </div>
        );
      },
    },
    {
      key: 'daysOverdue',
      header: 'Overdue',
      align: 'right',
      sortable: true,
      hideBelow: 'md',
      accessor: (r) => r.daysOverdue,
      render: (r) =>
        r.daysOverdue > 0 ? (
          <span className="badge badge-error">
            {r.daysOverdue} day{r.daysOverdue === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'lastPaymentDate',
      header: 'Last Payment',
      hideBelow: 'lg',
      sortable: true,
      accessor: (r) => r.lastPaymentDate,
      render: (r) =>
        r.lastPaymentDate ? (
          <div className="cell-stack">
            <span>{formatCurrency(r.lastPaymentAmount)}</span>
            <span className="cell-student-sub">{formatDate(r.lastPaymentDate)}</span>
          </div>
        ) : (
          <span className="text-muted">Never</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (r) => (isExpiryView ? r.membershipStatus : r.paymentStatus),
      render: (r) => <StatusBadge status={isExpiryView ? r.membershipStatus : r.paymentStatus} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 230,
      render: (r) => (
        <div className="cell-actions">
          {r.amount > 0 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAction({ type: 'payment', row: r })}>
              <IndianRupee size={12} /> Record
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAction({ type: 'renew', row: r })} title="Renew membership">
            <RefreshCw size={12} /> Renew
          </button>
          <button type="button" className="icon-btn" onClick={() => setAction({ type: 'reminder', row: r })} title="Send reminder">
            <Bell size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setAction({ type: 'note', row: r })} title="Add note">
            <StickyNote size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={() => navigate(`/students/${r.studentId}`)} title="View student">
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  const sendAllReminders = async () => {
    const overdue = queue?.overdue || [];
    if (!overdue.length) return;
    const ok = await confirm({
      title: `Send ${overdue.length} payment reminders?`,
      confirmLabel: 'Send reminders',
      message: `A payment reminder will be queued for every student with an overdue balance, totalling ${formatCurrency(totals.overdue)}.`,
    });
    if (!ok) return;
    try {
      const result = await paymentService.sendBulkReminders({ studentIds: overdue.map((r) => r.studentId) });
      addToast(`${result.count} reminders queued`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div className="page-stack">
      {loading && !queue ? (
        <SkeletonCards count={4} />
      ) : (
        <StatGrid>
          <StatCard
            icon={CalendarClock}
            label="Due today"
            value={queue?.dueToday.length || 0}
            sublabel={formatCurrency(totals?.dueToday || 0)}
            tone={queue?.dueToday.length ? 'warning' : 'neutral'}
            onClick={() => setFilter('dueToday')}
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue"
            value={queue?.overdue.length || 0}
            sublabel={formatCurrency(totals?.overdue || 0)}
            tone={queue?.overdue.length ? 'error' : 'neutral'}
            onClick={() => setFilter('overdue')}
          />
          <StatCard
            icon={RefreshCw}
            label="Expiring in 7 days"
            value={queue?.expiringSoon.length || 0}
            sublabel="Memberships to renew"
            tone="primary"
            onClick={() => setFilter('expiringSoon')}
          />
          <StatCard icon={CheckCircle2} label="Collected today" value={formatCurrency(collectedToday)} sublabel="Across all methods" tone="success" onClick={() => navigate('/billing/payments')} />
          <StatCard icon={Wallet} label="Total outstanding" value={formatCurrency(totals?.all || 0)} sublabel={`${queue?.all.length || 0} students`} onClick={() => setFilter('all')} />
        </StatGrid>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={retry}
        pageSize={12}
        searchPlaceholder="Search by name, ID or phone…"
        searchKeys={['name', 'phone', 'membershipPlan']}
        exportFileName={`fee-collection-${filter}.csv`}
        emptyIcon={CheckCircle2}
        emptyTitle={
          filter === 'overdue'
            ? 'No overdue payments'
            : filter === 'dueToday'
              ? 'Nothing due today'
              : filter === 'expiringSoon'
                ? 'No memberships expiring this week'
                : 'Nothing to collect'
        }
        emptyDescription={
          filter === 'overdue'
            ? 'Every student is up to date on their fees.'
            : 'Switch to another period to see what is coming up.'
        }
        footerNote={rows.length ? `${formatCurrency(rows.reduce((s, r) => s + r.amount, 0))} in this view` : undefined}
        toolbarExtra={
          <div className="segmented">
            {FILTERS.map((f) => {
              const count = queue ? (queue[f.key] || []).length : 0;
              return (
                <button key={f.key} type="button" className={`segmented-item ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                  {count > 0 && <span className="segmented-count">{count}</span>}
                </button>
              );
            })}
          </div>
        }
        actions={
          (queue?.overdue.length || 0) > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={sendAllReminders}>
              <Send size={14} /> Remind all overdue
            </button>
          )
        }
      />

      <ActionModals action={action} onClose={() => setAction(null)} addToast={addToast} membershipPlans={membershipPlans} />
    </div>
  );
}

// ============================================================
// Row actions: record payment / renew / reminder / note
// ============================================================
function ActionModals({ action, onClose, addToast, membershipPlans }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [planId, setPlanId] = useState('');
  const [collectNow, setCollectNow] = useState(true);
  const [note, setNote] = useState('');
  const [channel, setChannel] = useState('SMS');
  const [pending, setPending] = useState(false);

  const row = action?.row;

  const close = () => {
    setAmount('');
    setMethod('UPI');
    setPlanId('');
    setCollectNow(true);
    setNote('');
    setPending(false);
    onClose();
  };

  if (!action || !row) return null;

  // ── Record payment ───────────────────────────────────────
  if (action.type === 'payment') {
    const value = amount === '' ? row.amount : Number(amount);
    const remaining = Math.max(0, row.amount - value);

    const submit = async () => {
      setPending(true);
      try {
        const payment = await paymentService.recordPayment({ studentId: row.studentId, amount: value, method });
        addToast('Payment recorded', 'success', {
          description: `${formatCurrency(value)} from ${row.name} · Receipt ${payment.receiptNumber}`,
        });
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
        description={`${row.name} · ${row.studentIdNum}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit} disabled={!value || value <= 0}>
              Record {formatCurrency(value || 0)}
            </ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="summary-panel">
            <DetailRow label="Outstanding" value={<strong className="text-error">{formatCurrency(row.amount)}</strong>} />
            <DetailRow label="Membership" value={row.membershipPlan} />
            <DetailRow label="Due date" value={`${formatDate(row.dueDate)} · ${relativeDay(row.dueDate)}`} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="pay-amount">Amount (₹)</label>
              <input
                id="pay-amount"
                type="number"
                className="form-input"
                value={amount}
                placeholder={String(row.amount)}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              <span className="form-hint">Leave blank to collect the full outstanding amount.</span>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pay-method">Method</label>
              <select id="pay-method" className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>
            </div>
          </div>

          {remaining > 0 && value > 0 && (
            <div className="callout callout-warning">
              <AlertTriangle size={15} className="callout-icon" />
              <div>
                This is a part payment. <strong>{formatCurrency(remaining)}</strong> will remain outstanding.
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // ── Renew membership ─────────────────────────────────────
  if (action.type === 'renew') {
    const selectedPlan = membershipPlans.find((p) => p.id === (planId || row.membershipPlanId));

    const submit = async () => {
      setPending(true);
      try {
        const result = await membershipService.renewMembership({
          studentId: row.studentId,
          planId: planId || row.membershipPlanId,
          collectPayment: collectNow,
          method,
        });
        addToast('Membership renewed', 'success', {
          description: `${row.name} · ${result.plan} until ${formatDate(result.newExpiry)}`,
        });
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
        description={`${row.name} · expires ${formatDate(row.membershipExpiry)}`}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit}>Renew membership</ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="renew-plan">Plan</label>
            <select id="renew-plan" className="form-select" value={planId || row.membershipPlanId} onChange={(e) => setPlanId(e.target.value)}>
              {membershipPlans.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price)} / {p.duration} {p.durationUnit}
                </option>
              ))}
            </select>
          </div>

          <label className="form-checkbox">
            <input type="checkbox" checked={collectNow} onChange={(e) => setCollectNow(e.target.checked)} />
            <span>Collect {formatCurrency(selectedPlan?.price || 0)} now</span>
          </label>

          {collectNow && (
            <div className="form-group">
              <label className="form-label" htmlFor="renew-method">Payment method</label>
              <select id="renew-method" className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>
            </div>
          )}

          <div className="callout callout-info">
            <RefreshCw size={15} className="callout-icon" />
            <div>
              {row.daysToExpiry >= 0
                ? `The new period starts the day after ${formatDate(row.membershipExpiry)}, so no days are lost.`
                : 'The membership has lapsed, so the new period starts today.'}
              {!collectNow && ' The fee will be added to their outstanding balance.'}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Send reminder ────────────────────────────────────────
  if (action.type === 'reminder') {
    const submit = async () => {
      setPending(true);
      try {
        await paymentService.sendReminder({ studentId: row.studentId, channel });
        addToast('Reminder queued', 'success', { description: `${channel} to ${row.name} at ${row.phone}` });
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
        title="Send payment reminder"
        description={`${row.name} · ${row.phone}`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <ActionButton pending={pending} onClick={submit}>
              <Send size={14} /> Send reminder
            </ActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="summary-panel">
            <DetailRow label="Amount due" value={<strong>{formatCurrency(row.amount)}</strong>} />
            <DetailRow label="Due date" value={formatDate(row.dueDate)} />
            {row.reminderSentOn && <DetailRow label="Last reminder" value={formatDate(row.reminderSentOn)} />}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reminder-channel">Channel</label>
            <select id="reminder-channel" className="form-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option>SMS</option>
              <option>WhatsApp</option>
              <option>Call</option>
            </select>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Add note ─────────────────────────────────────────────
  const submitNote = async () => {
    setPending(true);
    try {
      await studentService.addNote({ studentId: row.studentId, text: note });
      addToast('Note added', 'success', { description: `Saved to ${row.name}'s profile.` });
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
      title="Add a note"
      description={`${row.name} · ${row.studentIdNum}`}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submitNote} disabled={!note.trim()}>Save note</ActionButton>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label" htmlFor="collection-note">Note</label>
        <textarea
          id="collection-note"
          className="form-textarea"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Said he will pay on Friday after his salary"
          autoFocus
        />
      </div>
    </Modal>
  );
}
