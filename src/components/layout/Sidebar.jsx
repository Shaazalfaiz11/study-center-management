import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Map, Clock, UserCheck, Repeat, ListOrdered, CalendarCheck,
  BadgeCheck, RefreshCw, Wallet, Receipt, Banknote, FileBarChart, PieChart,
  Wrench, Bell, Settings, Shield, Building2, X, CalendarOff, Table2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './Sidebar.css';

/**
 * Navigation grouped the way an owner actually works through the
 * day, rather than by database table.
 */
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true }],
  },
  {
    label: 'Operations',
    items: [
      { to: '/students', icon: Users, label: 'Students' },
      { to: '/seats/map', icon: Map, label: 'Live Seats' },
      { to: '/seats/desks', icon: Table2, label: 'Seat Register' },
      { to: '/slots', icon: Clock, label: 'Shifts' },
      { to: '/assignments', icon: UserCheck, label: 'Assignments' },
      { to: '/assignments/shift-changes', icon: Repeat, label: 'Shift Changes', badge: 'pendingShiftChanges', tone: 'warning' },
      { to: '/assignments/waitlist', icon: ListOrdered, label: 'Waitlist', badge: 'waitlistCount', tone: 'default' },
      { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    ],
  },
  {
    label: 'Memberships & Payments',
    items: [
      { to: '/memberships/active', icon: BadgeCheck, label: 'Memberships' },
      { to: '/memberships/expiring', icon: RefreshCw, label: 'Renewals', badge: 'expiringMemberships', tone: 'warning' },
      { to: '/memberships/leave', icon: CalendarOff, label: 'Leave', badge: 'activeLeaves', tone: 'default' },
      { to: '/billing/collection', icon: Wallet, label: 'Fee Collection', badge: 'collectionCount', tone: 'danger' },
      { to: '/billing', icon: Receipt, label: 'Billing' },
      { to: '/billing/expenses', icon: Banknote, label: 'Expenses' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports/daily', icon: FileBarChart, label: 'Daily Operations' },
      { to: '/reports', icon: PieChart, label: 'Analytics' },
    ],
  },
  {
    label: 'Support',
    items: [
      { to: '/maintenance', icon: Wrench, label: 'Maintenance', badge: 'openMaintenance', tone: 'warning' },
      { to: '/notifications', icon: Bell, label: 'Notifications', badge: 'unreadNotifications', tone: 'default' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/audit', icon: Shield, label: 'Audit Log' },
    ],
  },
];

const TONE_CLASS = { danger: 'count-pill-danger', warning: 'count-pill-warning', primary: 'count-pill-primary', default: '' };

export default function Sidebar({ isOpen, onClose }) {
  const { stats, center } = useApp();

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Building2 size={17} />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-brand">{center?.name || 'Study Center'}</span>
              <span className="sidebar-brand-sub">{center?.branch || 'Admin'}</span>
            </div>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="sidebar-group">
              <span className="sidebar-group-label">{group.label}</span>
              {group.items.map((item) => {
                const count = item.badge ? stats[item.badge] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <item.icon size={16} className="sidebar-link-icon" />
                    <span className="sidebar-link-label">{item.label}</span>
                    {count > 0 && <span className={`count-pill ${TONE_CLASS[item.tone] || ''}`}>{count}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-occupancy">
            <div className="sidebar-occupancy-head">
              <span>Seat occupancy</span>
              <strong>{stats.occupancyRate}%</strong>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${stats.occupancyRate}%` }} />
            </div>
            <span className="sidebar-occupancy-sub">
              {stats.assignedSeats + stats.occupiedSeats} of {stats.totalSeats} seats in use
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
