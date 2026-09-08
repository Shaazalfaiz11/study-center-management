import { useState, useMemo } from 'react';
import { Shield, ArrowRight, Activity, Users, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import DataTable from '../../components/ui/DataTable';
import StatCard, { StatGrid } from '../../components/ui/StatCard';
import { Drawer, DetailRow, Avatar } from '../../components/ui/Primitives';
import auditService from '../../services/auditService';
import { formatDate, relativeDay, todayISO, statusLabel } from '../../services/businessRules';

const ACTION_GROUPS = {
  student_created: 'Students',
  student_updated: 'Students',
  student_status_changed: 'Students',
  payment_recorded: 'Payments',
  outstanding_adjusted: 'Payments',
  reminder_sent: 'Payments',
  expense_added: 'Payments',
  expense_deleted: 'Payments',
  membership_renewed: 'Memberships',
  membership_paused: 'Memberships',
  membership_resumed: 'Memberships',
  leave_extended: 'Memberships',
  leave_cancelled: 'Memberships',
  plan_created: 'Memberships',
  plan_updated: 'Memberships',
  seat_assigned: 'Seats',
  seat_transferred: 'Seats',
  seat_released: 'Seats',
  seat_temp_released: 'Seats',
  seat_temp_allocated: 'Seats',
  seat_temp_ended: 'Seats',
  seat_kept_reserved: 'Seats',
  seat_restored: 'Seats',
  seat_maintenance: 'Seats',
  seat_blocked: 'Seats',
  seat_available: 'Seats',
  seat_created: 'Seats',
  seat_updated: 'Seats',
  shift_requested: 'Shifts',
  shift_approved: 'Shifts',
  shift_rejected: 'Shifts',
  shift_changed: 'Shifts',
  slot_created: 'Shifts',
  slot_updated: 'Shifts',
  attendance_marked: 'Attendance',
  maintenance_reported: 'Maintenance',
  maintenance_updated: 'Maintenance',
  maintenance_resolved: 'Maintenance',
  waitlist_added: 'Operations',
  waitlist_removed: 'Operations',
};

const GROUP_TONES = {
  Students: 'info',
  Payments: 'success',
  Memberships: 'purple',
  Seats: 'warning',
  Shifts: 'info',
  Attendance: 'gray',
  Maintenance: 'error',
  Operations: 'gray',
};

export default function AuditLog() {
  const { auditLog, staff } = useApp();
  const [group, setGroup] = useState('all');
  const [admin, setAdmin] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: allRows, loading, error, retry } = useAsync(() => auditService.getAuditLog({ admin }), [admin, auditLog]);

  const rows = useMemo(() => {
    if (!allRows) return [];
    if (group === 'all') return allRows;
    return allRows.filter((r) => (ACTION_GROUPS[r.action] || 'Operations') === group);
  }, [allRows, group]);

  const todayCount = auditLog.filter((a) => a.date === todayISO()).length;
  const admins = [...new Set(auditLog.map((a) => a.admin))];

  const columns = [
    {
      key: 'dateTime',
      header: 'When',
      sortable: true,
      accessor: (r) => r.dateTime,
      render: (r) => (
        <div className="cell-stack">
          <span className="cell-primary">{formatDate(r.date)}</span>
          <span className="cell-student-sub">{r.time} · {relativeDay(r.date)}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      accessor: (r) => r.action,
      render: (r) => {
        const grp = ACTION_GROUPS[r.action] || 'Operations';
        return <span className={`badge badge-${GROUP_TONES[grp] || 'gray'}`}>{statusLabel(r.action)}</span>;
      },
    },
    { key: 'entity', header: 'Record', sortable: true, accessor: (r) => r.entity, className: 'cell-primary' },
    { key: 'summary', header: 'Change', accessor: (r) => r.summary, render: (r) => <span className="cell-clamp">{r.summary}</span> },
    {
      key: 'transition',
      header: 'Before → After',
      hideBelow: 'lg',
      accessor: (r) => `${r.before} → ${r.after}`,
      render: (r) => (
        <span className="audit-transition">
          <span className="audit-before">{r.before}</span>
          <ArrowRight size={11} />
          <span className="audit-after">{r.after}</span>
        </span>
      ),
    },
    {
      key: 'admin',
      header: 'By',
      sortable: true,
      accessor: (r) => r.admin,
      render: (r) => (
        <div className="cell-student">
          <Avatar name={r.admin} size={24} />
          <span className="cell-student-sub">{r.admin}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard icon={Activity} label="Recorded actions" value={auditLog.length} sublabel="All time" />
        <StatCard icon={Clock} label="Today" value={todayCount} sublabel="Changes since midnight" />
        <StatCard icon={Users} label="Staff active" value={admins.length} sublabel={`${staff.length} on the team`} />
        <StatCard icon={Shield} label="Retention" value="90 days" sublabel="Log kept for audit" />
      </StatGrid>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={retry}
        onRowClick={setSelected}
        selectedRowId={selected?.id}
        pageSize={16}
        searchPlaceholder="Search by record, action or change…"
        searchKeys={['entity', 'summary', 'action']}
        exportFileName="audit-log.csv"
        emptyIcon={Shield}
        emptyTitle="No audit records"
        emptyDescription="Every important admin action is recorded here automatically."
        filters={[
          {
            key: 'group',
            label: 'Area',
            value: group,
            onChange: setGroup,
            options: [{ value: 'all', label: 'All areas' }, ...[...new Set(Object.values(ACTION_GROUPS))].map((g) => ({ value: g, label: g }))],
          },
          {
            key: 'admin',
            label: 'Staff',
            value: admin,
            onChange: setAdmin,
            options: [{ value: 'all', label: 'Everyone' }, ...admins.map((a) => ({ value: a, label: a }))],
          },
        ]}
      />

      {selected && (
        <Drawer open onClose={() => setSelected(null)} title={statusLabel(selected.action)} subtitle={`${formatDate(selected.date)} · ${selected.time}`} width={400}>
          <div className="audit-detail-head">
            <Avatar name={selected.admin} size={36} />
            <div>
              <strong>{selected.admin}</strong>
              <span>{staff.find((s) => s.name === selected.admin)?.role || 'Staff'}</span>
            </div>
          </div>

          <div className="drawer-block">
            <DetailRow label="Record" value={selected.entity} strong />
            <DetailRow label="Area" value={ACTION_GROUPS[selected.action] || 'Operations'} />
            <DetailRow label="Date" value={formatDate(selected.date)} />
            <DetailRow label="Time" value={selected.time} />
          </div>

          <div className="drawer-block">
            <span className="uppercase-label">What changed</span>
            <p className="drawer-quote">{selected.summary}</p>
          </div>

          <div className="audit-diff">
            <div className="audit-diff-side">
              <span className="uppercase-label">Before</span>
              <span className="audit-diff-value">{selected.before}</span>
            </div>
            <ArrowRight size={16} className="text-muted" />
            <div className="audit-diff-side audit-diff-after">
              <span className="uppercase-label">After</span>
              <span className="audit-diff-value">{selected.after}</span>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
