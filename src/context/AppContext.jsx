import { createContext, useContext, useState, useCallback, useSyncExternalStore, useMemo, useRef } from 'react';
import { getState, subscribe } from '../services/store';
import { daysUntil, isPotentiallyInactive, todayISO } from '../services/businessRules';

const AppContext = createContext(null);

/**
 * Read-only view of the store plus UI-level concerns (toasts and
 * the shared confirmation dialog). All writes go through services.
 */
export function AppProvider({ children }) {
  const data = useSyncExternalStore(subscribe, getState, getState);

  // ── Toasts ─────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message, type = 'info', options = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, description: options.description }]);
      const timer = setTimeout(() => removeToast(id), options.duration ?? 4000);
      timers.current.set(id, timer);
      return id;
    },
    [removeToast],
  );

  // ── Confirmation dialog ────────────────────────────────────
  // `confirm(options)` resolves to true/false, so callers can await it.
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolver = useRef(null);

  const confirm = useCallback((options) => {
    setConfirmState({ tone: 'default', confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...options });
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const resolveConfirm = useCallback((result) => {
    setConfirmState(null);
    if (confirmResolver.current) {
      confirmResolver.current(result);
      confirmResolver.current = null;
    }
  }, []);

  // ── Derived counts used by the sidebar and dashboard ────────
  const stats = useMemo(() => {
    const { students, desks, attendance, payments, expenses, maintenance, shiftChanges, leaves, waitlist, slots } = data;
    const today = todayISO();
    const monthPrefix = today.slice(0, 7);

    const seatCount = (status) => desks.filter((d) => d.status === status).length;
    const inUse = seatCount('assigned') + seatCount('occupied');
    const todayAttendance = attendance.filter((a) => a.date === today);
    const present = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;

    const monthlyRevenue = payments
      .filter((p) => p.status === 'completed' && p.date.startsWith(monthPrefix))
      .reduce((sum, p) => sum + p.amount, 0);
    const monthlyExpenses = expenses.filter((e) => e.date.startsWith(monthPrefix)).reduce((sum, e) => sum + e.amount, 0);

    const dueTodayCount = students.filter((s) => s.paymentStatus === 'due').length;
    const overdueCount = students.filter((s) => s.paymentStatus === 'overdue').length;

    return {
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.status === 'active').length,
      onLeaveStudents: students.filter((s) => s.status === 'on_leave').length,
      inactiveStudents: students.filter((s) => s.status === 'inactive').length,

      totalSeats: desks.length,
      availableSeats: seatCount('available'),
      assignedSeats: seatCount('assigned'),
      occupiedSeats: seatCount('occupied'),
      reservedSeats: seatCount('reserved'),
      temporarilyReleasedSeats: seatCount('temporarily_released'),
      maintenanceSeats: seatCount('maintenance'),
      blockedSeats: seatCount('blocked'),
      occupancyRate: desks.length ? Math.round((inUse / desks.length) * 100) : 0,

      todayPresent: present,
      todayAbsent: todayAttendance.filter((a) => a.status === 'absent').length,
      todayExpected: todayAttendance.length,
      attendanceRate: todayAttendance.length ? Math.round((present / todayAttendance.length) * 100) : 0,

      todayCollection: payments.filter((p) => p.date === today && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0),
      monthlyRevenue,
      monthlyExpenses,
      netProfit: monthlyRevenue - monthlyExpenses,
      totalOutstanding: students.reduce((sum, s) => sum + (s.outstanding || 0), 0),

      dueTodayCount,
      overdueCount,
      collectionCount: dueTodayCount + overdueCount,
      expiringMemberships: students.filter((s) => s.membershipStatus === 'expiring').length,
      expiredMemberships: students.filter((s) => s.membershipStatus === 'expired').length,
      pausedMemberships: students.filter((s) => s.membershipStatus === 'paused').length,
      expiringToday: students.filter((s) => daysUntil(s.membershipExpiry) === 0).length,

      pendingShiftChanges: shiftChanges.filter((r) => r.status === 'pending').length,
      approvedShiftChanges: shiftChanges.filter((r) => r.status === 'approved').length,
      activeLeaves: leaves.filter((l) => l.status === 'active').length,
      upcomingLeaves: leaves.filter((l) => l.status === 'upcoming').length,
      openMaintenance: maintenance.filter((m) => m.status !== 'resolved').length,
      waitlistCount: waitlist.length,
      unreadNotifications: data.notifications.filter((n) => !n.read).length,
      potentiallyInactive: students.filter(isPotentiallyInactive).length,

      newAdmissionsToday: students.filter((s) => s.joinDate === today).length,
      renewalsToday: data.auditLog.filter((a) => a.date === today && a.action === 'membership_renewed').length,

      shiftOccupancy: slots
        .filter((s) => s.active)
        .map((slot) => ({
          id: slot.id,
          name: slot.name,
          assigned: slot.assigned,
          capacity: slot.capacity,
          rate: slot.capacity ? Math.round((slot.assigned / slot.capacity) * 100) : 0,
        })),
    };
  }, [data]);

  const value = useMemo(
    () => ({ ...data, stats, toasts, addToast, removeToast, confirm, confirmState, resolveConfirm }),
    [data, stats, toasts, addToast, removeToast, confirm, confirmState, resolveConfirm],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
