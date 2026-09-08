import { useNavigate } from 'react-router-dom';
import { AlertCircle, Wallet, CheckCircle2, Eye, ArrowRight, Phone } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { StatusBadge, Avatar } from '../../components/ui/Primitives';
import paymentService from '../../services/paymentService';
import { formatCurrency, formatDate, relativeDay } from '../../services/businessRules';

export default function OutstandingPayments() {
  const { students, payments, stats } = useApp();
  const navigate = useNavigate();

  const { data: rows, loading, error, retry } = useAsync(() => paymentService.getOutstandingPayments(), [students, payments]);

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
            <span className="cell-student-sub">{r.studentIdNum} · {r.deskNumber || 'No seat'}</span>
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
      key: 'amount',
      header: 'Amount Due',
      align: 'right',
      sortable: true,
      accessor: (r) => r.amount,
      render: (r) => <span className="cell-num cell-strong text-error">{formatCurrency(r.amount)}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      accessor: (r) => r.dueDate,
      render: (r) => (
        <div className="cell-stack">
          <span>{formatDate(r.dueDate)}</span>
          <span className={`cell-student-sub ${r.daysUntilDue < 0 ? 'text-error' : ''}`}>{relativeDay(r.dueDate)}</span>
        </div>
      ),
    },
    { key: 'membershipPlan', header: 'Membership', hideBelow: 'md', sortable: true, accessor: (r) => r.membershipPlan },
    {
      key: 'daysOverdue',
      header: 'Overdue',
      align: 'right',
      sortable: true,
      accessor: (r) => r.daysOverdue,
      render: (r) => (r.daysOverdue > 0 ? <span className="badge badge-error">{r.daysOverdue} days</span> : <span className="text-muted">—</span>),
    },
    {
      key: 'lastPaymentDate',
      header: 'Last Payment',
      hideBelow: 'lg',
      sortable: true,
      accessor: (r) => r.lastPaymentDate,
      render: (r) => (r.lastPaymentDate ? formatDate(r.lastPaymentDate) : <span className="text-muted">Never</span>),
    },
    { key: 'paymentStatus', header: 'Status', sortable: true, accessor: (r) => r.paymentStatus, render: (r) => <StatusBadge status={r.paymentStatus} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 120,
      render: (r) => (
        <div className="cell-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/billing/collection')}>
            Collect
          </button>
          <button type="button" className="icon-btn" title="View student" onClick={() => navigate(`/students/${r.studentId}`)}>
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  const total = (rows || []).reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={Wallet} label="Total outstanding" value={formatCurrency(total)} tone={total ? 'warning' : 'success'} sublabel={`${(rows || []).length} students`} />
        <StatCard icon={AlertCircle} label="Overdue" value={stats.overdueCount} tone={stats.overdueCount ? 'error' : 'neutral'} sublabel="Past the due date" />
        <StatCard icon={AlertCircle} label="Due today" value={stats.dueTodayCount} tone={stats.dueTodayCount ? 'warning' : 'neutral'} sublabel="Collect before closing" />
        <StatCard icon={CheckCircle2} label="Collected today" value={formatCurrency(stats.todayCollection)} tone="success" sublabel="Across all methods" />
      </StatGrid>

      <div className="callout callout-info">
        <ArrowRight size={15} className="callout-icon" />
        <div>
          For the day-to-day chase list with reminders and one-click collection, use{' '}
          <button type="button" className="link-button" onClick={() => navigate('/billing/collection')}>
            Fee Collection
          </button>
          .
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={(r) => navigate(`/students/${r.studentId}`)}
        pageSize={14}
        searchPlaceholder="Search by student name or ID…"
        searchKeys={['name', 'phone', 'membershipPlan']}
        exportFileName="outstanding-payments.csv"
        emptyIcon={CheckCircle2}
        emptyTitle="No outstanding payments"
        emptyDescription="Every student is up to date on their fees."
        footerNote={total ? `${formatCurrency(total)} total` : undefined}
      />
    </div>
  );
}
