import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, TrendingUp, TrendingDown, AlertCircle, Banknote, ArrowRight, Wallet } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { SectionCard } from '../../components/ui/Primitives';
import { SkeletonCards } from '../../components/ui/StateViews';
import reportService from '../../services/reportService';
import { formatCurrency, formatCurrencyCompact } from '../../services/businessRules';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// Brand-neutral, colour-blind-safe series palette.
const SERIES = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#dc2626', '#64748b', '#0891b2', '#65a30d'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}`;
};

export default function BillingDashboard() {
  const { stats, payments, expenses } = useApp();
  const navigate = useNavigate();

  const { data: report, loading } = useAsync(() => reportService.getRevenueReport(), [payments, expenses]);

  const trendData = useMemo(() => {
    if (!report) return null;
    return {
      labels: report.months.map((m) => monthLabel(m.month)),
      datasets: [
        { label: 'Revenue', data: report.months.map((m) => m.revenue), backgroundColor: SERIES[0], borderRadius: 3, barPercentage: 0.7 },
        { label: 'Expenses', data: report.months.map((m) => m.expenses), backgroundColor: '#cbd5e1', borderRadius: 3, barPercentage: 0.7 },
      ],
    };
  }, [report]);

  const expenseData = useMemo(() => {
    const byCategory = {};
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 7);
    return {
      labels: sorted.map(([k]) => k),
      datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: SERIES, borderWidth: 0 }],
    };
  }, [expenses]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 14, boxWidth: 7, font: { size: 11, family: 'Inter' } } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? ctx.parsed)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b' } },
      y: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { font: { size: 11, family: 'Inter' }, color: '#64748b', callback: (v) => formatCurrencyCompact(v) } },
    },
  };

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={IndianRupee} label="Collected today" value={formatCurrency(stats.todayCollection)} tone="success" sublabel="All payment methods" onClick={() => navigate('/billing/payments')} />
        <StatCard icon={TrendingUp} label="Revenue this month" value={formatCurrency(stats.monthlyRevenue)} sublabel="Membership and locker fees" />
        <StatCard icon={Banknote} label="Expenses this month" value={formatCurrency(stats.monthlyExpenses)} tone="error" sublabel="Rent, salaries, utilities" onClick={() => navigate('/billing/expenses')} />
        <StatCard icon={stats.netProfit >= 0 ? TrendingUp : TrendingDown} label="Net profit" value={formatCurrency(stats.netProfit)} tone={stats.netProfit >= 0 ? 'success' : 'error'} sublabel="Revenue minus expenses" emphasis />
        <StatCard icon={Wallet} label="Outstanding" value={formatCurrency(stats.totalOutstanding)} tone={stats.totalOutstanding ? 'warning' : 'neutral'} sublabel={`${stats.collectionCount} to collect`} onClick={() => navigate('/billing/collection')} />
        <StatCard icon={AlertCircle} label="Overdue students" value={stats.overdueCount} tone={stats.overdueCount ? 'error' : 'neutral'} sublabel="Past the due date" onClick={() => navigate('/billing/collection')} />
      </StatGrid>

      <div className="billing-grid">
        <SectionCard
          title="Revenue vs expenses"
          subtitle="Last six months"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/billing/payments')}>
              All payments <ArrowRight size={13} />
            </button>
          }
        >
          <div style={{ height: 280 }}>
            {loading || !trendData ? <SkeletonCards count={1} height={260} /> : <Bar data={trendData} options={chartOptions} />}
          </div>
        </SectionCard>

        <SectionCard
          title="Where the money goes"
          subtitle="Expenses by category"
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/billing/expenses')}>
              All expenses <ArrowRight size={13} />
            </button>
          }
        >
          <div style={{ height: 280 }}>
            <Doughnut
              data={expenseData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                  legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 10, font: { size: 11, family: 'Inter' } } },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}` } },
                },
              }}
            />
          </div>
        </SectionCard>

        <SectionCard title="Profit & loss" subtitle="This month" className="billing-span-2">
          <div className="pl-table">
            <div className="pl-row">
              <span>Revenue collected</span>
              <strong className="text-success">{formatCurrency(stats.monthlyRevenue)}</strong>
            </div>
            <div className="pl-row">
              <span>Operating expenses</span>
              <strong className="text-error">− {formatCurrency(stats.monthlyExpenses)}</strong>
            </div>
            <div className="pl-row pl-total">
              <span>Net profit</span>
              <strong className={stats.netProfit >= 0 ? 'text-success' : 'text-error'}>{formatCurrency(stats.netProfit)}</strong>
            </div>
            <div className="pl-row pl-muted">
              <span>Still to collect</span>
              <strong className="text-warning">{formatCurrency(stats.totalOutstanding)}</strong>
            </div>
            <div className="pl-row pl-muted">
              <span>Potential monthly total</span>
              <strong>{formatCurrency(stats.monthlyRevenue + stats.totalOutstanding)}</strong>
            </div>
          </div>

          {report && Object.keys(report.byMethod).length > 0 && (
            <div className="method-split">
              <span className="uppercase-label">Collected by method (all time)</span>
              <div className="method-split-rows">
                {Object.entries(report.byMethod).map(([method, amount]) => (
                  <div key={method} className="method-split-row">
                    <span>{method}</span>
                    <strong>{formatCurrency(amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
