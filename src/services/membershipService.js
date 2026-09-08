// ============================================================
// MEMBERSHIP SERVICE
// Renewals, plans, and temporary pauses (leave management).
//
// Pausing preserves the remaining days: they are added back to
// the expiry date when the student resumes.
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import {
  todayISO,
  formatDate,
  daysBetween,
  daysUntil,
  addDays,
  renewalExpiry,
  EXPIRING_SOON_DAYS,
} from './businessRules';

export const membershipService = {
  // ── Memberships ────────────────────────────────────────────
  getMemberships: (filters = {}) =>
    respond(() => {
      let list = [...getState().students];
      if (filters.status && filters.status !== 'all') list = list.filter((s) => s.membershipStatus === filters.status);
      if (filters.planId && filters.planId !== 'all') list = list.filter((s) => s.membershipPlanId === filters.planId);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((s) => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q));
      }
      return list.sort((a, b) => a.membershipExpiry.localeCompare(b.membershipExpiry));
    }),

  getExpiring: (withinDays = EXPIRING_SOON_DAYS) =>
    respond(() =>
      getState()
        .students.filter((s) => {
          const left = daysUntil(s.membershipExpiry);
          return left >= 0 && left <= withinDays;
        })
        .sort((a, b) => a.membershipExpiry.localeCompare(b.membershipExpiry)),
    ),

  getMembershipSummary: () =>
    respond(() => {
      const { students } = getState();
      const count = (status) => students.filter((s) => s.membershipStatus === status).length;
      return {
        total: students.length,
        active: count('active'),
        expiring: count('expiring'),
        expired: count('expired'),
        paused: count('paused'),
        expiringToday: students.filter((s) => daysUntil(s.membershipExpiry) === 0).length,
        expiringThisWeek: students.filter((s) => {
          const d = daysUntil(s.membershipExpiry);
          return d > 0 && d <= 7;
        }).length,
        recentlyExpired: students.filter((s) => {
          const d = daysUntil(s.membershipExpiry);
          return d < 0 && d >= -14;
        }).length,
      };
    }),

  renewMembership: ({ studentId, planId, collectPayment = false, method = 'Cash' }) =>
    respond(() => {
      const state = getState();
      const student = state.students.find((s) => s.id === studentId);
      const plan = state.membershipPlans.find((p) => p.id === planId);
      if (!student) throw new Error('Student not found');
      if (!plan) throw new Error('Select a membership plan');

      const oldExpiry = student.membershipExpiry;
      const newExpiry = renewalExpiry(student, plan);
      const newStart = daysUntil(oldExpiry) > 0 ? addDays(oldExpiry, 1) : todayISO();

      mutate((draft) => {
        draft.students = draft.students.map((s) =>
          s.id === studentId
            ? {
                ...s,
                membershipPlanId: plan.id,
                membershipPlan: plan.name,
                planPrice: plan.price,
                membershipStart: newStart,
                membershipExpiry: newExpiry,
                feeDueDate: newExpiry,
                outstanding: collectPayment ? 0 : plan.price,
                status: s.status === 'inactive' ? 'active' : s.status,
              }
            : s,
        );

        if (collectPayment) {
          const seq = draft.payments.length + 1;
          draft.payments = [
            {
              id: nextId('pay'),
              receiptNumber: `RCP-${String(2400 + seq).padStart(5, '0')}`,
              invoiceNumber: `INV-${String(2400 + seq).padStart(5, '0')}`,
              studentId: student.id,
              studentName: student.name,
              studentIdNum: student.studentId,
              amount: plan.price,
              method,
              date: todayISO(),
              status: 'completed',
              membershipPlan: plan.name,
              membershipPlanId: plan.id,
              periodStart: newStart,
              periodEnd: newExpiry,
              transactionId: `TXN${String(100000 + Math.floor(Math.random() * 899999))}`,
              collectedBy: 'Rajesh Kumar',
              notes: 'Renewal',
              type: 'membership',
            },
            ...draft.payments,
          ];
        }

        appendAudit(draft, {
          action: 'membership_renewed',
          entity: student.name,
          summary: `${plan.name} renewed${collectPayment ? ` — ${plan.price} collected` : ' — payment pending'}`,
          before: `Expiry ${formatDate(oldExpiry)}`,
          after: `Expiry ${formatDate(newExpiry)}`,
        });
      });

      return { newExpiry, plan: plan.name };
    }),

  // ── Plans ──────────────────────────────────────────────────
  getPlans: () => respond(() => getState().membershipPlans),

  savePlan: ({ id, name, duration, durationUnit, price, description }) =>
    respond(() => {
      const durationDays = durationUnit.startsWith('day') ? Number(duration) : Number(duration) * 30;
      mutate((draft) => {
        if (id) {
          draft.membershipPlans = draft.membershipPlans.map((p) =>
            p.id === id ? { ...p, name, duration: Number(duration), durationUnit, durationDays, price: Number(price), description } : p,
          );
          appendAudit(draft, { action: 'plan_updated', entity: name, summary: 'Plan updated', before: '—', after: `₹${price}` });
        } else {
          draft.membershipPlans = [
            ...draft.membershipPlans,
            { id: nextId('plan'), name, duration: Number(duration), durationUnit, durationDays, price: Number(price), description: description || '', active: true },
          ];
          appendAudit(draft, { action: 'plan_created', entity: name, summary: 'Plan created', before: '—', after: `₹${price}` });
        }
      });
      return true;
    }),

  togglePlan: ({ id }) =>
    respond(() => {
      const plan = getState().membershipPlans.find((p) => p.id === id);
      if (!plan) throw new Error('Plan not found');
      mutate((draft) => {
        draft.membershipPlans = draft.membershipPlans.map((p) => (p.id === id ? { ...p, active: !p.active } : p));
        appendAudit(draft, {
          action: 'plan_updated',
          entity: plan.name,
          summary: `Plan ${plan.active ? 'deactivated' : 'activated'}`,
          before: plan.active ? 'Active' : 'Inactive',
          after: plan.active ? 'Inactive' : 'Active',
        });
      });
      return true;
    }),

  // ── Leave / pause ──────────────────────────────────────────
  getLeaves: (filters = {}) =>
    respond(() => {
      let list = [...getState().leaves];
      if (filters.status && filters.status !== 'all') list = list.filter((l) => l.status === filters.status);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((l) => l.studentName.toLowerCase().includes(q) || l.studentIdNum.toLowerCase().includes(q));
      }
      return list.sort((a, b) => b.startDate.localeCompare(a.startDate));
    }),

  getLeaveSummary: () =>
    respond(() => {
      const { leaves } = getState();
      return {
        active: leaves.filter((l) => l.status === 'active').length,
        upcoming: leaves.filter((l) => l.status === 'upcoming').length,
        completed: leaves.filter((l) => l.status === 'completed').length,
        cancelled: leaves.filter((l) => l.status === 'cancelled').length,
      };
    }),

  /**
   * Pause a membership.
   *  - Membership status → Paused (via the store's derivation)
   *  - Seat → Temporarily Released (or held, if seatAction is 'reserved')
   *  - Student stays in the records
   *  - Remaining days are stored and given back on resume
   */
  pauseMembership: async ({ studentId, startDate, endDate, reason, seatAction = 'released' }) => {
    const state = getState();
    const student = state.students.find((s) => s.id === studentId);
    if (!student) throw new Error('Student not found');
    if (!startDate || !endDate) throw new Error('Leave dates are required');
    if (endDate < startDate) throw new Error('End date must be on or after the start date');
    if (student.onLeave) throw new Error(`${student.name} is already on leave`);

    const remainingDays = Math.max(0, daysBetween(startDate, student.membershipExpiry));
    const leaveId = nextId('leave');

    const leave = {
      id: leaveId,
      studentId,
      studentName: student.name,
      studentIdNum: student.studentId,
      deskNumber: student.deskNumber,
      slotName: student.slotName,
      startDate,
      endDate,
      reason: reason || '',
      status: startDate > todayISO() ? 'upcoming' : 'active',
      seatAction,
      requestedOn: todayISO(),
      approvedBy: 'Rajesh Kumar',
      extendedTo: null,
      resumedOn: null,
      remainingDaysAtStart: remainingDays,
    };

    return respond(() => {
      mutate((draft) => {
        draft.leaves = [leave, ...draft.leaves];
        appendAudit(draft, {
          action: 'membership_paused',
          entity: student.name,
          summary: `Leave ${formatDate(startDate)} → ${formatDate(endDate)} — ${remainingDays} days preserved`,
          before: 'Active',
          after: leave.status === 'active' ? 'Paused' : 'Leave scheduled',
        });
      });

      // Release the seat only once the leave has actually started.
      if (leave.status === 'active' && seatAction === 'released' && student.deskId) {
        mutate((draft) => {
          draft.desks = draft.desks.map((d) =>
            d.id === student.deskId
              ? { ...d, temporary: { holderStudentId: studentId, tempStudentId: null, from: startDate, to: endDate, reason, leaveId } }
              : d,
          );
          draft.assignmentHistory = [
            {
              id: nextId('asg'),
              studentId,
              studentName: student.name,
              type: 'temp_released',
              fromSeat: student.deskNumber,
              toSeat: null,
              date: todayISO(),
              time: '',
              by: 'Rajesh Kumar',
              note: `Temporarily released — leave until ${formatDate(endDate)}`,
            },
            ...draft.assignmentHistory,
          ];
          appendAudit(draft, {
            action: 'seat_temp_released',
            entity: student.name,
            summary: `Seat ${student.deskNumber} temporarily released until ${formatDate(endDate)}`,
            before: 'Assigned',
            after: 'Temporarily Released',
          });
        });
      }

      return leave;
    });
  },

  extendLeave: ({ leaveId, newEndDate }) =>
    respond(() => {
      const leave = getState().leaves.find((l) => l.id === leaveId);
      if (!leave) throw new Error('Leave not found');
      if (newEndDate <= (leave.extendedTo || leave.endDate)) throw new Error('New end date must be later than the current one');

      mutate((draft) => {
        draft.leaves = draft.leaves.map((l) => (l.id === leaveId ? { ...l, extendedTo: newEndDate } : l));
        draft.desks = draft.desks.map((d) =>
          d.temporary?.leaveId === leaveId ? { ...d, temporary: { ...d.temporary, to: newEndDate } } : d,
        );
        appendAudit(draft, {
          action: 'leave_extended',
          entity: leave.studentName,
          summary: `Leave extended to ${formatDate(newEndDate)}`,
          before: formatDate(leave.extendedTo || leave.endDate),
          after: formatDate(newEndDate),
        });
      });
      return true;
    }),

  cancelLeave: ({ leaveId }) =>
    respond(() => {
      const state = getState();
      const leave = state.leaves.find((l) => l.id === leaveId);
      if (!leave) throw new Error('Leave not found');

      mutate((draft) => {
        draft.leaves = draft.leaves.map((l) => (l.id === leaveId ? { ...l, status: 'cancelled' } : l));
        draft.desks = draft.desks.map((d) => (d.temporary?.leaveId === leaveId ? { ...d, temporary: null } : d));
        appendAudit(draft, {
          action: 'leave_cancelled',
          entity: leave.studentName,
          summary: 'Leave cancelled — membership continues',
          before: leave.status,
          after: 'Cancelled',
        });
      });
      return true;
    }),

  /**
   * Resume a paused membership.
   *  - Membership → Active, expiry pushed out by the days paused
   *  - Seat returns to the holder
   *  - Any temporary occupant is moved off the seat
   */
  resumeMembership: ({ leaveId, resumeDate = todayISO() }) =>
    respond(() => {
      const state = getState();
      const leave = state.leaves.find((l) => l.id === leaveId);
      if (!leave) throw new Error('Leave not found');
      const student = state.students.find((s) => s.id === leave.studentId);
      if (!student) throw new Error('Student not found');

      const pausedDays = Math.max(0, daysBetween(leave.startDate, resumeDate));
      const newExpiry = addDays(student.membershipExpiry, pausedDays);
      const seat = state.desks.find((d) => d.temporary?.leaveId === leaveId);
      const tempStudent = seat?.temporary?.tempStudentId
        ? state.students.find((s) => s.id === seat.temporary.tempStudentId)
        : null;

      mutate((draft) => {
        draft.leaves = draft.leaves.map((l) =>
          l.id === leaveId ? { ...l, status: 'completed', resumedOn: resumeDate, endDate: resumeDate < l.endDate ? resumeDate : l.endDate } : l,
        );
        draft.students = draft.students.map((s) =>
          s.id === student.id ? { ...s, membershipExpiry: newExpiry, feeDueDate: newExpiry, pausedDays: (s.pausedDays || 0) + pausedDays, status: 'active' } : s,
        );
        if (seat) {
          draft.desks = draft.desks.map((d) => (d.id === seat.id ? { ...d, temporary: null } : d));
          draft.assignmentHistory = [
            {
              id: nextId('asg'),
              studentId: student.id,
              studentName: student.name,
              type: 'resumed',
              fromSeat: null,
              toSeat: seat.number,
              date: resumeDate,
              time: '',
              by: 'Rajesh Kumar',
              note: tempStudent ? `Returned from leave — temporary use by ${tempStudent.name} ended` : 'Returned from leave',
            },
            ...draft.assignmentHistory,
          ];
        }
        appendAudit(draft, {
          action: 'membership_resumed',
          entity: student.name,
          summary: `Membership resumed — ${pausedDays} paused day${pausedDays === 1 ? '' : 's'} added back`,
          before: `Paused, expiry ${formatDate(student.membershipExpiry)}`,
          after: `Active, expiry ${formatDate(newExpiry)}`,
        });
      });

      return { newExpiry, pausedDays, seatNumber: seat?.number || null, tempStudentName: tempStudent?.name || null };
    }),
};

export default membershipService;
