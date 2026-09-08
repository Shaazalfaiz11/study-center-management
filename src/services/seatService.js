// ============================================================
// SEAT SERVICE
// Seat assignment, transfer, temporary release and reallocation.
//
// A temporary release is never a permanent reassignment: the
// original holder stays recorded on the seat throughout.
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import { todayISO, formatDate } from './businessRules';

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

const pushHistory = (draft, entry) => {
  draft.assignmentHistory = [
    { id: nextId('asg'), date: todayISO(), time: nowTime(), by: entry.by || 'Rajesh Kumar', ...entry },
    ...draft.assignmentHistory,
  ];
};

export const seatService = {
  // ── Reads ──────────────────────────────────────────────────
  getSeats: (filters = {}) =>
    respond(() => {
      const { desks } = getState();
      return desks.filter((seat) => {
        if (filters.floor && filters.floor !== 'all' && seat.floor !== Number(filters.floor)) return false;
        if (filters.section && filters.section !== 'all' && seat.section !== filters.section) return false;
        if (filters.status && filters.status !== 'all' && seat.status !== filters.status) return false;
        if (filters.slotId && filters.slotId !== 'all' && seat.slotId !== filters.slotId) return false;
        if (filters.search && !seat.number.toLowerCase().includes(String(filters.search).toLowerCase())) return false;
        return true;
      });
    }),

  getSeatById: (id) => respond(() => getState().desks.find((d) => d.id === id) || null),

  getSeatByNumber: (number) => respond(() => getState().desks.find((d) => d.number === number) || null),

  /** Seats that can take a new permanent assignment, optionally in one section. */
  getAvailableSeats: (opts = {}) =>
    respond(() => {
      let seats = getState().desks.filter((d) => d.status === 'available');
      if (opts.section && opts.section !== 'all') seats = seats.filter((d) => d.section === opts.section);
      if (opts.floor && opts.floor !== 'all') seats = seats.filter((d) => d.floor === Number(opts.floor));
      return seats;
    }),

  /** Seats freed up by a leave, offerable to someone else short term. */
  getTemporarilyReleasedSeats: () => respond(() => getState().desks.filter((d) => d.status === 'temporarily_released')),

  getSeatHistory: (seatNumber) =>
    respond(() => getState().assignmentHistory.filter((h) => h.fromSeat === seatNumber || h.toSeat === seatNumber)),

  getStudentSeatHistory: (studentId) =>
    respond(() => getState().assignmentHistory.filter((h) => h.studentId === studentId)),

  getSeatSummary: () =>
    respond(() => {
      const { desks } = getState();
      const count = (status) => desks.filter((d) => d.status === status).length;
      const total = desks.length;
      const inUse = count('assigned') + count('occupied');
      return {
        total,
        available: count('available'),
        assigned: count('assigned'),
        occupied: count('occupied'),
        reserved: count('reserved'),
        temporarilyReleased: count('temporarily_released'),
        maintenance: count('maintenance'),
        blocked: count('blocked'),
        occupancyRate: total ? Math.round((inUse / total) * 100) : 0,
      };
    }),

  // ── Writes ─────────────────────────────────────────────────

  /** Permanently assign a free seat to a student. */
  assignSeat: ({ studentId, seatId, slotId }) =>
    respond(() => {
      const { desks, students } = getState();
      const seat = desks.find((d) => d.id === seatId);
      const student = students.find((s) => s.id === studentId);
      if (!seat) throw new Error('Seat not found');
      if (!student) throw new Error('Student not found');
      if (seat.status !== 'available') throw new Error(`Seat ${seat.number} is not available`);

      mutate((draft) => {
        const targetSlot = slotId || student.slotId;
        draft.desks = draft.desks.map((d) =>
          d.id === seatId ? { ...d, studentId, slotId: targetSlot } : d,
        );
        draft.students = draft.students.map((s) =>
          s.id === studentId ? { ...s, deskId: seat.id, deskNumber: seat.number, slotId: targetSlot } : s,
        );
        pushHistory(draft, { studentId, studentName: student.name, type: 'assigned', fromSeat: null, toSeat: seat.number, note: '' });
        appendAudit(draft, {
          action: 'seat_assigned',
          entity: student.name,
          summary: `Seat ${seat.number} assigned`,
          before: 'No seat',
          after: seat.number,
        });
      });

      return { seatNumber: seat.number, studentName: student.name };
    }),

  /**
   * Move a student from their seat to another one.
   * Old seat becomes available, new seat becomes assigned,
   * and the move is written to assignment history.
   */
  transferSeat: ({ studentId, toSeatId, reason = '' }) =>
    respond(() => {
      const { desks, students } = getState();
      const student = students.find((s) => s.id === studentId);
      const target = desks.find((d) => d.id === toSeatId);
      if (!student) throw new Error('Student not found');
      if (!target) throw new Error('Target seat not found');
      if (target.status !== 'available') throw new Error(`Seat ${target.number} is not available`);

      const from = student.deskNumber;

      mutate((draft) => {
        draft.desks = draft.desks.map((d) => {
          if (d.id === student.deskId) return { ...d, studentId: null, slotId: null, temporary: null };
          if (d.id === toSeatId) return { ...d, studentId, slotId: student.slotId };
          return d;
        });
        draft.students = draft.students.map((s) =>
          s.id === studentId ? { ...s, deskId: target.id, deskNumber: target.number } : s,
        );
        pushHistory(draft, { studentId, studentName: student.name, type: 'transferred', fromSeat: from, toSeat: target.number, note: reason });
        appendAudit(draft, {
          action: 'seat_transferred',
          entity: student.name,
          summary: `Seat changed ${from || '—'} → ${target.number}`,
          before: from || 'No seat',
          after: target.number,
        });
      });

      return { from, to: target.number };
    }),

  /** Permanently give up a seat (expiry, cancellation, leaving the centre). */
  releaseSeat: ({ studentId, reason = '' }) =>
    respond(() => {
      const { students } = getState();
      const student = students.find((s) => s.id === studentId);
      if (!student || !student.deskId) throw new Error('Student has no seat to release');
      const seatNumber = student.deskNumber;

      mutate((draft) => {
        draft.desks = draft.desks.map((d) => (d.id === student.deskId ? { ...d, studentId: null, slotId: null, temporary: null } : d));
        draft.students = draft.students.map((s) => (s.id === studentId ? { ...s, deskId: null, deskNumber: null } : s));
        pushHistory(draft, { studentId, studentName: student.name, type: 'released', fromSeat: seatNumber, toSeat: null, note: reason });
        appendAudit(draft, {
          action: 'seat_released',
          entity: student.name,
          summary: `Seat ${seatNumber} released`,
          before: seatNumber,
          after: 'No seat',
        });
      });

      return { seatNumber };
    }),

  /**
   * Temporarily release a seat while its holder is away.
   * The holder stays on the seat record — this is not a reassignment.
   */
  releaseTemporarily: ({ studentId, from, to, reason = '', leaveId = null }) =>
    respond(() => {
      const { students } = getState();
      const student = students.find((s) => s.id === studentId);
      if (!student || !student.deskId) throw new Error('Student has no seat to release');
      const seatNumber = student.deskNumber;

      mutate((draft) => {
        draft.desks = draft.desks.map((d) =>
          d.id === student.deskId
            ? { ...d, temporary: { holderStudentId: studentId, tempStudentId: null, from, to, reason, leaveId } }
            : d,
        );
        pushHistory(draft, {
          studentId,
          studentName: student.name,
          type: 'temp_released',
          fromSeat: seatNumber,
          toSeat: null,
          note: `Temporarily released ${formatDate(from)} → ${formatDate(to)}`,
        });
        appendAudit(draft, {
          action: 'seat_temp_released',
          entity: student.name,
          summary: `Seat ${seatNumber} temporarily released until ${formatDate(to)}`,
          before: 'Assigned',
          after: 'Temporarily Released',
        });
      });

      return { seatNumber };
    }),

  /** Offer a temporarily released seat to another student until the holder returns. */
  reallocateTemporarily: ({ seatId, tempStudentId, until }) =>
    respond(() => {
      const { desks, students } = getState();
      const seat = desks.find((d) => d.id === seatId);
      const tempStudent = students.find((s) => s.id === tempStudentId);
      if (!seat) throw new Error('Seat not found');
      if (!seat.temporary) throw new Error('This seat is not temporarily released');
      if (!tempStudent) throw new Error('Student not found');
      if (tempStudent.deskId) throw new Error(`${tempStudent.name} already holds seat ${tempStudent.deskNumber}`);

      const holder = students.find((s) => s.id === seat.temporary.holderStudentId);

      mutate((draft) => {
        draft.desks = draft.desks.map((d) =>
          d.id === seatId ? { ...d, temporary: { ...d.temporary, tempStudentId, to: until || d.temporary.to } } : d,
        );
        pushHistory(draft, {
          studentId: tempStudentId,
          studentName: tempStudent.name,
          type: 'temp_allocated',
          fromSeat: null,
          toSeat: seat.number,
          note: `Temporary use until ${formatDate(until || seat.temporary.to)} — held by ${holder?.name || 'original holder'}`,
        });
        appendAudit(draft, {
          action: 'seat_temp_allocated',
          entity: tempStudent.name,
          summary: `Seat ${seat.number} temporarily allocated (held by ${holder?.name || 'original holder'})`,
          before: 'Temporarily Released',
          after: `Temp: ${tempStudent.name}`,
        });
      });

      return { seatNumber: seat.number, tempStudentName: tempStudent.name };
    }),

  /** Take back a temporary allocation without disturbing the original holder. */
  endTemporaryAllocation: ({ seatId }) =>
    respond(() => {
      const { desks, students } = getState();
      const seat = desks.find((d) => d.id === seatId);
      if (!seat?.temporary?.tempStudentId) throw new Error('No temporary allocation on this seat');
      const tempStudent = students.find((s) => s.id === seat.temporary.tempStudentId);

      mutate((draft) => {
        draft.desks = draft.desks.map((d) => (d.id === seatId ? { ...d, temporary: { ...d.temporary, tempStudentId: null } } : d));
        appendAudit(draft, {
          action: 'seat_temp_ended',
          entity: tempStudent?.name || seat.number,
          summary: `Temporary allocation of ${seat.number} ended`,
          before: `Temp: ${tempStudent?.name || '—'}`,
          after: 'Temporarily Released',
        });
      });

      return { seatNumber: seat.number };
    }),

  /** Hold the seat empty for the holder rather than offering it out. */
  keepReserved: ({ seatId }) =>
    respond(() => {
      const { desks, students } = getState();
      const seat = desks.find((d) => d.id === seatId);
      if (!seat?.temporary) throw new Error('This seat is not temporarily released');
      const holder = students.find((s) => s.id === seat.temporary.holderStudentId);

      mutate((draft) => {
        draft.desks = draft.desks.map((d) => (d.id === seatId ? { ...d, temporary: { ...d.temporary, keepReserved: true, tempStudentId: null } } : d));
        appendAudit(draft, {
          action: 'seat_kept_reserved',
          entity: holder?.name || seat.number,
          summary: `Seat ${seat.number} kept reserved for the holder`,
          before: 'Temporarily Released',
          after: 'Held for holder',
        });
      });

      return { seatNumber: seat.number };
    }),

  /** Return a seat to its holder when leave ends. */
  restoreSeat: ({ studentId }) =>
    respond(() => {
      const { desks, students } = getState();
      const student = students.find((s) => s.id === studentId);
      const seat = desks.find((d) => d.temporary?.holderStudentId === studentId);
      if (!student) throw new Error('Student not found');
      if (!seat) return { seatNumber: student.deskNumber };

      mutate((draft) => {
        draft.desks = draft.desks.map((d) => (d.id === seat.id ? { ...d, temporary: null } : d));
        pushHistory(draft, { studentId, studentName: student.name, type: 'resumed', fromSeat: null, toSeat: seat.number, note: 'Returned from leave' });
        appendAudit(draft, {
          action: 'seat_restored',
          entity: student.name,
          summary: `Seat ${seat.number} returned to holder`,
          before: 'Temporarily Released',
          after: 'Assigned',
        });
      });

      return { seatNumber: seat.number };
    }),

  /** Admin override: maintenance / blocked / reserved / clear. */
  setSeatStatus: ({ seatId, override, note = '' }) =>
    respond(() => {
      const { desks } = getState();
      const seat = desks.find((d) => d.id === seatId);
      if (!seat) throw new Error('Seat not found');
      if (override && seat.studentId) throw new Error(`Seat ${seat.number} is assigned — release it first`);

      const before = seat.status;

      mutate((draft) => {
        draft.desks = draft.desks.map((d) => (d.id === seatId ? { ...d, override: override || null } : d));
        appendAudit(draft, {
          action: override ? `seat_${override}` : 'seat_available',
          entity: `Seat ${seat.number}`,
          summary: note || `Seat ${seat.number} marked ${override || 'available'}`,
          before,
          after: override || 'available',
        });
      });

      return { seatNumber: seat.number, override };
    }),

  createSeat: ({ number, floor, section }) =>
    respond(() => {
      const { desks, floors } = getState();
      if (desks.some((d) => d.number.toLowerCase() === String(number).toLowerCase())) {
        throw new Error(`Seat ${number} already exists`);
      }
      const floorMeta = floors.find((f) => f.id === Number(floor));
      const seat = {
        id: nextId('seat'),
        number,
        floor: Number(floor),
        floorName: floorMeta?.name || `Floor ${floor}`,
        section,
        zone: '',
        position: desks.filter((d) => d.section === section).length + 1,
        studentId: null,
        slotId: null,
        override: null,
        temporary: null,
        lastUsed: null,
        status: 'available',
      };
      mutate((draft) => {
        draft.desks = [...draft.desks, seat];
        appendAudit(draft, { action: 'seat_created', entity: `Seat ${number}`, summary: `Seat ${number} added to ${seat.floorName}`, before: '—', after: 'Available' });
      });
      return seat;
    }),

  updateSeat: ({ seatId, number, floor, section }) =>
    respond(() => {
      const { floors } = getState();
      const floorMeta = floors.find((f) => f.id === Number(floor));
      mutate((draft) => {
        draft.desks = draft.desks.map((d) =>
          d.id === seatId ? { ...d, number, floor: Number(floor), floorName: floorMeta?.name || d.floorName, section } : d,
        );
        appendAudit(draft, { action: 'seat_updated', entity: `Seat ${number}`, summary: `Seat ${number} details updated`, before: '—', after: number });
      });
      return true;
    }),
};

export default seatService;
