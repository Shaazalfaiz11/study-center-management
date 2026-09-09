import { useState, useMemo } from 'react';
import { Plus, Banknote, Trash2, TrendingDown, Receipt } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Modal, ActionButton } from '../../components/ui/Primitives';
import { expenseService } from '../../services/operationsService';
import { formatCurrency, formatDate, todayISO } from '../../services/businessRules';

export default function Expenses() {
  const { expenses, expenseCategories, stats, addToast, confirm } = useApp();
  const [category, setCategory] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const { data: rows, loading, error, retry } = useAsync(() => expenseService.getExpenses({ category }), [category, expenses]);

  const monthTotal = useMemo(() => {
    const prefix = todayISO().slice(0, 7);
    return expenses.filter((e) => e.date.startsWith(prefix)).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const biggest = useMemo(() => {
    const byCategory = {};
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    return sorted[0] || ['—', 0];
  }, [expenses]);

  const remove = async (expense) => {
    const ok = await confirm({
      title: 'Delete this expense?',
      tone: 'danger',
      confirmLabel: 'Delete expense',
      message: `${expense.description} — ${formatCurrency(expense.amount)} will be removed from the books.`,
    });
    if (!ok) return;
    try {
      await expenseService.deleteExpense({ id: expense.id });
      addToast('Expense deleted', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const columns = [
    { key: 'date', header: 'Date', sortable: true, accessor: (e) => e.date, render: (e) => formatDate(e.date) },
    { key: 'category', header: 'Category', sortable: true, accessor: (e) => e.category, render: (e) => <span className="badge badge-gray">{e.category}</span> },
    { key: 'description', header: 'Description', sortable: true, accessor: (e) => e.description, className: 'cell-primary' },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, accessor: (e) => e.amount, render: (e) => <span className="cell-num cell-strong">{formatCurrency(e.amount)}</span> },
    { key: 'paymentMethod', header: 'Method', hideBelow: 'md', accessor: (e) => e.paymentMethod },
    { key: 'addedBy', header: 'Added by', hideBelow: 'lg', accessor: (e) => e.addedBy },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 50,
      render: (e) => (
        <div className="cell-actions">
          <button type="button" className="icon-btn" title="Delete" onClick={() => remove(e)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const filteredTotal = (rows || []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={Banknote} label="This month" value={formatCurrency(monthTotal)} tone="error" sublabel="Total expenses" />
        <StatCard icon={TrendingDown} label="Net this month" value={formatCurrency(stats.netProfit)} tone={stats.netProfit >= 0 ? 'success' : 'error'} sublabel={`${formatCurrency(stats.monthlyRevenue)} revenue`} />
        <StatCard icon={Receipt} label="Biggest category" value={biggest[0]} sublabel={formatCurrency(biggest[1])} />
        <StatCard icon={Receipt} label="Entries" value={expenses.length} sublabel="All time" />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        pageSize={14}
        searchPlaceholder="Search by description or category…"
        searchKeys={['description', 'category']}
        exportFileName="expenses.csv"
        emptyIcon={Banknote}
        emptyTitle="No expenses recorded"
        emptyDescription="Track rent, salaries and running costs to see true profitability."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add expense
          </button>
        }
        footerNote={filteredTotal ? `${formatCurrency(filteredTotal)} in this view` : undefined}
        filters={[
          {
            key: 'category',
            label: 'Category',
            value: category,
            onChange: setCategory,
            options: [{ value: 'all', label: 'All categories' }, ...expenseCategories.map((c) => ({ value: c, label: c }))],
          },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Expense
          </button>
        }
      />

      <AddExpenseModal open={showAdd} onClose={() => setShowAdd(false)} categories={expenseCategories} addToast={addToast} />
    </div>
  );
}

function AddExpenseModal({ open, onClose, categories, addToast }) {
  const blank = { category: 'Rent', amount: '', date: todayISO(), paymentMethod: 'Cash', description: '', notes: '' };
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
    if (!form.description.trim()) errs.description = 'Describe what this was for';
    if (!Number(form.amount) || Number(form.amount) <= 0) errs.amount = 'Enter a valid amount';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setPending(true);
    try {
      await expenseService.addExpense(form);
      addToast('Expense added', 'success', { description: `${form.description} — ${formatCurrency(Number(form.amount))}` });
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
      title="Add expense"
      description="Record a running cost so monthly profit stays accurate."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
          <ActionButton pending={pending} onClick={submit}>Save expense</ActionButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="ex-cat">Category</label>
            <select id="ex-cat" className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ex-amount">Amount (₹) <span className="required">*</span></label>
            <input id="ex-amount" type="number" className={`form-input ${errors.amount ? 'error' : ''}`} value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            {errors.amount && <span className="form-error">{errors.amount}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="ex-date">Date</label>
            <input id="ex-date" type="date" className="form-input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ex-method">Payment method</label>
            <select id="ex-method" className="form-select" value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
              <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ex-desc">Description <span className="required">*</span></label>
          <input id="ex-desc" className={`form-input ${errors.description ? 'error' : ''}`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. UPPCL electricity bill — September" />
          {errors.description && <span className="form-error">{errors.description}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ex-notes">Notes</label>
          <textarea id="ex-notes" className="form-textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
