'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { UIProvider, useUI } from '@/context/UIContext';
import { ConfirmDialog } from '@/components/ui/Primitives';
import './AppShell.css';

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', description: "Today's operating picture" },
  '/students': { title: 'Students', description: 'Everyone registered at the centre' },
  '/students/add': { title: 'New Admission', description: 'Register a student and assign a seat' },
  '/seats/map': { title: 'Live Seat Map', description: 'Real-time seat status by floor and section' },
  '/seats/desks': { title: 'Seat Register', description: 'Every seat, its holder and its condition' },
  '/slots': { title: 'Shifts', description: 'Timings and capacity for each shift' },
  '/assignments': { title: 'Seat Assignment', description: 'Assign a free seat to a student' },
  '/assignments/shift-changes': { title: 'Shift Changes', description: 'Requests to move between shifts' },
  '/assignments/waitlist': { title: 'Waitlist', description: 'People waiting for a seat' },
  '/attendance': { title: 'Attendance', description: 'Check-ins, check-outs and daily marking' },
  '/memberships/active': { title: 'Memberships', description: 'Plans, validity and renewal status' },
  '/memberships/expiring': { title: 'Renewals', description: 'Memberships expiring soon' },
  '/memberships/plans': { title: 'Membership Plans', description: 'Pricing and duration' },
  '/memberships/leave': { title: 'Leave Management', description: 'Temporary membership pauses' },
  '/billing': { title: 'Billing Overview', description: 'Revenue, expenses and profitability' },
  '/billing/collection': { title: 'Fee Collection', description: "Today's collection worklist" },
  '/billing/payments': { title: 'Payments', description: 'All recorded payments' },
  '/billing/expenses': { title: 'Expenses', description: 'Operating costs' },
  '/maintenance': { title: 'Maintenance', description: 'Reported issues and repairs' },
  '/reports': { title: 'Analytics', description: 'Students, seats, attendance and revenue' },
  '/reports/daily': { title: 'Daily Operations', description: 'One-page summary of the day' },
  '/notifications': { title: 'Notifications', description: 'Alerts that need attention' },
  '/settings': { title: 'Settings', description: 'Centre configuration and team' },
  '/audit': { title: 'Audit Log', description: 'Every change, who made it and when' },
};

const TOAST_ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export default function AppShell({ account, children }) {
  return (
    <UIProvider>
      <Shell account={account}>{children}</Shell>
    </UIProvider>
  );
}

function Shell({ account, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { toasts, removeToast, confirmState, resolveConfirm } = useUI();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const meta =
    PAGE_META[pathname] ||
    (pathname.startsWith('/students/') ? { title: 'Student Profile', description: 'Membership, seat, attendance and payments' } : { title: 'Self Study Center' });

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} account={account} />
      <div className="app-main">
        <TopBar title={meta.title} description={meta.description} account={account} onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content">{children}</main>
      </div>

      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map((t) => {
            const Icon = TOAST_ICONS[t.type] || Info;
            return (
              <div key={t.id} className={`toast toast-${t.type}`}>
                <Icon size={16} className="toast-icon" />
                <div className="toast-content">
                  <div className="toast-message">{t.message}</div>
                  {t.description && <div className="toast-description">{t.description}</div>}
                </div>
                <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog state={confirmState} onResolve={resolveConfirm} />
    </div>
  );
}
