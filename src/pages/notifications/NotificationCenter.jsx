import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, ArrowRight, CreditCard, Repeat, Wrench, Armchair, BadgeCheck, Settings, CalendarCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAsync } from '../../hooks/useAsync';
import { notificationService } from '../../services/operationsService';
import { EmptyState, ErrorState, SkeletonText } from '../../components/ui/StateViews';
import { SectionCard } from '../../components/ui/Primitives';

const ICONS = {
  payment: CreditCard,
  shift: Repeat,
  maintenance: Wrench,
  seat: Armchair,
  expiry: BadgeCheck,
  attendance: CalendarCheck,
  system: Settings,
};

const TONES = {
  payment: 'error',
  shift: 'info',
  maintenance: 'warning',
  seat: 'warning',
  expiry: 'info',
  attendance: 'warning',
  system: 'gray',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

export default function NotificationCenter() {
  const { notifications, addToast } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const { data: rows, loading, error, retry } = useAsync(() => notificationService.getNotifications(filter), [filter, notifications]);

  const unread = notifications.filter((n) => !n.read).length;

  const open = async (n) => {
    if (!n.read) await notificationService.markRead({ id: n.id });
    if (n.link) navigate(n.link);
  };

  const dismiss = async (e, n) => {
    e.stopPropagation();
    await notificationService.dismiss({ id: n.id });
    addToast('Notification dismissed', 'info');
  };

  const markAll = async () => {
    await notificationService.markAllRead();
    addToast('All notifications marked as read', 'success');
  };

  return (
    <div className="page-stack" style={{ maxWidth: 820 }}>
      <SectionCard
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        actions={
          <div className="btn-group">
            <div className="segmented">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={`segmented-item ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                  {f.key === 'unread' && unread > 0 && <span className="segmented-count">{unread}</span>}
                </button>
              ))}
            </div>
            {unread > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>
        }
        padded={false}
      >
        {loading && !rows ? (
          <div className="card-body">
            <SkeletonText lines={6} />
          </div>
        ) : error ? (
          <ErrorState description={error.message} onRetry={retry} />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? "You're all caught up" : 'No notifications'}
            description={filter === 'unread' ? 'Nothing needs your attention right now.' : 'Alerts about payments, shifts and maintenance appear here.'}
          />
        ) : (
          <ul className="notif-list">
            {rows.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <li key={n.id} className={`notif-item ${n.read ? '' : 'is-unread'}`}>
                  <button type="button" className="notif-open" onClick={() => open(n)}>
                    <span className={`notif-icon notif-${TONES[n.type] || 'gray'}`}>
                      <Icon size={15} />
                    </span>
                    <span className="notif-body">
                      <span className="notif-head">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-time">{n.time}</span>
                      </span>
                      <span className="notif-message">{n.message}</span>
                      <span className="badge badge-gray badge-sm">{n.category}</span>
                    </span>
                  </button>
                  <div className="notif-actions">
                    {n.link && <ArrowRight size={14} className="text-muted" />}
                    <button type="button" className="icon-btn" title="Dismiss" onClick={(e) => dismiss(e, n)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
