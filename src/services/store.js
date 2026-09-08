// ============================================================
// STORE
// ------------------------------------------------------------
// A tiny in-memory store that stands in for the API's database.
// Components never touch it directly — services do.
//
// Every write runs through `recompute()`, which re-derives all
// status fields from the raw entities. That is what guarantees
// the seat map, the student profile and the collection dashboard
// can never disagree about the same student.
// ============================================================

import { initializeMockData } from '../data/mockData';
import {
  todayISO,
  daysUntil,
  getMembershipStatus,
  getPaymentStatus,
  deriveSeatStatus,
  attendanceRate,
} from './businessRules';

let state = recompute(initializeMockData());
const listeners = new Set();

// Simulated network latency, so loading states are real.
export const LATENCY = { min: 180, max: 420 };

let failNextCall = false;
/** Test hook: makes the next service call reject, to demo error states. */
export const simulateNextFailure = () => { failNextCall = true; };

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const respond = async (producer) => {
  const wait = LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min);
  await delay(wait);
  if (failNextCall) {
    failNextCall = false;
    throw new Error('Unable to reach the server. Please try again.');
  }
  return typeof producer === 'function' ? producer() : producer;
};

// ── Subscription ─────────────────────────────────────────────
export const getState = () => state;

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = () => listeners.forEach((l) => l(state));

/** Apply a mutation to the raw data, then re-derive everything. */
export const mutate = (mutator) => {
  const draft = { ...state };
  mutator(draft);
  state = recompute(draft);
  emit();
  return state;
};

export const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

// ============================================================
// Derivation
// ============================================================
function recompute(data) {
  const today = todayISO();

  // ── 1. Leave status by date ────────────────────────────────
  const leaves = data.leaves.map((leave) => {
    if (leave.status === 'cancelled' || leave.status === 'completed') return leave;
    const end = leave.extendedTo || leave.endDate;
    let status = leave.status;
    if (today < leave.startDate) status = 'upcoming';
    else if (today > end) status = 'completed';
    else status = 'active';
    return status === leave.status ? leave : { ...leave, status };
  });

  const activeLeaveByStudent = new Map();
  leaves.forEach((l) => {
    if (l.status === 'active') activeLeaveByStudent.set(l.studentId, l);
  });

  // ── 2. Attendance rollups ──────────────────────────────────
  const attendanceByStudent = new Map();
  const presentToday = new Set();

  for (const record of data.attendance) {
    let bucket = attendanceByStudent.get(record.studentId);
    if (!bucket) {
      bucket = [];
      attendanceByStudent.set(record.studentId, bucket);
    }
    bucket.push(record);
    if (record.date === today && (record.status === 'present' || record.status === 'late') && record.checkIn) {
      presentToday.add(record.studentId);
    }
  }

  // ── 3. Payment rollups ─────────────────────────────────────
  const paidByStudent = new Map();
  const lastPaymentByStudent = new Map();

  for (const payment of data.payments) {
    if (payment.status !== 'completed') continue;
    paidByStudent.set(payment.studentId, (paidByStudent.get(payment.studentId) || 0) + payment.amount);
    const prev = lastPaymentByStudent.get(payment.studentId);
    if (!prev || payment.date > prev.date) lastPaymentByStudent.set(payment.studentId, payment);
  }

  // ── 4. Students ────────────────────────────────────────────
  const students = data.students.map((student) => {
    const leave = activeLeaveByStudent.get(student.id);
    const records = attendanceByStudent.get(student.id) || [];
    const attended = records.filter((r) => r.checkIn).sort((a, b) => (a.date < b.date ? 1 : -1));
    const lastPayment = lastPaymentByStudent.get(student.id);

    const onLeave = Boolean(leave);
    const membershipStatus = getMembershipStatus(student, { onLeave });

    // Someone whose membership lapsed more than 10 days ago and who
    // has lost their seat is treated as inactive.
    let lifecycle = student.status;
    if (onLeave) lifecycle = 'on_leave';
    else if (lifecycle === 'on_leave') lifecycle = 'active';

    const next = {
      ...student,
      onLeave,
      leaveId: leave ? leave.id : null,
      status: lifecycle,
      membershipStatus,
      membershipDaysLeft: daysUntil(student.membershipExpiry),
      paymentStatus: getPaymentStatus(student),
      totalPaid: paidByStudent.get(student.id) || 0,
      lastPaymentDate: lastPayment ? lastPayment.date : null,
      lastPaymentAmount: lastPayment ? lastPayment.amount : null,
      attendanceRate: attendanceRate(records),
      lastAttendanceDate: attended.length ? attended[0].date : null,
      presentToday: presentToday.has(student.id),
    };
    return next;
  });

  const studentById = new Map(students.map((s) => [s.id, s]));

  // ── 5. Seats ───────────────────────────────────────────────
  const desks = data.desks.map((seat) => {
    const holderPresentToday = seat.studentId ? presentToday.has(seat.studentId) : false;
    const tempHolderPresentToday = seat.temporary?.tempStudentId ? presentToday.has(seat.temporary.tempStudentId) : false;
    const status = deriveSeatStatus(seat, { holderPresentToday, tempHolderPresentToday });

    const holder = seat.studentId ? studentById.get(seat.studentId) : null;
    const lastUsed = holder?.lastAttendanceDate || seat.lastUsed || null;

    if (status === seat.status && lastUsed === seat.lastUsed) return seat;
    return { ...seat, status, lastUsed };
  });

  // ── 6. Slot occupancy ──────────────────────────────────────
  const assignedPerSlot = new Map();
  students.forEach((s) => {
    if (s.status === 'inactive') return;
    assignedPerSlot.set(s.slotId, (assignedPerSlot.get(s.slotId) || 0) + 1);
  });

  const seatedPerSlot = new Map();
  desks.forEach((seat) => {
    if (!seat.studentId || !seat.slotId) return;
    seatedPerSlot.set(seat.slotId, (seatedPerSlot.get(seat.slotId) || 0) + 1);
  });

  const slots = data.slots.map((slot) => ({
    ...slot,
    assigned: assignedPerSlot.get(slot.id) || 0,
    seated: seatedPerSlot.get(slot.id) || 0,
  }));

  return { ...data, students, desks, slots, leaves };
}

/** Exposed so tests / dev tools can force a re-derive. */
export const refresh = () => {
  state = recompute(state);
  emit();
};
