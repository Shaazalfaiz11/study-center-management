import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';

import AppShell from './components/layout/AppShell';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';

// Operations
import StudentList from './pages/students/StudentList';
import AddStudent from './pages/students/AddStudent';
import StudentProfile from './pages/students/StudentProfile';
import LiveSeatMap from './pages/seats/SeatMap';
import DeskManagement from './pages/seats/DeskManagement';
import SlotManagement from './pages/slots/SlotManagement';
import AssignmentFlow from './pages/assignments/AssignmentFlow';
import ShiftChange from './pages/assignments/ShiftChange';
import Waitlist from './pages/assignments/Waitlist';
import Attendance from './pages/attendance/Attendance';

// Memberships & payments
import MembershipList from './pages/memberships/MembershipList';
import MembershipPlans from './pages/memberships/MembershipPlans';
import LeaveManagement from './pages/memberships/LeaveManagement';
import CollectionDashboard from './pages/billing/CollectionDashboard';
import BillingDashboard from './pages/billing/BillingDashboard';
import Payments from './pages/billing/Payments';
import Invoices from './pages/billing/Invoices';
import OutstandingPayments from './pages/billing/Outstanding';
import Expenses from './pages/billing/Expenses';

// Reports & support
import DailyOperations from './pages/reports/DailyOperations';
import Reports from './pages/reports/Reports';
import MaintenanceDashboard from './pages/maintenance/MaintenanceDashboard';
import NotificationCenter from './pages/notifications/NotificationCenter';
import SettingsPage from './pages/settings/Settings';
import AuditLog from './pages/audit/AuditLog';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />

              {/* Students */}
              <Route path="/students" element={<StudentList />} />
              <Route path="/students/add" element={<AddStudent />} />
              <Route path="/students/:id" element={<StudentProfile />} />

              {/* Seats */}
              <Route path="/seats/map" element={<LiveSeatMap />} />
              <Route path="/seats/desks" element={<DeskManagement />} />

              {/* Shifts & assignments */}
              <Route path="/slots" element={<SlotManagement />} />
              <Route path="/assignments" element={<AssignmentFlow />} />
              <Route path="/assignments/shift-changes" element={<ShiftChange />} />
              <Route path="/assignments/waitlist" element={<Waitlist />} />

              {/* Attendance */}
              <Route path="/attendance" element={<Attendance />} />

              {/* Memberships */}
              <Route path="/memberships" element={<Navigate to="/memberships/active" replace />} />
              <Route path="/memberships/active" element={<MembershipList filter="active" />} />
              <Route path="/memberships/expiring" element={<MembershipList filter="expiring" />} />
              <Route path="/memberships/expired" element={<MembershipList filter="expired" />} />
              <Route path="/memberships/plans" element={<MembershipPlans />} />
              <Route path="/memberships/leave" element={<LeaveManagement />} />

              {/* Billing */}
              <Route path="/billing" element={<BillingDashboard />} />
              <Route path="/billing/collection" element={<CollectionDashboard />} />
              <Route path="/billing/payments" element={<Payments />} />
              <Route path="/billing/invoices" element={<Invoices />} />
              <Route path="/billing/outstanding" element={<OutstandingPayments />} />
              <Route path="/billing/expenses" element={<Expenses />} />

              {/* Reports */}
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/daily" element={<DailyOperations />} />

              {/* Support */}
              <Route path="/maintenance" element={<MaintenanceDashboard />} />
              <Route path="/notifications" element={<NotificationCenter />} />

              {/* System */}
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit" element={<AuditLog />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
