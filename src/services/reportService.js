// ============================================================
// REPORT SERVICE
// Read-only aggregation. Exports build files in the browser.
// ============================================================

import { getState, respond } from './store';
import { todayISO, daysUntil, daysSince, formatDate, formatDateLong, formatCurrency, isPotentiallyInactive, INACTIVE_ATTENDANCE_DAYS } from './businessRules';

const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);

export const reportService = {
  /**
   * The owner's morning read: one page covering students, seats,
   * money and everything waiting for a decision.
   */
  getDailyOperationsReport: (date = todayISO()) =>
    respond(() => {
      const state = getState();
      const { students, desks, attendance, payments, expenses, slots, leaves, shiftChanges, maintenance, waitlist } = state;

      const dayAttendance = attendance.filter((a) => a.date === date);
      const presentRecords = dayAttendance.filter((a) => a.status === 'present' || a.status === 'late');
      const activeStudents = students.filter((s) => s.status === 'active');

      const seatCount = (status) => desks.filter((d) => d.status === status).length;
      const inUse = seatCount('assigned') + seatCount('occupied');

      const dayPayments = payments.filter((p) => p.date === date && p.status === 'completed');
      const dayExpenses = expenses.filter((e) => e.date === date);

      const renewedToday = state.auditLog.filter((a) => a.date === date && a.action === 'membership_renewed');
      const expiredToday = students.filter((s) => daysUntil(s.membershipExpiry) === 0 && s.membershipStatus === 'expired');
      const expiringSoon = students.filter((s) => {
        const d = daysUntil(s.membershipExpiry);
        return d >= 0 && d <= 7;
      });

      const newAdmissions = students.filter((s) => s.joinDate === date);
      const outstandingTotal = sum(students, 'outstanding');

      return {
        date,
        dateLabel: formatDateLong(date),
        generatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),

        students: {
          total: students.length,
          active: activeStudents.length,
          present: presentRecords.length,
          absent: dayAttendance.filter((a) => a.status === 'absent').length,
          onLeave: students.filter((s) => s.status === 'on_leave').length,
          inactive: students.filter((s) => s.status === 'inactive').length,
          newAdmissions: newAdmissions.length,
          newAdmissionNames: newAdmissions.map((s) => s.name),
          attendanceRate: dayAttendance.length ? Math.round((presentRecords.length / dayAttendance.length) * 100) : 0,
        },

        attendance: {
          checkedIn: dayAttendance.filter((a) => a.checkIn).length,
          checkedOut: dayAttendance.filter((a) => a.checkOut).length,
          late: dayAttendance.filter((a) => a.status === 'late').length,
          bySlot: slots
            .filter((s) => s.active)
            .map((slot) => {
              const rows = dayAttendance.filter((a) => a.slotId === slot.id);
              const present = rows.filter((a) => a.status === 'present' || a.status === 'late').length;
              return { name: slot.name, present, total: rows.length, assigned: slot.assigned, capacity: slot.capacity, occupancy: slot.capacity ? Math.round((slot.assigned / slot.capacity) * 100) : 0 };
            }),
        },

        seats: {
          total: desks.length,
          inUse,
          available: seatCount('available'),
          reserved: seatCount('reserved'),
          temporarilyReleased: seatCount('temporarily_released'),
          maintenance: seatCount('maintenance'),
          blocked: seatCount('blocked'),
          occupancyRate: desks.length ? Math.round((inUse / desks.length) * 100) : 0,
          potentiallyInactive: students.filter(isPotentiallyInactive).length,
        },

        finance: {
          collectedToday: sum(dayPayments, 'amount'),
          paymentCount: dayPayments.length,
          expensesToday: sum(dayExpenses, 'amount'),
          outstanding: outstandingTotal,
          overdueCount: students.filter((s) => s.paymentStatus === 'overdue').length,
          overdueAmount: sum(students.filter((s) => s.paymentStatus === 'overdue'), 'outstanding'),
          dueTodayCount: students.filter((s) => s.paymentStatus === 'due').length,
          dueTodayAmount: sum(students.filter((s) => s.paymentStatus === 'due'), 'outstanding'),
          byMethod: dayPayments.reduce((acc, p) => {
            acc[p.method] = (acc[p.method] || 0) + p.amount;
            return acc;
          }, {}),
        },

        memberships: {
          renewedToday: renewedToday.length,
          renewedNames: renewedToday.map((r) => r.entity),
          expiredToday: expiredToday.length,
          expiringSoon: expiringSoon.length,
          expiringSoonList: expiringSoon.slice(0, 8).map((s) => ({ name: s.name, expiry: s.membershipExpiry, days: daysUntil(s.membershipExpiry), plan: s.membershipPlan })),
          paused: students.filter((s) => s.membershipStatus === 'paused').length,
        },

        operations: {
          shiftChangeRequests: shiftChanges.filter((r) => r.status === 'pending').length,
          shiftChangesApproved: shiftChanges.filter((r) => r.status === 'approved').length,
          activeLeaves: leaves.filter((l) => l.status === 'active').length,
          upcomingLeaves: leaves.filter((l) => l.status === 'upcoming').length,
          maintenanceOpen: maintenance.filter((m) => m.status !== 'resolved').length,
          maintenanceHigh: maintenance.filter((m) => m.status !== 'resolved' && (m.priority === 'high' || m.priority === 'critical')).length,
          waitlist: waitlist.length,
          inactiveWarnings: students.filter(isPotentiallyInactive).map((s) => ({
            name: s.name,
            seat: s.deskNumber,
            lastSeen: s.lastAttendanceDate,
            days: s.lastAttendanceDate ? daysSince(s.lastAttendanceDate) : null,
          })),
        },

        thresholds: { inactiveAfterDays: INACTIVE_ATTENDANCE_DAYS, expiringWithinDays: 7 },
      };
    }),

  getOccupancyReport: () =>
    respond(() => {
      const { desks, slots, students } = getState();
      const bySection = {};
      desks.forEach((seat) => {
        const bucket = (bySection[seat.section] ||= { section: seat.section, zone: seat.zone, total: 0, inUse: 0, available: 0, blocked: 0 });
        bucket.total++;
        if (seat.status === 'assigned' || seat.status === 'occupied') bucket.inUse++;
        else if (seat.status === 'available') bucket.available++;
        else bucket.blocked++;
      });

      return {
        sections: Object.values(bySection).map((s) => ({ ...s, rate: s.total ? Math.round((s.inUse / s.total) * 100) : 0 })),
        shifts: slots
          .filter((s) => s.active)
          .map((slot) => ({ name: slot.name, assigned: slot.assigned, capacity: slot.capacity, rate: slot.capacity ? Math.round((slot.assigned / slot.capacity) * 100) : 0 })),
        unseated: students.filter((s) => s.status === 'active' && !s.deskId).length,
      };
    }),

  getRevenueReport: () =>
    respond(() => {
      const { payments, expenses } = getState();
      const byMonth = {};
      payments
        .filter((p) => p.status === 'completed')
        .forEach((p) => {
          const key = p.date.slice(0, 7);
          byMonth[key] = (byMonth[key] || 0) + p.amount;
        });
      const expenseByMonth = {};
      expenses.forEach((e) => {
        const key = e.date.slice(0, 7);
        expenseByMonth[key] = (expenseByMonth[key] || 0) + e.amount;
      });
      const months = [...new Set([...Object.keys(byMonth), ...Object.keys(expenseByMonth)])].sort().slice(-6);
      return {
        months: months.map((m) => ({ month: m, revenue: byMonth[m] || 0, expenses: expenseByMonth[m] || 0, profit: (byMonth[m] || 0) - (expenseByMonth[m] || 0) })),
        byMethod: payments
          .filter((p) => p.status === 'completed')
          .reduce((acc, p) => {
            acc[p.method] = (acc[p.method] || 0) + p.amount;
            return acc;
          }, {}),
        byPlan: payments
          .filter((p) => p.status === 'completed')
          .reduce((acc, p) => {
            acc[p.membershipPlan] = (acc[p.membershipPlan] || 0) + p.amount;
            return acc;
          }, {}),
      };
    }),
};

// ============================================================
// Exports (client-side only — nothing leaves the browser)
// ============================================================

const download = (content, filename, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const escapeCsv = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/** Generic CSV export used by every table's Export button. */
export const exportToCsv = (filename, columns, rows) => {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsv(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(',')).join('\n');
  download(`${header}\n${body}`, filename, 'text/csv;charset=utf-8;');
};

/** Flattens the daily report into CSV sections. */
export const exportDailyOperationsCsv = (report) => {
  const lines = [
    ['Daily Operations Report'],
    [report.dateLabel],
    [],
    ['Section', 'Metric', 'Value'],
    ['Students', 'Active', report.students.active],
    ['Students', 'Present', report.students.present],
    ['Students', 'Absent', report.students.absent],
    ['Students', 'On leave', report.students.onLeave],
    ['Students', 'New admissions', report.students.newAdmissions],
    ['Students', 'Attendance rate', `${report.students.attendanceRate}%`],
    [],
    ['Seats', 'Total', report.seats.total],
    ['Seats', 'In use', report.seats.inUse],
    ['Seats', 'Available', report.seats.available],
    ['Seats', 'Temporarily released', report.seats.temporarilyReleased],
    ['Seats', 'Maintenance', report.seats.maintenance],
    ['Seats', 'Occupancy', `${report.seats.occupancyRate}%`],
    [],
    ['Finance', 'Collected today', report.finance.collectedToday],
    ['Finance', 'Payments recorded', report.finance.paymentCount],
    ['Finance', 'Expenses today', report.finance.expensesToday],
    ['Finance', 'Outstanding', report.finance.outstanding],
    ['Finance', 'Overdue students', report.finance.overdueCount],
    ['Finance', 'Due today', report.finance.dueTodayAmount],
    [],
    ['Memberships', 'Renewed today', report.memberships.renewedToday],
    ['Memberships', 'Expired today', report.memberships.expiredToday],
    ['Memberships', 'Expiring within 7 days', report.memberships.expiringSoon],
    ['Memberships', 'Paused', report.memberships.paused],
    [],
    ['Operations', 'Shift change requests', report.operations.shiftChangeRequests],
    ['Operations', 'Active leaves', report.operations.activeLeaves],
    ['Operations', 'Upcoming leaves', report.operations.upcomingLeaves],
    ['Operations', 'Open maintenance', report.operations.maintenanceOpen],
    ['Operations', 'Waitlist', report.operations.waitlist],
    [],
    ['Shift', 'Present', 'Assigned', 'Capacity', 'Occupancy'],
    ...report.attendance.bySlot.map((s) => [s.name, s.present, s.assigned, s.capacity, `${s.occupancy}%`]),
  ];

  download(lines.map((row) => row.map(escapeCsv).join(',')).join('\n'), `daily-operations-${report.date}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * "Export PDF" opens the browser's print dialog against a clean
 * print stylesheet — the standard way to do this without a server.
 */
export const printReport = () => window.print();

export { formatDate, formatCurrency };
export default reportService;
