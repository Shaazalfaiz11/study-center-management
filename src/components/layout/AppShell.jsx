import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { ConfirmDialog } from '../ui/Primitives';
import { setActor } from '../../services/auditService';
import './AppShell.css';

const PAGE_META = {
  '/': { title: 'Dashboard', description: "Today's operating picture" },
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
  '/memberships/expired': { title: 'Expired Memberships', description: 'Lapsed memberships to follow up' },
  '/memberships/plans': { title: 'Membership Plans', description: 'Pricing and duration' },
  '/memberships/leave': { title: 'Leave Management', description: 'Temporary membership pauses' },
  '/billing': { title: 'Billing Overview', description: 'Revenue, expenses and profitability' },
  '/billing/collection': { title: 'Fee Collection', description: "Today's collection worklist" },
  '/billing/payments': { title: 'Payments', description: 'All recorded payments' },
  '/billing/invoices': { title: 'Invoices & Receipts', description: 'Issued receipts' },
  '/billing/outstanding': { title: 'Outstanding Payments', description: 'Unpaid dues by student' },
  '/billing/expenses': { title: 'Expenses', description: 'Operating costs' },
  '/maintenance': { title: 'Maintenance', description: 'Reported issues and repairs' },
  '/reports': { title: 'Analytics', description: 'Students, seats, attendance and revenue' },
  '/reports/daily': { title: 'Daily Operations', description: 'One-page summary of the day' },
  '/notifications': { title: 'Notifications', description: 'Alerts that need attention' },
  '/settings': { title: 'Settings', description: 'Centre configuration' },
  '/audit': { title: 'Audit Log', description: 'Every change, who made it and when' },
};

const TOAST_ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export default function AppShell() {
  const { isAuthenticated, user } = useAuth();
  const { toasts, removeToast, confirmState, resolveConfirm } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Audit entries are attributed to whoever is signed in.
  useEffect(() => {
    if (user?.name) setActor(user.name);
  }, [user]);

  // Close the mobile drawer and scroll to top on navigation.
  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const getMeta = () => {
    if (location.pathname.startsWith('/students/') && location.pathname !== '/students/add') {
      return { title: 'Student Profile', description: 'Membership, seat, attendance and payments' };
    }
    return PAGE_META[location.pathname] || { title: 'Self Study Center' };
  };

  const meta = getMeta();

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <TopBar title={meta.title} description={meta.description} onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content">
          <Outlet />
        </main>
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
