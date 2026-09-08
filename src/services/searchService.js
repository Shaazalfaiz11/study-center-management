// ============================================================
// SEARCH SERVICE
// Powers the Ctrl+K global search across every entity.
// ============================================================

import { getState } from './store';
import { formatCurrency, formatDate, statusLabel } from './businessRules';

const MAX_PER_GROUP = 4;

/**
 * Synchronous on purpose — global search must feel instant as the
 * user types. Returns grouped results ready to render.
 */
export const globalSearch = (query) => {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 1) return { query: q, groups: [], total: 0 };

  const state = getState();
  const groups = [];

  // ── Students ───────────────────────────────────────────────
  const students = state.students
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.phone.replace(/\s/g, '').includes(q.replace(/[\s+]/g, '')) ||
        (s.exam || '').toLowerCase().includes(q),
    )
    .slice(0, MAX_PER_GROUP);

  if (students.length) {
    groups.push({
      key: 'students',
      label: 'Students',
      items: students.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: [s.studentId, s.deskNumber ? `Seat ${s.deskNumber}` : 'No seat', `${s.slotName} shift`].join(' · '),
        meta: statusLabel(s.membershipStatus),
        tone: s.membershipStatus,
        to: `/students/${s.id}`,
      })),
    });
  }

  // ── Seats ──────────────────────────────────────────────────
  const seats = state.desks.filter((d) => d.number.toLowerCase().includes(q) || (d.zone || '').toLowerCase().includes(q)).slice(0, MAX_PER_GROUP);

  if (seats.length) {
    groups.push({
      key: 'seats',
      label: 'Seats',
      items: seats.map((seat) => {
        const holder = seat.studentId ? state.students.find((s) => s.id === seat.studentId) : null;
        return {
          id: seat.id,
          title: `Seat ${seat.number}`,
          subtitle: [seat.floorName, `Section ${seat.section}`, holder ? holder.name : 'Unassigned'].join(' · '),
          meta: statusLabel(seat.status),
          tone: seat.status,
          to: `/seats/map?seat=${seat.number}`,
        };
      }),
    });
  }

  // ── Payments ───────────────────────────────────────────────
  const payments = state.payments
    .filter((p) => p.studentName.toLowerCase().includes(q) || p.receiptNumber.toLowerCase().includes(q) || (p.invoiceNumber || '').toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);

  if (payments.length) {
    groups.push({
      key: 'payments',
      label: 'Payments',
      items: payments.map((p) => ({
        id: p.id,
        title: `${formatCurrency(p.amount)} — ${p.studentName}`,
        subtitle: [p.receiptNumber, p.method, formatDate(p.date)].join(' · '),
        meta: statusLabel(p.status),
        tone: p.status === 'completed' ? 'paid' : 'pending',
        to: `/billing/payments?payment=${p.id}`,
      })),
    });
  }

  // ── Memberships ────────────────────────────────────────────
  const memberships = state.students
    .filter((s) => s.membershipPlan.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);

  if (memberships.length) {
    groups.push({
      key: 'memberships',
      label: 'Memberships',
      items: memberships.map((s) => ({
        id: `mem-${s.id}`,
        title: `${s.membershipPlan} — ${s.name}`,
        subtitle: `Expires ${formatDate(s.membershipExpiry)} · ${formatCurrency(s.planPrice)}`,
        meta: statusLabel(s.membershipStatus),
        tone: s.membershipStatus,
        to: `/students/${s.id}?tab=membership`,
      })),
    });
  }

  // ── Shift changes ──────────────────────────────────────────
  const shiftChanges = state.shiftChanges
    .filter((r) => r.studentName.toLowerCase().includes(q) || r.requestedSlotName.toLowerCase().includes(q) || r.currentSlotName.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);

  if (shiftChanges.length) {
    groups.push({
      key: 'shift-changes',
      label: 'Shift Changes',
      items: shiftChanges.map((r) => ({
        id: r.id,
        title: `${r.studentName} — ${r.currentSlotName} → ${r.requestedSlotName}`,
        subtitle: `Effective ${formatDate(r.effectiveDate)}`,
        meta: statusLabel(r.status),
        tone: r.status,
        to: `/assignments/shift-changes?request=${r.id}`,
      })),
    });
  }

  // ── Invoices ───────────────────────────────────────────────
  const invoices = state.payments
    .filter((p) => (p.invoiceNumber || '').toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP);

  if (invoices.length && !q.startsWith('rcp')) {
    groups.push({
      key: 'invoices',
      label: 'Invoices',
      items: invoices.map((p) => ({
        id: `inv-${p.id}`,
        title: p.invoiceNumber,
        subtitle: `${p.studentName} · ${formatCurrency(p.amount)} · ${formatDate(p.date)}`,
        meta: 'Paid',
        tone: 'paid',
        to: `/billing/invoices?invoice=${p.invoiceNumber}`,
      })),
    });
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return { query: q, groups, total };
};

export const searchService = { globalSearch };
export default searchService;
