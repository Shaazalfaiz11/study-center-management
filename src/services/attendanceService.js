// ============================================================
// ATTENDANCE SERVICE
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import { todayISO } from './businessRules';

const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();

export const attendanceService = {
  getAttendance: (filters = {}) =>
    respond(() => {
      let list = [...getState().attendance];
      if (filters.date) list = list.filter((a) => a.date === filters.date);
      if (filters.from) list = list.filter((a) => a.date >= filters.from);
      if (filters.to) list = list.filter((a) => a.date <= filters.to);
      if (filters.slotId && filters.slotId !== 'all') list = list.filter((a) => a.slotId === filters.slotId);
      if (filters.status && filters.status !== 'all') list = list.filter((a) => a.status === filters.status);
      if (filters.studentId) list = list.filter((a) => a.studentId === filters.studentId);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((a) => a.studentName.toLowerCase().includes(q) || (a.deskNumber || '').toLowerCase().includes(q));
      }
      return list;
    }),

  getTodayAttendance: (filters = {}) =>
    respond(() => {
      const today = todayISO();
      let list = getState().attendance.filter((a) => a.date === today);
      if (filters.slotId && filters.slotId !== 'all') list = list.filter((a) => a.slotId === filters.slotId);
      if (filters.status && filters.status !== 'all') list = list.filter((a) => a.status === filters.status);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((a) => a.studentName.toLowerCase().includes(q) || (a.deskNumber || '').toLowerCase().includes(q));
      }
      return list;
    }),

  getAttendanceSummary: (date = todayISO()) =>
    respond(() => {
      const records = getState().attendance.filter((a) => a.date === date);
      const count = (s) => records.filter((r) => r.status === s).length;
      const present = count('present') + count('late');
      return {
        date,
        total: records.length,
        present,
        absent: count('absent'),
        late: count('late'),
        leave: count('leave'),
        checkedIn: records.filter((r) => r.checkIn).length,
        checkedOut: records.filter((r) => r.checkOut).length,
        rate: records.length ? Math.round((present / records.length) * 100) : 0,
      };
    }),

  getSlotAttendance: (date = todayISO()) =>
    respond(() => {
      const state = getState();
      const records = state.attendance.filter((a) => a.date === date);
      return state.slots
        .filter((s) => s.active)
        .map((slot) => {
          const slotRecords = records.filter((r) => r.slotId === slot.id);
          const present = slotRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
          return {
            slotId: slot.id,
            name: slot.name,
            capacity: slot.capacity,
            assigned: slot.assigned,
            seated: slot.seated,
            present,
            total: slotRecords.length,
            occupancy: slot.capacity ? Math.round((slot.assigned / slot.capacity) * 100) : 0,
            attendanceRate: slotRecords.length ? Math.round((present / slotRecords.length) * 100) : 0,
          };
        });
    }),

  getMonthlyOverview: (monthISO) =>
    respond(() => {
      const [year, month] = monthISO.split('-').map(Number);
      const days = new Date(year, month, 0).getDate();
      const records = getState().attendance;
      return Array.from({ length: days }, (_, i) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const dayRecords = records.filter((a) => a.date === date);
        const present = dayRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
        return { date, day: i + 1, weekday: new Date(year, month - 1, i + 1).getDay(), present, total: dayRecords.length };
      });
    }),

  markAttendance: ({ recordId, status }) =>
    respond(() => {
      const record = getState().attendance.find((a) => a.id === recordId);
      if (!record) throw new Error('Attendance record not found');
      mutate((draft) => {
        draft.attendance = draft.attendance.map((a) =>
          a.id === recordId
            ? { ...a, status, checkIn: status === 'present' || status === 'late' ? a.checkIn || nowTime() : null, checkOut: status === 'absent' || status === 'leave' ? null : a.checkOut, markedBy: 'Manual' }
            : a,
        );
      });
      return true;
    }),

  checkIn: ({ recordId, studentId }) =>
    respond(() => {
      const state = getState();
      const today = todayISO();
      let record = recordId ? state.attendance.find((a) => a.id === recordId) : state.attendance.find((a) => a.studentId === studentId && a.date === today);

      if (record) {
        mutate((draft) => {
          draft.attendance = draft.attendance.map((a) => (a.id === record.id ? { ...a, checkIn: nowTime(), status: 'present', markedBy: 'Manual' } : a));
        });
        return { studentName: record.studentName };
      }

      const student = state.students.find((s) => s.id === studentId);
      if (!student) throw new Error('Student not found');
      const created = {
        id: nextId('att'),
        studentId: student.id,
        studentName: student.name,
        studentIdNum: student.studentId,
        deskNumber: student.deskNumber,
        slotId: student.slotId,
        slotName: student.slotName,
        date: today,
        checkIn: nowTime(),
        checkOut: null,
        status: 'present',
        markedBy: 'Manual',
      };
      mutate((draft) => {
        draft.attendance = [...draft.attendance, created];
      });
      return { studentName: student.name };
    }),

  checkOut: ({ recordId }) =>
    respond(() => {
      const record = getState().attendance.find((a) => a.id === recordId);
      if (!record) throw new Error('Attendance record not found');
      mutate((draft) => {
        draft.attendance = draft.attendance.map((a) => (a.id === recordId ? { ...a, checkOut: nowTime() } : a));
      });
      return { studentName: record.studentName };
    }),

  bulkMark: ({ recordIds, status }) =>
    respond(() => {
      const ids = new Set(recordIds);
      mutate((draft) => {
        draft.attendance = draft.attendance.map((a) =>
          ids.has(a.id) ? { ...a, status, checkIn: status === 'present' ? a.checkIn || nowTime() : a.checkIn } : a,
        );
        appendAudit(draft, {
          action: 'attendance_marked',
          entity: `${ids.size} students`,
          summary: `Bulk marked ${status}`,
          before: '—',
          after: `${ids.size} records`,
        });
      });
      return { count: ids.size };
    }),
};

export default attendanceService;
