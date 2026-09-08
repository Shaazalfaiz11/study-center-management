import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Printer, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import { Drawer, StatusBadge, DetailRow } from '../../components/ui/Primitives';
import paymentService from '../../services/paymentService';
import { formatCurrency, formatDate } from '../../services/businessRules';

export default function Invoices() {
  const { payments, center, addToast } = useApp();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  const { data: rows, loading, error, retry } = useAsync(() => paymentService.getInvoices(), [payments]);

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice', sortable: true, accessor: (r) => r.invoiceNumber, className: 'cell-mono cell-primary' },
    { key: 'receiptNumber', header: 'Receipt', sortable: true, hideBelow: 'md', accessor: (r) => r.receiptNumber, className: 'cell-mono' },
    { key: 'studentName', header: 'Student', sortable: true, accessor: (r) => r.studentName, className: 'cell-primary' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, accessor: (r) => r.amount, render: (r) => <span className="cell-num cell-strong">{formatCurrency(r.amount)}</span> },
    { key: 'date', header: 'Date', sortable: true, accessor: (r) => r.date, render: (r) => formatDate(r.date) },
    { key: 'method', header: 'Method', hideBelow: 'md', accessor: (r) => r.method, render: (r) => <span className="badge badge-gray">{r.method}</span> },
    { key: 'membershipPlan', header: 'Plan', hideBelow: 'lg', accessor: (r) => r.membershipPlan },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 60,
      render: (r) => (
        <div className="cell-actions">
          <button type="button" className="icon-btn" title="View invoice" onClick={() => setSelected(r)}>
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={setSelected}
        selectedRowId={selected?.id}
        pageSize={14}
        searchPlaceholder="Search by invoice number, receipt or student…"
        searchKeys={['invoiceNumber', 'receiptNumber', 'studentName']}
        exportFileName="invoices.csv"
        emptyIcon={FileText}
        emptyTitle="No invoices yet"
        emptyDescription="An invoice is generated for every completed payment."
      />

      {selected && (
        <Drawer
          open
          onClose={() => setSelected(null)}
          title={selected.invoiceNumber}
          subtitle={`${selected.studentName} · ${formatDate(selected.date)}`}
          width={420}
          footer={
            <>
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { setSelected(null); navigate(`/students/${selected.studentId}`); }}>
                View student
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => {
                  addToast('Opening print dialog', 'info');
                  setTimeout(() => window.print(), 300);
                }}
              >
                <Printer size={14} /> Print
              </button>
            </>
          }
        >
          <div className="invoice-head">
            <div>
              <strong>{center.name}</strong>
              <span>{center.branch}</span>
              <span>{center.address}</span>
              <span>GSTIN {center.gstin}</span>
            </div>
            <StatusBadge status="paid" />
          </div>

          <div className="payment-hero">
            <span className="payment-hero-amount">{formatCurrency(selected.amount)}</span>
            <span className="text-sm text-muted">Paid via {selected.method}</span>
          </div>

          <div className="drawer-block">
            <DetailRow label="Billed to" value={selected.studentName} strong />
            <DetailRow label="Student ID" value={selected.studentIdNum} />
            <DetailRow label="Invoice number" value={selected.invoiceNumber} />
            <DetailRow label="Receipt number" value={selected.receiptNumber} />
            <DetailRow label="Date" value={formatDate(selected.date)} />
            <DetailRow label="Plan" value={selected.membershipPlan} />
            {selected.periodEnd && <DetailRow label="Period" value={`${formatDate(selected.periodStart)} → ${formatDate(selected.periodEnd)}`} />}
            <DetailRow label="Transaction ID" value={selected.transactionId} />
            <DetailRow label="Collected by" value={selected.collectedBy} />
          </div>
        </Drawer>
      )}
    </div>
  );
}
