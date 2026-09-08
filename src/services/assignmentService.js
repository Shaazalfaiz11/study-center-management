// ============================================================
// ASSIGNMENT SERVICE
// Shift changes, seat transfers and the waitlist.
//
// A shift change moves through: Pending → Approved → Completed.
// Approval is blocked when the requested shift has no seat free.
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import { todayISO, canApproveShiftChange, formatCurrency } from './businessRules';

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

const historyEntry = (action, by, note) => ({ date: todayISO(), time: nowTime(), action, by: by || 'Rajesh Kumar', note: note || '' });

export const assignmentService = {
  // ── Shift changes ──────────────────────────────────────────
  getShiftChanges: (filters = {}) =>
    respond(() => {
      let list = [...getState().shiftChanges];
      if (filters.status && filters.status !== 'all') list = list.filter((r) => r.status === filters.status);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((r) => r.studentName.toLowerCase().includes(q) || r.studentIdNum.toLowerCase().includes(q));
      }
      return list.sort((a, b) => b.requestedOn.localeCompare(a.requestedOn));
    }),

  getShiftChangeById: (id) => respond(() => getState().shiftChanges.find((r) => r.id === id) || null),

  getShiftChangeSummary: () =>
    respond(() => {
      const { shiftChanges } = getState();
      const count = (s) => shiftChanges.filter((r) => r.status === s).length;
      return { pending: count('pending'), approved: count('approved'), completed: count('completed'), rejected: count('rejected'), total: shiftChanges.length };
    }),

  /**
   * Everything the review screen needs for one request:
   * the student, both shifts, what seats are free, the fee
   * difference and whether approval is currently possible.
   */
  getShiftChangeContext: (requestId) =>
    respond(() => {
      const state = getState();
      const request = state.shiftChanges.find((r) => r.id === requestId);
      if (!request) return null;

      const student = state.students.find((s) => s.id === request.studentId);
      const currentSlot = state.slots.find((s) => s.id === request.currentSlotId);
      const targetSlot = state.slots.find((s) => s.id === request.requestedSlotId);
      const availableSeats = state.desks.filter((d) => d.status === 'available');
      const currentSeat = student?.deskId ? state.desks.find((d) => d.id === student.deskId) : null;

      const eligibility = canApproveShiftChange({ targetSlot, availableSeats, student });

      return { request, student, currentSlot, targetSlot, availableSeats, currentSeat, eligibility };
    }),

  createShiftChangeRequest: ({ studentId, requestedSlotId, effectiveDate, reason, feeDifference = 0, by }) =>
    respond(() => {
      const state = getState();
      const student = state.students.find((s) => s.id === studentId);
      if (!student) throw new Error('Select a student');
      if (!requestedSlotId) throw new Error('Select the requested shift');
      if (requestedSlotId === student.slotId) throw new Error(`${student.name} is already in that shift`);
      if (state.shiftChanges.some((r) => r.studentId === studentId && r.status === 'pending')) {
        throw new Error(`${student.name} already has a pending shift change request`);
      }

      const currentSlot = state.slots.find((s) => s.id === student.slotId);
      const requestedSlot = state.slots.find((s) => s.id === requestedSlotId);

      const request = {
        id: nextId('shift'),
        studentId,
        studentName: student.name,
        studentIdNum: student.studentId,
        phone: student.phone,
        currentSlotId: student.slotId,
        currentSlotName: currentSlot?.name || '—',
        requestedSlotId,
        requestedSlotName: requestedSlot?.name || '—',
        currentSeat: student.deskNumber,
        newSeat: null,
        effectiveDate: effectiveDate || todayISO(),
        feeDifference: Number(feeDifference) || 0,
        reason: reason || '',
        status: 'pending',
        requestedOn: todayISO(),
        history: [historyEntry('Requested', by, reason)],
      };

      mutate((draft) => {
        draft.shiftChanges = [request, ...draft.shiftChanges];
        appendAudit(draft, {
          action: 'shift_requested',
          entity: student.name,
          summary: `Requested ${request.currentSlotName} → ${request.requestedSlotName}`,
          before: request.currentSlotName,
          after: `${request.requestedSlotName} (pending)`,
        });
      });

      return request;
    }),

  /** Approve, reserving a specific seat for the effective date. */
  approveShiftChange: ({ requestId, newSeatId, note, by }) =>
    respond(() => {
      const state = getState();
      const request = state.shiftChanges.find((r) => r.id === requestId);
      if (!request) throw new Error('Request not found');
      if (request.status !== 'pending') throw new Error('Only pending requests can be approved');

      const student = state.students.find((s) => s.id === request.studentId);
      const targetSlot = state.slots.find((s) => s.id === request.requestedSlotId);
      const availableSeats = state.desks.filter((d) => d.status === 'available');
      const { allowed, blockers } = canApproveShiftChange({ targetSlot, availableSeats, student });
      if (!allowed) throw new Error(blockers[0]);

      const seat = newSeatId ? state.desks.find((d) => d.id === newSeatId) : null;
      if (newSeatId && !seat) throw new Error('Selected seat not found');
      if (seat && seat.status !== 'available') throw new Error(`Seat ${seat.number} is no longer available`);

      mutate((draft) => {
        draft.shiftChanges = draft.shiftChanges.map((r) =>
          r.id === requestId
            ? { ...r, status: 'approved', newSeat: seat ? seat.number : r.newSeat, newSeatId: seat ? seat.id : null, history: [...r.history, historyEntry('Approved', by, note)] }
            : r,
        );
        if (seat) {
          draft.desks = draft.desks.map((d) => (d.id === seat.id ? { ...d, override: 'reserved' } : d));
        }
        appendAudit(draft, {
          action: 'shift_approved',
          entity: request.studentName,
          summary: `Approved ${request.currentSlotName} → ${request.requestedSlotName}${seat ? `, seat ${seat.number} held` : ''}`,
          before: 'Pending',
          after: 'Approved',
        });
      });

      return { seatNumber: seat?.number || null };
    }),

  rejectShiftChange: ({ requestId, note, by }) =>
    respond(() => {
      const request = getState().shiftChanges.find((r) => r.id === requestId);
      if (!request) throw new Error('Request not found');
      if (request.status !== 'pending') throw new Error('Only pending requests can be rejected');

      mutate((draft) => {
        draft.shiftChanges = draft.shiftChanges.map((r) =>
          r.id === requestId ? { ...r, status: 'rejected', history: [...r.history, historyEntry('Rejected', by, note)] } : r,
        );
        appendAudit(draft, {
          action: 'shift_rejected',
          entity: request.studentName,
          summary: `Rejected ${request.currentSlotName} → ${request.requestedSlotName}${note ? ` — ${note}` : ''}`,
          before: 'Pending',
          after: 'Rejected',
        });
      });

      return true;
    }),

  /**
   * Finalise an approved request:
   *   old seat freed → new seat assigned → shift updated →
   *   fee difference applied → history recorded.
   */
  completeShiftChange: ({ requestId, newSeatId, by }) =>
    respond(() => {
      const state = getState();
      const request = state.shiftChanges.find((r) => r.id === requestId);
      if (!request) throw new Error('Request not found');
      if (request.status !== 'approved') throw new Error('Approve the request before completing it');

      const student = state.students.find((s) => s.id === request.studentId);
      if (!student) throw new Error('Student not found');

      const seatId = newSeatId || request.newSeatId;
      const seat = seatId ? state.desks.find((d) => d.id === seatId) : null;
      if (!seat) throw new Error('Select the seat to move the student to');
      if (seat.studentId && seat.studentId !== student.id) throw new Error(`Seat ${seat.number} is taken`);

      const targetSlot = state.slots.find((s) => s.id === request.requestedSlotId);
      const oldSeatNumber = student.deskNumber;
      const oldSlotName = student.slotName;

      mutate((draft) => {
        // Free the old seat, take the new one.
        draft.desks = draft.desks.map((d) => {
          if (student.deskId && d.id === student.deskId && d.id !== seat.id) return { ...d, studentId: null, slotId: null, temporary: null };
          if (d.id === seat.id) return { ...d, studentId: student.id, slotId: targetSlot.id, override: null };
          return d;
        });

        draft.students = draft.students.map((s) =>
          s.id === student.id
            ? {
                ...s,
                deskId: seat.id,
                deskNumber: seat.number,
                slotId: targetSlot.id,
                slotName: targetSlot.name,
                outstanding: request.feeDifference > 0 ? (s.outstanding || 0) + request.feeDifference : s.outstanding,
              }
            : s,
        );

        draft.shiftChanges = draft.shiftChanges.map((r) =>
          r.id === requestId
            ? { ...r, status: 'completed', newSeat: seat.number, currentSeat: oldSeatNumber, history: [...r.history, historyEntry('Completed', by, `Seat ${oldSeatNumber || '—'} released, ${seat.number} assigned`)] }
            : r,
        );

        draft.assignmentHistory = [
          {
            id: nextId('asg'),
            studentId: student.id,
            studentName: student.name,
            type: 'transferred',
            fromSeat: oldSeatNumber,
            toSeat: seat.number,
            date: todayISO(),
            time: nowTime(),
            by: by || 'Rajesh Kumar',
            note: `Shift change ${oldSlotName} → ${targetSlot.name}`,
          },
          ...draft.assignmentHistory,
        ];

        appendAudit(draft, {
          action: 'shift_changed',
          entity: student.name,
          summary: `Shift changed ${oldSlotName} → ${targetSlot.name}, seat ${oldSeatNumber || '—'} → ${seat.number}`,
          before: `${oldSlotName} / ${oldSeatNumber || 'No seat'}`,
          after: `${targetSlot.name} / ${seat.number}`,
        });

        if (request.feeDifference > 0) {
          appendAudit(draft, {
            action: 'outstanding_adjusted',
            entity: student.name,
            summary: `Shift upgrade fee ${formatCurrency(request.feeDifference)} added`,
            before: formatCurrency(student.outstanding),
            after: formatCurrency((student.outstanding || 0) + request.feeDifference),
          });
        }
      });

      return { from: oldSeatNumber, to: seat.number, shift: targetSlot.name, feeDifference: request.feeDifference };
    }),

  // ── Direct seat / shift operations ─────────────────────────

  /** Change a student's shift immediately, without a request. */
  changeShift: ({ studentId, slotId, newSeatId, reason = '', by }) =>
    respond(() => {
      const state = getState();
      const student = state.students.find((s) => s.id === studentId);
      const slot = state.slots.find((s) => s.id === slotId);
      if (!student) throw new Error('Student not found');
      if (!slot) throw new Error('Select a shift');

      const seat = newSeatId ? state.desks.find((d) => d.id === newSeatId) : null;
      if (newSeatId && !seat) throw new Error('Seat not found');
      if (seat && seat.status !== 'available') throw new Error(`Seat ${seat.number} is not available`);

      const oldSlotName = student.slotName;
      const oldSeatNumber = student.deskNumber;

      mutate((draft) => {
        if (seat) {
          draft.desks = draft.desks.map((d) => {
            if (student.deskId && d.id === student.deskId) return { ...d, studentId: null, slotId: null, temporary: null };
            if (d.id === seat.id) return { ...d, studentId: student.id, slotId: slot.id };
            return d;
          });
        } else if (student.deskId) {
          draft.desks = draft.desks.map((d) => (d.id === student.deskId ? { ...d, slotId: slot.id } : d));
        }

        draft.students = draft.students.map((s) =>
          s.id === studentId
            ? { ...s, slotId: slot.id, slotName: slot.name, deskId: seat ? seat.id : s.deskId, deskNumber: seat ? seat.number : s.deskNumber }
            : s,
        );

        draft.assignmentHistory = [
          {
            id: nextId('asg'),
            studentId,
            studentName: student.name,
            type: seat ? 'transferred' : 'shift_changed',
            fromSeat: oldSeatNumber,
            toSeat: seat ? seat.number : oldSeatNumber,
            date: todayISO(),
            time: nowTime(),
            by: by || 'Rajesh Kumar',
            note: reason || `Shift ${oldSlotName} → ${slot.name}`,
          },
          ...draft.assignmentHistory,
        ];

        appendAudit(draft, {
          action: 'shift_changed',
          entity: student.name,
          summary: `Shift changed ${oldSlotName} → ${slot.name}${seat ? `, seat ${oldSeatNumber || '—'} → ${seat.number}` : ''}`,
          before: oldSlotName,
          after: slot.name,
        });
      });

      return { shift: slot.name, seat: seat?.number || oldSeatNumber };
    }),

  getAssignmentHistory: (filters = {}) =>
    respond(() => {
      let list = [...getState().assignmentHistory];
      if (filters.studentId) list = list.filter((h) => h.studentId === filters.studentId);
      if (filters.seatNumber) list = list.filter((h) => h.fromSeat === filters.seatNumber || h.toSeat === filters.seatNumber);
      if (filters.type && filters.type !== 'all') list = list.filter((h) => h.type === filters.type);
      return list;
    }),

  // ── Waitlist ───────────────────────────────────────────────
  getWaitlist: (filters = {}) =>
    respond(() => {
      let list = [...getState().waitlist];
      if (filters.slotId && filters.slotId !== 'all') list = list.filter((w) => w.preferredSlotId === filters.slotId);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((w) => w.name.toLowerCase().includes(q) || w.phone.includes(q));
      }
      return list.sort((a, b) => a.addedOn.localeCompare(b.addedOn));
    }),

  getWaitlistForSlot: (slotId) => respond(() => getState().waitlist.filter((w) => w.preferredSlotId === slotId)),

  addToWaitlist: ({ name, phone, preferredSlotId, preferredSection, exam, note, priority = 'normal' }) =>
    respond(() => {
      const slot = getState().slots.find((s) => s.id === preferredSlotId);
      if (!name?.trim()) throw new Error('Name is required');
      if (!phone?.trim()) throw new Error('Phone is required');

      const entry = {
        id: nextId('wait'),
        name: name.trim(),
        phone: phone.trim(),
        preferredSlotId,
        preferredSlotName: slot?.name || '—',
        preferredSection: preferredSection || 'Any',
        addedOn: todayISO(),
        exam: exam || '',
        note: note || '',
        priority,
      };

      mutate((draft) => {
        draft.waitlist = [...draft.waitlist, entry];
        appendAudit(draft, { action: 'waitlist_added', entity: entry.name, summary: `Added to waitlist for ${entry.preferredSlotName} shift`, before: '—', after: 'Waitlisted' });
      });

      return entry;
    }),

  removeFromWaitlist: ({ id, reason = '' }) =>
    respond(() => {
      const entry = getState().waitlist.find((w) => w.id === id);
      if (!entry) throw new Error('Waitlist entry not found');
      mutate((draft) => {
        draft.waitlist = draft.waitlist.filter((w) => w.id !== id);
        appendAudit(draft, { action: 'waitlist_removed', entity: entry.name, summary: reason || 'Removed from waitlist', before: 'Waitlisted', after: 'Removed' });
      });
      return true;
    }),

  /** How many people are waiting for a seat in a given shift. */
  getWaitingCount: (slotId) => getState().waitlist.filter((w) => w.preferredSlotId === slotId).length,
};

export default assignmentService;
