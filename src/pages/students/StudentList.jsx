import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Users, CreditCard, Repeat } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { StatusBadge, Avatar } from '../../components/ui/Primitives';
import studentService from '../../services/studentService';
import { formatCurrency, formatDate, relativeDay, daysUntil } from '../../services/businessRules';

export default function StudentList() {
  const { students, stats, slots } = useApp();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ status: 'all', membershipStatus: 'all', paymentStatus: 'all', slotId: 'all' });

  const { data: rows, loading, error, retry } = useAsync(() => studentService.getStudents(filters), [filters, students]);

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  const columns = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      accessor: (s) => s.name,
      render: (s) => (
        <div className="cell-student">
          <Avatar name={s.name} size={30} />
          <div className="cell-student-info">
            <span className="cell-student-name">{s.name}</span>
            <span className="cell-student-sub">{s.studentId} · {s.exam}</span>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideBelow: 'lg', accessor: (s) => s.phone, className: 'cell-num' },
    {
      key: 'deskNumber',
      header: 'Seat',
      sortable: true,
      accessor: (s) => s.deskNumber,
      render: (s) => (s.deskNumber ? <span className="cell-mono cell-primary">{s.deskNumber}</span> : <span className="text-muted">—</span>),
    },
    { key: 'slotName', header: 'Shift', sortable: true, hideBelow: 'md', accessor: (s) => s.slotName },
    {
      key: 'membershipPlan',
      header: 'Membership',
      sortable: true,
      hideBelow: 'md',
      accessor: (s) => s.membershipPlan,
      render: (s) => (
        <div className="cell-stack">
          <span>{s.membershipPlan}</span>
          <span className="cell-student-sub">{formatCurrency(s.planPrice)}</span>
        </div>
      ),
    },
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
      key: 'attendanceRate',
      header: 'Attendance',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      accessor: (s) => s.attendanceRate,
      render: (s) => (
        <span className={`cell-num ${s.attendanceRate < 50 ? 'text-error' : s.attendanceRate < 75 ? 'text-warning' : ''}`}>{s.attendanceRate}%</span>
      ),
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      accessor: (s) => s.outstanding,
      render: (s) => (s.outstanding > 0 ? <span className="cell-num cell-strong text-error">{formatCurrency(s.outstanding)}</span> : <span className="text-muted">—</span>),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      sortable: true,
      accessor: (s) => s.paymentStatus,
      render: (s) => <StatusBadge status={s.paymentStatus} />,
    },
    {
      key: 'membershipStatus',
      header: 'Status',
      sortable: true,
      accessor: (s) => s.membershipStatus,
      render: (s) => <StatusBadge status={s.onLeave ? 'paused' : s.membershipStatus} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      stopPropagation: true,
      width: 60,
      render: (s) => (
        <div className="cell-actions">
          <button type="button" className="icon-btn" title="View profile" onClick={() => navigate(`/students/${s.id}`)}>
            <Eye size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={Users} label="Active students" value={stats.activeStudents} sublabel={`${stats.totalStudents} on the register`} onClick={() => setFilters((f) => ({ ...f, status: 'active' }))} />
        <StatCard icon={CreditCard} label="With dues" value={stats.collectionCount} tone={stats.collectionCount ? 'warning' : 'neutral'} sublabel={formatCurrency(stats.totalOutstanding)} onClick={() => navigate('/billing/collection')} />
        <StatCard icon={Repeat} label="Expiring soon" value={stats.expiringMemberships} tone={stats.expiringMemberships ? 'warning' : 'neutral'} sublabel="Within 7 days" onClick={() => navigate('/memberships/expiring')} />
        <StatCard icon={Users} label="Without a seat" value={students.filter((s) => s.status === 'active' && !s.deskId).length} sublabel="Active, unassigned" onClick={() => navigate('/assignments')} />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={(s) => navigate(`/students/${s.id}`)}
        pageSize={14}
        searchPlaceholder="Search by name, ID, phone or seat…"
        searchKeys={['name', 'phone', 'deskNumber', 'membershipPlan']}
        exportFileName="students.csv"
        emptyIcon={Users}
        emptyTitle="No students match these filters"
        emptyDescription="Adjust the filters, or add a new student."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/students/add')}>
            <Plus size={14} /> Add student
          </button>
        }
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: filters.status,
            onChange: setFilter('status'),
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'on_leave', label: 'On leave' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          {
            key: 'membershipStatus',
            label: 'Membership',
            value: filters.membershipStatus,
            onChange: setFilter('membershipStatus'),
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'expiring', label: 'Expiring' },
              { value: 'expired', label: 'Expired' },
              { value: 'paused', label: 'Paused' },
            ],
          },
          {
            key: 'paymentStatus',
            label: 'Payment',
            value: filters.paymentStatus,
            onChange: setFilter('paymentStatus'),
            options: [
              { value: 'all', label: 'All' },
              { value: 'paid', label: 'Paid' },
              { value: 'due', label: 'Due today' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'partial', label: 'Partial' },
              { value: 'upcoming', label: 'Upcoming' },
            ],
          },
          {
            key: 'slotId',
            label: 'Shift',
            value: filters.slotId,
            onChange: setFilter('slotId'),
            options: [{ value: 'all', label: 'All' }, ...slots.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))],
          },
        ]}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/students/add')}>
            <Plus size={14} /> Add Student
          </button>
        }
      />
    </div>
  );
}
