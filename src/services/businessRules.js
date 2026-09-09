// ============================================================
// BUSINESS RULES
// ------------------------------------------------------------
// Pure, deterministic functions. No React, no store access.
// Every screen derives status from these so the same student can
// never look "Overdue" on one page and "Paid" on another.
// ============================================================

export const EXPIRING_SOON_DAYS = 7;
export const INACTIVE_ATTENDANCE_DAYS = 7;
export const GRACE_PERIOD_DAYS = 10;

// ── Dates ────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toISO = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const parseISO = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const addDays = (iso, n) => {
  const d = parseISO(iso) || new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const addMonths = (iso, n) => {
  const d = parseISO(iso) || new Date();
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export const daysBetween = (from, to) => {
  const a = parseISO(from);
  const b = parseISO(to);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
};

export const startOfMonth = (iso = todayISO()) => {
  const d = parseISO(iso) || new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

/** Every date in an inclusive range, oldest first. Capped so a wide range cannot blow up a chart. */
export const eachDay = (from, to, max = 92) => {
  const days = [];
  const span = Math.min(daysBetween(from, to), max);
  for (let i = 0; i <= span; i++) days.push(addDays(from, i));
  return days;
};

export const RANGE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Resolve a preset into a concrete {from, to, label}.
 * "Week" is the trailing seven days, which is what an owner means when
 * they ask how the week is going mid-week.
 */
export const rangeFor = (preset, custom = {}) => {
  const today = todayISO();
  switch (preset) {
    case 'week':
      return { from: addDays(today, -6), to: today, label: 'Last 7 days', preset };
    case 'month':
      return { from: startOfMonth(today), to: today, label: 'This month', preset };
    case 'custom': {
      const from = custom.from || addDays(today, -6);
      const to = custom.to || today;
      return { from: from <= to ? from : to, to: from <= to ? to : from, label: 'Custom range', preset };
    }
    case 'today':
    default:
      return { from: today, to: today, label: 'Today', preset };
  }
};

export const daysUntil = (iso) => daysBetween(todayISO(), iso);
export const daysSince = (iso) => daysBetween(iso, todayISO());

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const formatDate = (iso) => {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatDateLong = (iso) => {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatShortDate = (iso) => {
  const d = parseISO(iso);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "Today", "Tomorrow", "3 days ago", "in 5 days" */
export const relativeDay = (iso) => {
  const diff = daysUntil(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `in ${diff} days`;
};

export const formatCurrency = (n) => {
  const value = Number(n) || 0;
  return `₹${value.toLocaleString('en-IN')}`;
};

export const formatCurrencyCompact = (n) => {
  const value = Number(n) || 0;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
};

// ── Membership rules ─────────────────────────────────────────

/**
 * Membership status.
 *   paused   — student is on an active leave
 *   expired  — expiry date has passed
 *   expiring — expires within EXPIRING_SOON_DAYS (inclusive of today)
 *   active   — everything else
 */
export const getMembershipStatus = (student, { onLeave = false } = {}) => {
  if (onLeave) return 'paused';
  const left = daysUntil(student.membershipExpiry);
  if (left < 0) return 'expired';
  if (left <= EXPIRING_SOON_DAYS) return 'expiring';
  return 'active';
};

export const isExpiringSoon = (student) => {
  const left = daysUntil(student.membershipExpiry);
  return left >= 0 && left <= EXPIRING_SOON_DAYS;
};

export const membershipDaysLeft = (student) => daysUntil(student.membershipExpiry);

/** Remaining days preserved across a pause. */
export const remainingDaysAtPause = (student, pauseStartDate) =>
  Math.max(0, daysBetween(pauseStartDate, student.membershipExpiry));

/** New expiry after a leave: the paused days are pushed onto the end. */
export const expiryAfterResume = (student, leave, resumeDate = todayISO()) => {
  const pausedDays = Math.max(0, daysBetween(leave.startDate, resumeDate));
  return addDays(student.membershipExpiry, pausedDays);
};

/** New expiry when renewing. Renews from expiry if still valid, else from today. */
export const renewalExpiry = (student, plan, fromDate = todayISO()) => {
  const base = daysUntil(student.membershipExpiry) > 0 ? student.membershipExpiry : fromDate;
  if (plan.durationUnit === 'day' || plan.durationUnit === 'days') return addDays(base, plan.duration);
  return addMonths(base, plan.duration);
};

// ── Payment rules ────────────────────────────────────────────

/**
 * Payment status.
 *   paid     — nothing outstanding
 *   partial  — something paid but a balance remains
 *   overdue  — due date has passed with a balance
 *   due      — due today
 *   upcoming — due in the future
 */
export const getPaymentStatus = (student) => {
  const outstanding = Number(student.outstanding) || 0;
  if (outstanding <= 0) return 'paid';

  const dueIn = daysUntil(student.feeDueDate || student.membershipExpiry);
  const partial = outstanding < (student.planPrice || 0);

  if (dueIn < 0) return 'overdue';
  if (partial) return 'partial';
  if (dueIn === 0) return 'due';
  return 'upcoming';
};

export const daysOverdue = (student) => {
  const outstanding = Number(student.outstanding) || 0;
  if (outstanding <= 0) return 0;
  return Math.max(0, daysSince(student.feeDueDate || student.membershipExpiry));
};

/** Outstanding after applying a payment — never below zero. */
export const applyPayment = (outstanding, amount) => Math.max(0, (Number(outstanding) || 0) - (Number(amount) || 0));

// ── Attendance rules ─────────────────────────────────────────

export const attendanceRate = (records) => {
  if (!records.length) return 0;
  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  return Math.round((present / records.length) * 100);
};

/** A seat holder who has not checked in for INACTIVE_ATTENDANCE_DAYS+ days. */
export const isPotentiallyInactive = (student) => {
  if (!student.deskId) return false;
  if (student.onLeave) return false;
  if (!student.lastAttendanceDate) return true;
  return daysSince(student.lastAttendanceDate) >= INACTIVE_ATTENDANCE_DAYS;
};

// ── Seat rules ───────────────────────────────────────────────

export const SEAT_STATUSES = ['available', 'assigned', 'occupied', 'reserved', 'temporarily_released', 'maintenance', 'blocked'];

export const SEAT_STATUS_META = {
  available: { label: 'Available', tone: 'success', color: '#16a34a', bg: '#f0fdf4' },
  assigned: { label: 'Assigned', tone: 'info', color: '#2563eb', bg: '#eff6ff' },
  occupied: { label: 'Occupied', tone: 'purple', color: '#7c3aed', bg: '#f5f3ff' },
  reserved: { label: 'Reserved', tone: 'warning', color: '#d97706', bg: '#fffbeb' },
  temporarily_released: { label: 'Temporarily Released', tone: 'amber', color: '#c2410c', bg: '#fff7ed' },
  maintenance: { label: 'Maintenance', tone: 'gray', color: '#475569', bg: '#f1f5f9' },
  blocked: { label: 'Blocked', tone: 'dark', color: '#1e293b', bg: '#e2e8f0' },
};

/**
 * A seat's status is derived, never hand-set, so the seat map can
 * never disagree with the student record.
 *
 * Priority: admin override → temporary release → occupancy → assignment.
 */
export const deriveSeatStatus = (seat, { holderPresentToday = false, tempHolderPresentToday = false } = {}) => {
  if (seat.override === 'maintenance') return 'maintenance';
  if (seat.override === 'blocked') return 'blocked';

  if (seat.temporary) {
    if (seat.temporary.tempStudentId) return tempHolderPresentToday ? 'occupied' : 'assigned';
    return 'temporarily_released';
  }

  if (seat.override === 'reserved') return 'reserved';
  if (seat.studentId) return holderPresentToday ? 'occupied' : 'assigned';
  return 'available';
};

/** Seats that can take a new permanent assignment. */
export const isSeatAssignable = (seat) => seat.status === 'available';

/** Seats that can take a temporary occupant while the holder is away. */
export const isSeatTemporarilyOffered = (seat) => seat.status === 'temporarily_released';

// ── Shift change rules ───────────────────────────────────────

/**
 * A shift change can only be approved when the target shift has
 * both spare capacity and at least one free seat.
 */
export const canApproveShiftChange = ({ targetSlot, availableSeats, student }) => {
  const blockers = [];
  if (!targetSlot) blockers.push('Requested shift no longer exists');
  else if (targetSlot.assigned >= targetSlot.capacity) blockers.push(`${targetSlot.name} shift is at full capacity (${targetSlot.assigned}/${targetSlot.capacity})`);

  if (!availableSeats || availableSeats.length === 0) blockers.push('No seat is available in the requested shift');

  if (student && (Number(student.outstanding) || 0) > 0 && daysOverdue(student) > 0) {
    blockers.push(`${formatCurrency(student.outstanding)} is overdue — clear dues before transferring`);
  }

  return { allowed: blockers.length === 0, blockers };
};

/** Pro-rata difference between the current plan and the requested shift's plan. */
export const shiftFeeDifference = (currentPlanPrice, newPlanPrice) => (Number(newPlanPrice) || 0) - (Number(currentPlanPrice) || 0);

// ── Status label / tone maps used by badges ──────────────────

export const STATUS_TONES = {
  // membership
  active: 'success',
  expiring: 'warning',
  expired: 'error',
  paused: 'info',
  // student lifecycle
  inactive: 'gray',
  on_leave: 'info',
  // payment
  paid: 'success',
  partial: 'warning',
  overdue: 'error',
  due: 'warning',
  upcoming: 'info',
  pending: 'warning',
  // requests
  approved: 'success',
  rejected: 'error',
  completed: 'success',
  cancelled: 'gray',
  upcoming_leave: 'info',
  // maintenance
  open: 'error',
  in_progress: 'warning',
  resolved: 'success',
  // attendance
  present: 'success',
  absent: 'error',
  late: 'warning',
  leave: 'info',
  // priority
  low: 'gray',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export const STATUS_LABELS = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
  paused: 'Paused',
  inactive: 'Inactive',
  on_leave: 'On Leave',
  paid: 'Paid',
  partial: 'Partially Paid',
  overdue: 'Overdue',
  due: 'Due Today',
  upcoming: 'Upcoming',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'On Leave',
  available: 'Available',
  assigned: 'Assigned',
  occupied: 'Occupied',
  reserved: 'Reserved',
  temporarily_released: 'Temporarily Released',
  maintenance: 'Maintenance',
  blocked: 'Blocked',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const statusLabel = (key) => STATUS_LABELS[key] || (key ? String(key).replace(/_/g, ' ') : '—');
export const statusTone = (key) => STATUS_TONES[key] || 'gray';
