// ============================================================
// OPERATIONS SERVICES
// Maintenance, expenses, slots and notifications.
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import { todayISO, formatCurrency } from './businessRules';

// ── Maintenance ──────────────────────────────────────────────
export const maintenanceService = {
  getIssues: (filters = {}) =>
    respond(() => {
      let list = [...getState().maintenance];
      if (filters.status && filters.status !== 'all') list = list.filter((m) => m.status === filters.status);
      if (filters.priority && filters.priority !== 'all') list = list.filter((m) => m.priority === filters.priority);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((m) => m.issue.toLowerCase().includes(q) || m.deskNumber.toLowerCase().includes(q));
      }
      return list.sort((a, b) => b.reportedDate.localeCompare(a.reportedDate));
    }),

  getSummary: () =>
    respond(() => {
      const { maintenance } = getState();
      return {
        open: maintenance.filter((m) => m.status === 'open').length,
        inProgress: maintenance.filter((m) => m.status === 'in_progress').length,
        resolved: maintenance.filter((m) => m.status === 'resolved').length,
        highPriority: maintenance.filter((m) => m.status !== 'resolved' && (m.priority === 'high' || m.priority === 'critical')).length,
      };
    }),

  reportIssue: ({ deskNumber, issue, priority = 'medium', assignedStaff = '', blocksSeat = false }) =>
    respond(() => {
      if (!deskNumber?.trim()) throw new Error('Seat or area is required');
      if (!issue?.trim()) throw new Error('Describe the issue');

      const record = {
        id: nextId('maint'),
        deskNumber: deskNumber.trim(),
        issue: issue.trim(),
        priority,
        status: 'open',
        reportedDate: todayISO(),
        reportedBy: 'Rajesh Kumar',
        expectedResolution: '',
        assignedStaff,
        resolvedDate: null,
        blocksSeat,
        notes: '',
      };

      mutate((draft) => {
        draft.maintenance = [record, ...draft.maintenance];
        if (blocksSeat) {
          draft.desks = draft.desks.map((d) => (d.number === record.deskNumber && !d.studentId ? { ...d, override: 'maintenance' } : d));
        }
        appendAudit(draft, {
          action: 'maintenance_reported',
          entity: `Seat ${record.deskNumber}`,
          summary: `${record.issue} (${priority})`,
          before: '—',
          after: 'Open',
        });
      });

      return record;
    }),

  updateStatus: ({ id, status, note = '' }) =>
    respond(() => {
      const issue = getState().maintenance.find((m) => m.id === id);
      if (!issue) throw new Error('Issue not found');

      mutate((draft) => {
        draft.maintenance = draft.maintenance.map((m) =>
          m.id === id ? { ...m, status, resolvedDate: status === 'resolved' ? todayISO() : null, notes: note || m.notes } : m,
        );
        if (status === 'resolved' && issue.blocksSeat) {
          draft.desks = draft.desks.map((d) => (d.number === issue.deskNumber && d.override === 'maintenance' ? { ...d, override: null } : d));
        }
        appendAudit(draft, {
          action: status === 'resolved' ? 'maintenance_resolved' : 'maintenance_updated',
          entity: `Seat ${issue.deskNumber}`,
          summary: status === 'resolved' ? `Resolved — ${issue.issue}` : `Marked ${status.replace('_', ' ')}`,
          before: issue.status,
          after: status,
        });
      });

      return true;
    }),

  assignStaff: ({ id, staff }) =>
    respond(() => {
      mutate((draft) => {
        draft.maintenance = draft.maintenance.map((m) => (m.id === id ? { ...m, assignedStaff: staff } : m));
      });
      return true;
    }),
};

// ── Expenses ─────────────────────────────────────────────────
export const expenseService = {
  getExpenses: (filters = {}) =>
    respond(() => {
      let list = [...getState().expenses];
      if (filters.category && filters.category !== 'all') list = list.filter((e) => e.category === filters.category);
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter((e) => e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
      }
      if (filters.from) list = list.filter((e) => e.date >= filters.from);
      if (filters.to) list = list.filter((e) => e.date <= filters.to);
      return list.sort((a, b) => b.date.localeCompare(a.date));
    }),

  addExpense: ({ category, description, amount, date, paymentMethod, notes }) =>
    respond(() => {
      if (!description?.trim()) throw new Error('Description is required');
      const value = Number(amount);
      if (!value || value <= 0) throw new Error('Enter a valid amount');

      const record = {
        id: nextId('exp'),
        category,
        description: description.trim(),
        amount: value,
        date: date || todayISO(),
        paymentMethod: paymentMethod || 'Cash',
        addedBy: 'Rajesh Kumar',
        receipt: null,
        notes: notes || '',
      };

      mutate((draft) => {
        draft.expenses = [record, ...draft.expenses];
        appendAudit(draft, { action: 'expense_added', entity: category, summary: `${description} — ${formatCurrency(value)}`, before: '—', after: formatCurrency(value) });
      });

      return record;
    }),

  deleteExpense: ({ id }) =>
    respond(() => {
      const expense = getState().expenses.find((e) => e.id === id);
      if (!expense) throw new Error('Expense not found');
      mutate((draft) => {
        draft.expenses = draft.expenses.filter((e) => e.id !== id);
        appendAudit(draft, { action: 'expense_deleted', entity: expense.category, summary: `Removed ${expense.description}`, before: formatCurrency(expense.amount), after: '—' });
      });
      return true;
    }),
};

// ── Slots ────────────────────────────────────────────────────
export const slotService = {
  getSlots: () => respond(() => getState().slots),

  saveSlot: ({ id, name, startTime, endTime, capacity }) =>
    respond(() => {
      if (!name?.trim()) throw new Error('Shift name is required');
      if (!startTime || !endTime) throw new Error('Start and end time are required');

      mutate((draft) => {
        if (id) {
          draft.slots = draft.slots.map((s) => (s.id === id ? { ...s, name, startTime, endTime, capacity: Number(capacity) } : s));
          appendAudit(draft, { action: 'slot_updated', entity: name, summary: `Shift updated — ${startTime} to ${endTime}`, before: '—', after: `${capacity} seats` });
        } else {
          draft.slots = [...draft.slots, { id: nextId('slot'), name, startTime, endTime, capacity: Number(capacity), assigned: 0, seated: 0, active: true }];
          appendAudit(draft, { action: 'slot_created', entity: name, summary: `Shift created — ${startTime} to ${endTime}`, before: '—', after: `${capacity} seats` });
        }
      });
      return true;
    }),

  toggleSlot: ({ id }) =>
    respond(() => {
      const slot = getState().slots.find((s) => s.id === id);
      if (!slot) throw new Error('Shift not found');
      if (slot.active && slot.assigned > 0) throw new Error(`${slot.name} has ${slot.assigned} students assigned — move them first`);
      mutate((draft) => {
        draft.slots = draft.slots.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
        appendAudit(draft, {
          action: 'slot_updated',
          entity: slot.name,
          summary: `Shift ${slot.active ? 'deactivated' : 'activated'}`,
          before: slot.active ? 'Active' : 'Inactive',
          after: slot.active ? 'Inactive' : 'Active',
        });
      });
      return true;
    }),
};

// ── Notifications ────────────────────────────────────────────
export const notificationService = {
  getNotifications: (filter = 'all') =>
    respond(() => {
      const { notifications } = getState();
      if (filter === 'unread') return notifications.filter((n) => !n.read);
      if (filter === 'read') return notifications.filter((n) => n.read);
      return notifications;
    }),

  getUnreadCount: () => getState().notifications.filter((n) => !n.read).length,

  markRead: ({ id }) =>
    respond(() => {
      mutate((draft) => {
        draft.notifications = draft.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      });
      return true;
    }),

  markAllRead: () =>
    respond(() => {
      mutate((draft) => {
        draft.notifications = draft.notifications.map((n) => ({ ...n, read: true }));
      });
      return true;
    }),

  dismiss: ({ id }) =>
    respond(() => {
      mutate((draft) => {
        draft.notifications = draft.notifications.filter((n) => n.id !== id);
      });
      return true;
    }),
};

export default { maintenanceService, expenseService, slotService, notificationService };
