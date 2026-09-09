import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Printer, CreditCard, IndianRupee, TrendingUp, Eye, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, Drawer, StatusBadge, DetailRow, Avatar, ActionButton } from '../../components/ui/Primitives';
import paymentService from '../../services/paymentService';
import { formatCurrency, formatDate, todayISO } from '../../services/businessRules';

export default function Payments() {
  const { payments, students, stats, addToast, paymentMethods } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({ method: 'all', status: 'all' });
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(() => {
    const id = searchParams.get('payment');
    return id ? payments.find((p) => p.id === id) || null : null;
  });

  const { data: rows, loading, error, retry } = useAsync(() => paymentService.getPayments(filters), [filters, payments]);

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  const columns = [
    { key: 'receiptNumber', header: 'Receipt', sortable: true, accessor: (p) => p.receiptNumber, className: 'cell-mono cell-primary' },
    {
      key: 'studentName',
      header: 'Student',
      sortable: true,
      accessor: (p) => p.studentName,
      render: (p) => (
        <div className="cell-student">
          <Avatar name={p.studentName} size={26} />
          <div className="cell-student-info">
            <span className="cell-student-name">{p.studentName}</span>
            <span className="cell-student-sub">{p.studentIdNum}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      accessor: (p) => p.amount,
      render: (p) => <span className="cell-num cell-strong">{formatCurrency(p.amount)}</span>,
    },
    { key: 'method', header: 'Method', sortable: true, accessor: (p) => p.method, render: (p) => <span className="badge badge-gray">{p.method}</span> },
    { key: 'date', header: 'Date', sortable: true, accessor: (p) => p.date, render: (p) => formatDate(p.date) },
    { key: 'membershipPlan', header: 'Plan', hideBelow: 'md', sortable: true, accessor: (p) => p.membershipPlan },
    { key: 'collectedBy', header: 'Collected by', hideBelow: 'lg', accessor: (p) => p.collectedBy },
    { key: 'status', header: 'Status', accessor: (p) => p.status, render: (p) => <StatusBadge status={p.status === 'completed' ? 'paid' : 'pending'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 60,
      render: (p) => (
        <div className="cell-actions">
          <button type="button" className="icon-btn" title="View details" onClick={() => setSelected(p)}>
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={IndianRupee} label="Collected today" value={formatCurrency(stats.todayCollection)} tone="success" sublabel={`${payments.filter((p) => p.date === todayISO()).length} payments`} />
        <StatCard icon={TrendingUp} label="This month" value={formatCurrency(stats.monthlyRevenue)} sublabel="Total revenue" />
        <StatCard icon={CreditCard} label="Outstanding" value={formatCurrency(stats.totalOutstanding)} tone={stats.totalOutstanding ? 'warning' : 'neutral'} sublabel={`${stats.overdueCount} overdue`} onClick={() => navigate('/billing/collection')} />
        <StatCard icon={CreditCard} label="Payments recorded" value={payments.length} sublabel="All time" />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={setSelected}
        selectedRowId={selected?.id}
        pageSize={14}
        searchPlaceholder="Search by student, receipt or transaction ID…"
        searchKeys={['studentName', 'receiptNumber']}
        exportFileName="payments.csv"
        emptyIcon={CreditCard}
        emptyTitle="No payments found"
        emptyDescription="Payments recorded at the front desk appear here."
        filters={[
          {
            key: 'method',
            label: 'Method',
            value: filters.method,
            onChange: setFilter('method'),
            options: [{ value: 'all', label: 'All' }, ...paymentMethods.map((m) => ({ value: m, label: m }))],
          },
          {
            key: 'status',
            label: 'Status',
            value: filters.status,
            onChange: setFilter('status'),
            options: [
              { value: 'all', label: 'All' },
              { value: 'completed', label: 'Completed' },
              { value: 'pending', label: 'Pending' },
            ],
          },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Record Payment
          </button>
        }
      />

      <PaymentDrawer payment={selected} onClose={() => setSelected(null)} navigate={navigate} addToast={addToast} />
      <RecordPaymentModal open={showAdd} onClose={() => setShowAdd(false)} students={students} addToast={addToast} paymentMethods={paymentMethods} />
    </div>
  );
}

// ============================================================
// Payment detail drawer
// ============================================================
function PaymentDrawer({ payment, onClose, navigate, addToast }) {
  if (!payment) return null;

  return (
    <Drawer
      open
      onClose={onClose}
      title="Payment details"
      subtitle={payment.receiptNumber}
      width={400}
      footer={
        <>
          <button type="button" className="btn btn-secondary flex-1" onClick={() => { onClose(); navigate(`/students/${payment.studentId}`); }}>
            <Eye size={14} /> View student
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => {
              addToast('Opening print dialog', 'info', { description: 'Choose “Save as PDF” to keep a copy.' });
              setTimeout(() => window.print(), 300);
            }}
          >
            <Printer size={14} /> Print receipt
          </button>
        </>
      }
    >
      <div className="payment-hero">
        <span className="payment-hero-amount">{formatCurrency(payment.amount)}</span>
        <StatusBadge status={payment.status === 'completed' ? 'paid' : 'pending'} />
      </div>

      <div className="drawer-block">
        <DetailRow label="Student" value={payment.studentName} strong />
        <DetailRow label="Student ID" value={payment.studentIdNum} />
        <DetailRow label="Method" value={payment.method} />
        <DetailRow label="Date" value={formatDate(payment.date)} />
        <DetailRow label="Membership" value={payment.membershipPlan} />
        {payment.periodEnd && <DetailRow label="Period" value={`${formatDate(payment.periodStart)} → ${formatDate(payment.periodEnd)}`} />}
        <DetailRow label="Transaction ID" value={payment.transactionId} />
        <DetailRow label="Receipt" value={payment.receiptNumber} />
        <DetailRow label="Invoice" value={payment.invoiceNumber} />
        <DetailRow label="Collected by" value={payment.collectedBy} />
        <DetailRow label="Type" value={payment.type === 'locker' ? 'Locker rent' : 'Membership fee'} />
      </div>

      {payment.notes && (
        <div className="drawer-block">
          <span className="uppercase-label">Notes</span>
          <p className="drawer-quote">{payment.notes}</p>
        </div>
      )}

      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onClose(); navigate('/billing/invoices'); }}>
        View all invoices <ArrowRight size={13} />
      </button>
    </Drawer>
  );
}

// ============================================================
// Record payment
// ============================================================
function RecordPaymentModal({ open, onClose, students, addToast, paymentMethods }) {
  const blank = { studentId: '', amount: '', method: 'UPI', transactionId: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const student = students.find((s) => s.id === form.studentId);

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
    if (!form.studentId) errs.studentId = 'Select a student';
    const amount = Number(form.amount);
    if (!amount || amount <= 0) errs.amount = 'Enter a valid amount';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      const payment = await paymentService.recordPayment({ ...form, amount });
      addToast('Payment recorded', 'success', { description: `${formatCurrency(amount)} from ${payment.studentName} · ${payment.receiptNumber}` });
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
      title="Record payment"
      description="Enter a payment collected at the front desk."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Save payment</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-group">
          <label className="form-label" htmlFor="rp-student">Student <span className="required">*</span></label>
          <select id="rp-student" className={`form-select ${errors.studentId ? 'error' : ''}`} value={form.studentId} onChange={(e) => set('studentId', e.target.value)}>
            <option value="">Select a student…</option>
            {[...students].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.studentId}){s.outstanding > 0 ? ` — ${formatCurrency(s.outstanding)} due` : ''}
              </option>
            ))}
          </select>
          {errors.studentId && <span className="form-error">{errors.studentId}</span>}
        </div>

        {student && (
          <div className="summary-panel">
            <DetailRow label="Outstanding" value={<strong className={student.outstanding > 0 ? 'text-error' : ''}>{formatCurrency(student.outstanding)}</strong>} />
            <DetailRow label="Membership" value={`${student.membershipPlan} · expires ${formatDate(student.membershipExpiry)}`} />
            {student.outstanding > 0 && (
              <button type="button" className="link-button mt-2" onClick={() => set('amount', String(student.outstanding))}>
                Use full outstanding amount
              </button>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="rp-amount">Amount (₹) <span className="required">*</span></label>
            <input id="rp-amount" type="number" className={`form-input ${errors.amount ? 'error' : ''}`} value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0" />
            {errors.amount && <span className="form-error">{errors.amount}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="rp-method">Method</label>
            <select id="rp-method" className="form-select" value={form.method} onChange={(e) => set('method', e.target.value)}>
              {paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="rp-txn">Transaction ID</label>
          <input id="rp-txn" className="form-input" value={form.transactionId} onChange={(e) => set('transactionId', e.target.value)} placeholder="Optional — generated if left blank" />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="rp-notes">Notes</label>
          <textarea id="rp-notes" className="form-textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
