// ============================================================
// STUDENT SERVICE
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import { todayISO, addDays, addMonths, isPotentiallyInactive } from './businessRules';

const sorters = {
  name: (a, b) => a.name.localeCompare(b.name),
  studentId: (a, b) => a.studentId.localeCompare(b.studentId),
  expiry: (a, b) => a.membershipExpiry.localeCompare(b.membershipExpiry),
  outstanding: (a, b) => a.outstanding - b.outstanding,
  attendance: (a, b) => a.attendanceRate - b.attendanceRate,
  joinDate: (a, b) => a.joinDate.localeCompare(b.joinDate),
};

export const studentService = {
  getStudents: (filters = {}) =>
    respond(() => {
      let list = [...getState().students];

      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.studentId.toLowerCase().includes(q) ||
            s.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
            (s.deskNumber || '').toLowerCase().includes(q),
        );
      }
      if (filters.status && filters.status !== 'all') list = list.filter((s) => s.status === filters.status);
      if (filters.membershipStatus && filters.membershipStatus !== 'all') list = list.filter((s) => s.membershipStatus === filters.membershipStatus);
      if (filters.paymentStatus && filters.paymentStatus !== 'all') list = list.filter((s) => s.paymentStatus === filters.paymentStatus);
      if (filters.slotId && filters.slotId !== 'all') list = list.filter((s) => s.slotId === filters.slotId);
      if (filters.planId && filters.planId !== 'all') list = list.filter((s) => s.membershipPlanId === filters.planId);
      if (filters.hasSeat === true) list = list.filter((s) => Boolean(s.deskId));
      if (filters.hasSeat === false) list = list.filter((s) => !s.deskId);

      if (filters.sortBy && sorters[filters.sortBy]) {
        list.sort(sorters[filters.sortBy]);
        if (filters.sortDir === 'desc') list.reverse();
      }

      return list;
    }),

  getStudentById: (id) => respond(() => getState().students.find((s) => s.id === id) || null),

  /** Students with a seat but no recent attendance — a real collection signal. */
  getPotentiallyInactive: () => respond(() => getState().students.filter(isPotentiallyInactive)),

  getStudentSummary: () =>
    respond(() => {
      const { students } = getState();
      return {
        total: students.length,
        active: students.filter((s) => s.status === 'active').length,
        onLeave: students.filter((s) => s.status === 'on_leave').length,
        inactive: students.filter((s) => s.status === 'inactive').length,
        presentToday: students.filter((s) => s.presentToday).length,
        withoutSeat: students.filter((s) => s.status === 'active' && !s.deskId).length,
      };
    }),

  createStudent: (form) =>
    respond(() => {
      const { students, membershipPlans, slots, desks } = getState();
      const plan = membershipPlans.find((p) => p.id === form.membershipPlanId);
      const slot = slots.find((s) => s.id === form.slotId);
      const seat = form.deskId ? desks.find((d) => d.id === form.deskId) : null;
      if (!plan) throw new Error('Select a membership plan');
      if (!slot) throw new Error('Select a shift');
      if (seat && seat.status !== 'available') throw new Error(`Seat ${seat.number} is no longer available`);

      const id = nextId('student');
      const maxNum = students.reduce((max, s) => {
        const n = Number(String(s.studentId).replace('SSC-', ''));
        return Number.isFinite(n) && n > max ? n : max;
      }, 1000);

      const today = todayISO();
      const expiry =
        plan.durationUnit === 'day' || plan.durationUnit === 'days'
          ? addDays(today, plan.duration)
          : addMonths(today, plan.duration);

      const student = {
        id,
        studentId: `SSC-${maxNum + 1}`,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        gender: form.gender || 'Male',
        email: form.email || '',
        phone: form.phone,
        address: form.address || '',
        city: form.city || 'Lucknow',
        pincode: form.pincode || '',
        emergencyName: form.emergencyName || '',
        emergencyContact: form.emergencyContact || '',
        exam: form.exam || '',
        photo: null,
        deskId: seat?.id || null,
        deskNumber: seat?.number || null,
        slotId: slot.id,
        slotName: slot.name,
        membershipPlanId: plan.id,
        membershipPlan: plan.name,
        planPrice: plan.price,
        membershipStart: today,
        membershipExpiry: expiry,
        membershipStatus: 'active',
        pausedDays: 0,
        feeDueDate: today,
        outstanding: plan.price,
        paymentStatus: 'due',
        totalPaid: 0,
        lastPaymentDate: null,
        lastPaymentAmount: null,
        status: 'active',
        joinDate: today,
        source: form.source || 'Walk-in',
        referredBy: form.referredBy || null,
        notes: form.notes ? [{ id: nextId('note'), text: form.notes, date: today, by: 'Rajesh Kumar' }] : [],
        documents: [],
        attendanceRate: 0,
        lastAttendanceDate: null,
        onLeave: false,
        leaveId: null,
        presentToday: false,
      };

      mutate((draft) => {
        draft.students = [student, ...draft.students];
        if (seat) {
          draft.desks = draft.desks.map((d) => (d.id === seat.id ? { ...d, studentId: id, slotId: slot.id } : d));
          draft.assignmentHistory = [
            { id: nextId('asg'), studentId: id, studentName: student.name, type: 'assigned', fromSeat: null, toSeat: seat.number, date: today, time: '', by: 'Rajesh Kumar', note: 'New admission' },
            ...draft.assignmentHistory,
          ];
        }
        appendAudit(draft, {
          action: 'student_created',
          entity: student.name,
          summary: `New admission — ${plan.name}, ${slot.name} shift${seat ? `, seat ${seat.number}` : ''}`,
          before: '—',
          after: 'Active',
        });
      });

      return student;
    }),

  updateStudent: ({ id, changes }) =>
    respond(() => {
      const student = getState().students.find((s) => s.id === id);
      if (!student) throw new Error('Student not found');

      mutate((draft) => {
        draft.students = draft.students.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...changes };
          if (changes.firstName || changes.lastName) next.name = `${next.firstName} ${next.lastName}`;
          return next;
        });
        appendAudit(draft, {
          action: 'student_updated',
          entity: student.name,
          summary: 'Student details updated',
          before: '—',
          after: Object.keys(changes).join(', '),
        });
      });

      return getState().students.find((s) => s.id === id);
    }),

  addNote: ({ studentId, text, by = 'Rajesh Kumar' }) =>
    respond(() => {
      if (!text?.trim()) throw new Error('Note cannot be empty');
      const note = { id: nextId('note'), text: text.trim(), date: todayISO(), by };
      mutate((draft) => {
        draft.students = draft.students.map((s) => (s.id === studentId ? { ...s, notes: [note, ...(s.notes || [])] } : s));
      });
      return note;
    }),

  deleteNote: ({ studentId, noteId }) =>
    respond(() => {
      mutate((draft) => {
        draft.students = draft.students.map((s) =>
          s.id === studentId ? { ...s, notes: (s.notes || []).filter((n) => n.id !== noteId) } : s,
        );
      });
      return true;
    }),

  setStatus: ({ studentId, status, reason = '' }) =>
    respond(() => {
      const student = getState().students.find((s) => s.id === studentId);
      if (!student) throw new Error('Student not found');
      mutate((draft) => {
        draft.students = draft.students.map((s) => (s.id === studentId ? { ...s, status } : s));
        appendAudit(draft, {
          action: 'student_status_changed',
          entity: student.name,
          summary: reason || `Status changed to ${status}`,
          before: student.status,
          after: status,
        });
      });
      return true;
    }),

  /** Everything one profile page needs, in a single call. */
  getStudentDetail: (id) =>
    respond(() => {
      const state = getState();
      const student = state.students.find((s) => s.id === id);
      if (!student) return null;
      return {
        student,
        attendance: state.attendance.filter((a) => a.studentId === id).sort((a, b) => (a.date < b.date ? 1 : -1)),
        payments: state.payments.filter((p) => p.studentId === id).sort((a, b) => (a.date < b.date ? 1 : -1)),
        leaves: state.leaves.filter((l) => l.studentId === id),
        shiftChanges: state.shiftChanges.filter((r) => r.studentId === id),
        seatHistory: state.assignmentHistory.filter((h) => h.studentId === id),
        activity: state.auditLog.filter((a) => a.entity === student.name),
        plan: state.membershipPlans.find((p) => p.id === student.membershipPlanId) || null,
        seat: student.deskId ? state.desks.find((d) => d.id === student.deskId) : null,
      };
    }),
};

export default studentService;
