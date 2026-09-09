'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Map, Clock, UserCheck, Repeat, ListOrdered, CalendarCheck,
  BadgeCheck, RefreshCw, Wallet, Receipt, Banknote, FileBarChart, PieChart,
  Wrench, Bell, Settings, Shield, Building2, X, CalendarOff, Table2, Lock,
} from 'lucide-react';
import './Sidebar.css';

/**
 * Navigation grouped the way an owner works through the day.
 *
 * `ownerOnly` items are hidden from non-owners. That is presentation
 * only — the real enforcement is the RLS policy on the table.
 */
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Operations',
    items: [
      { to: '/students', icon: Users, label: 'Students' },
      { to: '/seats/map', icon: Map, label: 'Live Seats' },
      { to: '/seats/desks', icon: Table2, label: 'Seat Register' },
      { to: '/slots', icon: Clock, label: 'Shifts' },
      { to: '/assignments', icon: UserCheck, label: 'Assignments' },
      { to: '/assignments/shift-changes', icon: Repeat, label: 'Shift Changes' },
      { to: '/assignments/waitlist', icon: ListOrdered, label: 'Waitlist' },
      { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    ],
  },
  {
    label: 'Memberships & Payments',
    items: [
      { to: '/memberships/active', icon: BadgeCheck, label: 'Memberships' },
      { to: '/memberships/expiring', icon: RefreshCw, label: 'Renewals' },
      { to: '/memberships/leave', icon: CalendarOff, label: 'Leave' },
      { to: '/billing/collection', icon: Wallet, label: 'Fee Collection' },
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
      { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/audit', icon: Shield, label: 'Audit Log', ownerOnly: true },
    ],
  },
];

export default function Sidebar({ isOpen, onClose, account }) {
  const pathname = usePathname();
  const isOwner = account?.role === 'owner';

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
              <span className="sidebar-brand">Self Study Center</span>
              <span className="sidebar-brand-sub">Admin</span>
            </div>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter((item) => !item.ownerOnly || isOwner);
            if (visible.length === 0) return null;

            return (
              <div key={group.label} className="sidebar-group">
                <span className="sidebar-group-label">{group.label}</span>
                {visible.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return (
                    <Link key={item.to} href={item.to} className={`sidebar-link ${active ? 'active' : ''}`} onClick={onClose}>
                      <item.icon size={16} className="sidebar-link-icon" />
                      <span className="sidebar-link-label">{item.label}</span>
                      {item.ownerOnly && <Lock size={11} className="sidebar-link-lock" />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account">
            <span className="sidebar-account-name">{account?.name}</span>
            <span className="sidebar-account-role">{ROLE_LABELS[account?.role] || 'Staff'}</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export const ROLE_LABELS = {
  owner: 'Owner',
  front_desk: 'Front Desk',
  facilities: 'Facilities',
};
