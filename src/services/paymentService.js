// ============================================================
// PAYMENT SERVICE
// Payments, invoices, outstanding dues and the collection queue.
// ============================================================

import { getState, mutate, respond, nextId } from './store';
import { appendAudit } from './auditService';
import { todayISO, formatCurrency, formatDate, daysUntil, applyPayment, daysOverdue } from './businessRules';

const receiptNumber = (seq) => `RCP-${String(2400 + seq).padStart(5, '0')}`;
const invoiceNumberFor = (seq) => `INV-${String(2400 + seq).padStart(5, '0')}`;

/** One row of the daily collection worklist. */
const toCollectionRow = (student) => {
  const dueDate = student.feeDueDate || student.membershipExpiry;
  return {
    id: student.id,
    studentId: student.id,
    studentIdNum: student.studentId,
    name: student.name,
    firstName: student.firstName,
    phone: student.phone,
    membershipPlan: student.membershipPlan,
    membershipPlanId: student.membershipPlanId,
    amount: student.outstanding,
    planPrice: student.planPrice,
    dueDate,
    daysOverdue: daysOverdue(student),
    daysUntilDue: daysUntil(dueDate),
    lastPaymentDate: student.lastPaymentDate,
    lastPaymentAmount: student.lastPaymentAmount,
    membershipExpiry: student.membershipExpiry,
    daysToExpiry: daysUntil(student.membershipExpiry),
    membershipStatus: student.membershipStatus,
    paymentStatus: student.paymentStatus,
    deskNumber: student.deskNumber,
    slotName: student.slotName,
    reminderSentOn: student.reminderSentOn || null,
  };
};

export const paymentService = {
  // ── Payments ───────────────────────────────────────────────
  getPayments: (filters = {}) =>
    respond(() => {
      let list = [...getState().payments];
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter(
          (p) =>
            p.studentName.toLowerCase().includes(q) ||
            p.receiptNumber.toLowerCase().includes(q) ||
            p.studentIdNum.toLowerCase().includes(q) ||
            (p.transactionId || '').toLowerCase().includes(q),
        );
      }
      if (filters.method && filters.method !== 'all') list = list.filter((p) => p.method === filters.method);
      if (filters.status && filters.status !== 'all') list = list.filter((p) => p.status === filters.status);
      if (filters.from) list = list.filter((p) => p.date >= filters.from);
      if (filters.to) list = list.filter((p) => p.date <= filters.to);
      if (filters.studentId) list = list.filter((p) => p.studentId === filters.studentId);
      return list;
    }),

  getPaymentById: (id) => respond(() => getState().payments.find((p) => p.id === id) || null),

  getInvoices: (filters = {}) =>
    respond(() => {
      let list = getState().payments.filter((p) => p.status === 'completed');
      if (filters.search) {
        const q = String(filters.search).toLowerCase();
        list = list.filter(
          (p) => p.studentName.toLowerCase().includes(q) || (p.invoiceNumber || '').toLowerCase().includes(q) || p.receiptNumber.toLowerCase().includes(q),
        );
      }
      return list;
    }),

  getTodayCollection: () =>
    respond(() => {
      const today = todayISO();
      const payments = getState().payments.filter((p) => p.date === today && p.status === 'completed');
      return { count: payments.length, total: payments.reduce((sum, p) => sum + p.amount, 0), payments };
    }),

  getRevenueSummary: () =>
    respond(() => {
      const { payments, expenses, students } = getState();
      const now = new Date();
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const today = todayISO();

      const monthly = payments.filter((p) => p.status === 'completed' && p.date.startsWith(monthPrefix));
      const monthlyExpenses = expenses.filter((e) => e.date.startsWith(monthPrefix));

      return {
        todayCollected: payments.filter((p) => p.date === today && p.status === 'completed').reduce((s, p) => s + p.amount, 0),
        monthlyRevenue: monthly.reduce((s, p) => s + p.amount, 0),
        monthlyExpenses: monthlyExpenses.reduce((s, e) => s + e.amount, 0),
        totalOutstanding: students.reduce((s, st) => s + (st.outstanding || 0), 0),
        overdueCount: students.filter((s) => s.paymentStatus === 'overdue').length,
        dueTodayCount: students.filter((s) => s.paymentStatus === 'due').length,
        paymentCount: monthly.length,
      };
    }),

  /**
   * Record a payment. Reduces the student's outstanding amount and,
   * when the balance clears, marks the fee as paid.
   */
  recordPayment: ({ studentId, amount, method = 'Cash', transactionId = '', notes = '', date = todayISO(), type = 'membership' }) =>
    respond(() => {
      const state = getState();
      const student = state.students.find((s) => s.id === studentId);
      if (!student) throw new Error('Select a student');
      const value = Number(amount);
      if (!value || value <= 0) throw new Error('Enter a valid amount');

      const seq = state.payments.length + 1;
      const payment = {
        id: nextId('pay'),
        receiptNumber: receiptNumber(seq),
        invoiceNumber: invoiceNumberFor(seq),
        studentId: student.id,
        studentName: student.name,
        studentIdNum: student.studentId,
        amount: value,
        method,
        date,
        status: 'completed',
        membershipPlan: student.membershipPlan,
        membershipPlanId: student.membershipPlanId,
        periodStart: student.membershipStart,
        periodEnd: student.membershipExpiry,
        transactionId: transactionId || `TXN${String(100000 + Math.floor(Math.random() * 899999))}`,
        collectedBy: 'Rajesh Kumar',
        notes,
        type,
      };

      const before = student.outstanding;
      const after = type === 'membership' ? applyPayment(before, value) : before;

      mutate((draft) => {
        draft.payments = [payment, ...draft.payments];
        draft.students = draft.students.map((s) => (s.id === studentId ? { ...s, outstanding: after } : s));
        appendAudit(draft, {
          action: 'payment_recorded',
          entity: student.name,
          summary: `${formatCurrency(value)} received via ${method}`,
          before: `Outstanding ${formatCurrency(before)}`,
          after: `Outstanding ${formatCurrency(after)}`,
        });
      });

      return payment;
    }),

  // ── Outstanding / collection queue ─────────────────────────
  getOutstandingPayments: () =>
    respond(() =>
      getState()
        .students.filter((s) => (s.outstanding || 0) > 0)
        .map(toCollectionRow)
        .sort((a, b) => b.daysOverdue - a.daysOverdue || a.dueDate.localeCompare(b.dueDate)),
    ),

  /**
   * The daily working list: what to chase today, split into the
   * three buckets a front desk actually works through.
   */
  getCollectionQueue: () =>
    respond(() => {
      const { students } = getState();
      const withDues = students.filter((s) => (s.outstanding || 0) > 0).map(toCollectionRow);

      const dueToday = withDues.filter((r) => r.daysUntilDue === 0);
      const overdue = withDues.filter((r) => r.daysUntilDue < 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
      const dueTomorrow = withDues.filter((r) => r.daysUntilDue === 1);
      const thisWeek = withDues.filter((r) => r.daysUntilDue > 0 && r.daysUntilDue <= 7);

      const expiringSoon = students
        .filter((s) => {
          const d = daysUntil(s.membershipExpiry);
          return d >= 0 && d <= 7;
        })
        .map(toCollectionRow)
        .sort((a, b) => a.daysToExpiry - b.daysToExpiry);

      return {
        dueToday,
        dueTomorrow,
        thisWeek,
        overdue,
        expiringSoon,
        all: withDues.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
        totals: {
          dueToday: dueToday.reduce((s, r) => s + r.amount, 0),
          overdue: overdue.reduce((s, r) => s + r.amount, 0),
          thisWeek: thisWeek.reduce((s, r) => s + r.amount, 0),
          all: withDues.reduce((s, r) => s + r.amount, 0),
        },
      };
    }),

  /** Mock reminder — records the intent, does not contact anyone. */
  sendReminder: ({ studentId, channel = 'SMS' }) =>
    respond(() => {
      const student = getState().students.find((s) => s.id === studentId);
      if (!student) throw new Error('Student not found');
      mutate((draft) => {
        draft.students = draft.students.map((s) => (s.id === studentId ? { ...s, reminderSentOn: todayISO() } : s));
        appendAudit(draft, {
          action: 'reminder_sent',
          entity: student.name,
          summary: `Payment reminder queued via ${channel} — ${formatCurrency(student.outstanding)} due ${formatDate(student.feeDueDate)}`,
          before: '—',
          after: channel,
        });
      });
      return { name: student.name, channel };
    }),

  sendBulkReminders: ({ studentIds, channel = 'SMS' }) =>
    respond(() => {
      const ids = new Set(studentIds);
      mutate((draft) => {
        draft.students = draft.students.map((s) => (ids.has(s.id) ? { ...s, reminderSentOn: todayISO() } : s));
        appendAudit(draft, {
          action: 'reminder_sent',
          entity: `${ids.size} students`,
          summary: `Bulk payment reminder queued via ${channel}`,
          before: '—',
          after: `${ids.size} recipients`,
        });
      });
      return { count: ids.size };
    }),

  /** Adjust a student's outstanding balance (waiver, correction). */
  adjustOutstanding: ({ studentId, amount, reason }) =>
    respond(() => {
      const student = getState().students.find((s) => s.id === studentId);
      if (!student) throw new Error('Student not found');
      const next = Math.max(0, Number(amount) || 0);
      mutate((draft) => {
        draft.students = draft.students.map((s) => (s.id === studentId ? { ...s, outstanding: next } : s));
        appendAudit(draft, {
          action: 'outstanding_adjusted',
          entity: student.name,
          summary: reason || 'Outstanding amount adjusted',
          before: formatCurrency(student.outstanding),
          after: formatCurrency(next),
        });
      });
      return true;
    }),
};

export default paymentService;
