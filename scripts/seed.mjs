/**
 * Seeds Supabase with the demo dataset.
 *
 *   node --env-file=.env.local scripts/seed.mjs
 *   node --env-file=.env.local scripts/seed.mjs --reset
 *
 * Reuses the deterministic generator in src/data/mockData.js, so the
 * seeded database matches what the mock-service build showed: the same
 * students on the same seats with the same expiry dates.
 *
 * Uses the service-role key and therefore bypasses RLS. Never point this
 * at a project holding real student data.
 */

import { createClient } from '@supabase/supabase-js';
import { initializeMockData } from '../src/data/mockData.js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('\n  Missing credentials.');
  console.error('  Run with:  node --env-file=.env.local scripts/seed.mjs');
  console.error('  .env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const reset = process.argv.includes('--reset');

// Supabase rejects very large payloads, so inserts go in batches.
const CHUNK = 500;

async function insertAll(table, rows) {
  if (!rows.length) return [];
  const out = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase.from(table).insert(batch).select('id');
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    process.stdout.write(`\r  ${table}: ${Math.min(i + CHUNK, rows.length)}/${rows.length}   `);
  }
  process.stdout.write(`\r  ${table}: ${rows.length} rows\n`);
  return out;
}

async function main() {
  console.log('\n=== Seeding Supabase ===\n');

  const mock = initializeMockData();

  if (reset) {
    console.log('Clearing operational tables (profiles and settings are left alone)…');
    // Order matters: children before parents.
    for (const table of [
      'attendance', 'payments', 'leaves', 'shift_change_requests', 'seat_assignments',
      'waitlist', 'expenses', 'maintenance_issues', 'notifications', 'audit_log',
      'students', 'seats',
    ]) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) console.warn(`  ! ${table}: ${error.message}`);
    }
    console.log('  cleared\n');
  }

  // ── Reference data already seeded by schema.sql ────────────
  const { data: slotRows, error: slotErr } = await supabase.from('slots').select('id, name');
  if (slotErr) throw new Error(`slots: ${slotErr.message}. Run supabase/schema.sql first.`);

  const { data: planRows, error: planErr } = await supabase.from('membership_plans').select('id, name');
  if (planErr) throw new Error(`membership_plans: ${planErr.message}`);

  if (!slotRows?.length || !planRows?.length) {
    throw new Error('No slots or plans found. Run supabase/schema.sql in the SQL editor first.');
  }

  const slotIdByName = new Map(slotRows.map((s) => [s.name, s.id]));
  const planIdByName = new Map(planRows.map((p) => [p.name, p.id]));

  // Mock ids → database uuids.
  const slotUuid = (mockSlotId) => {
    const slot = mock.slots.find((s) => s.id === mockSlotId);
    return slot ? slotIdByName.get(slot.name) ?? null : null;
  };
  const planUuid = (mockPlanId) => {
    const plan = mock.membershipPlans.find((p) => p.id === mockPlanId);
    return plan ? planIdByName.get(plan.name) ?? null : null;
  };

  // ── Seats ──────────────────────────────────────────────────
  await insertAll(
    'seats',
    mock.desks.map((d) => ({
      number: d.number,
      floor: d.floor,
      floor_name: d.floorName,
      section: d.section,
      zone: d.zone || '',
      position: d.position,
      override: d.override || null,
      // Rewritten below once student uuids exist.
      temporary: null,
    })),
  );

  const { data: seatRows } = await supabase.from('seats').select('id, number');
  const seatIdByNumber = new Map((seatRows || []).map((s) => [s.number, s.id]));

  // ── Students ───────────────────────────────────────────────
  await insertAll(
    'students',
    mock.students.map((s) => ({
      student_code: s.studentId,
      first_name: s.firstName,
      last_name: s.lastName,
      gender: s.gender,
      email: s.email,
      phone: s.phone,
      address: s.address,
      city: s.city,
      pincode: s.pincode,
      emergency_name: s.emergencyName,
      emergency_contact: s.emergencyContact,
      exam: s.exam,
      seat_id: s.deskNumber ? seatIdByNumber.get(s.deskNumber) ?? null : null,
      slot_id: slotUuid(s.slotId),
      plan_id: planUuid(s.membershipPlanId),
      plan_price: s.planPrice,
      membership_start: s.membershipStart,
      membership_expiry: s.membershipExpiry,
      paused_days: s.pausedDays || 0,
      fee_due_date: s.feeDueDate,
      outstanding: s.outstanding,
      status: s.status === 'on_leave' ? 'on_leave' : s.status,
      join_date: s.joinDate,
      source: s.source,
      referred_by: s.referredBy,
    })),
  );

  const { data: studentRows } = await supabase.from('students').select('id, student_code');
  const studentIdByCode = new Map((studentRows || []).map((s) => [s.student_code, s.id]));
  const dbId = (mockStudentId) => {
    const s = mock.students.find((x) => x.id === mockStudentId);
    return s ? studentIdByCode.get(s.studentId) ?? null : null;
  };

  // ── Attendance ─────────────────────────────────────────────
  await insertAll(
    'attendance',
    mock.attendance
      .filter((a) => dbId(a.studentId))
      .map((a) => ({
        student_id: dbId(a.studentId),
        slot_id: slotUuid(a.slotId),
        seat_number: a.deskNumber,
        date: a.date,
        check_in: a.checkIn,
        check_out: a.checkOut,
        status: a.status,
        marked_by: a.markedBy || 'Biometric',
      })),
  );

  // ── Payments ───────────────────────────────────────────────
  await insertAll(
    'payments',
    mock.payments
      .filter((p) => dbId(p.studentId))
      .map((p) => ({
        receipt_number: p.receiptNumber,
        invoice_number: p.invoiceNumber,
        student_id: dbId(p.studentId),
        amount: p.amount,
        method: p.method,
        date: p.date,
        status: p.status,
        plan_id: planUuid(p.membershipPlanId),
        plan_name: p.membershipPlan,
        period_start: p.periodStart,
        period_end: p.periodEnd,
        transaction_id: p.transactionId,
        collected_by: p.collectedBy,
        notes: p.notes,
        type: p.type,
      })),
  );

  // ── Leaves ─────────────────────────────────────────────────
  await insertAll(
    'leaves',
    mock.leaves
      .filter((l) => dbId(l.studentId))
      .map((l) => ({
        student_id: dbId(l.studentId),
        seat_number: l.deskNumber,
        start_date: l.startDate,
        end_date: l.endDate,
        extended_to: l.extendedTo,
        reason: l.reason,
        status: l.status,
        seat_action: l.seatAction,
        remaining_days_at_start: l.remainingDaysAtStart || 0,
        requested_on: l.requestedOn,
        resumed_on: l.resumedOn,
        approved_by: l.approvedBy || '',
      })),
  );

  // ── Shift changes ──────────────────────────────────────────
  await insertAll(
    'shift_change_requests',
    mock.shiftChanges
      .filter((r) => dbId(r.studentId))
      .map((r) => ({
        student_id: dbId(r.studentId),
        current_slot_id: slotUuid(r.currentSlotId),
        requested_slot_id: slotUuid(r.requestedSlotId),
        current_seat: r.currentSeat,
        new_seat: r.newSeat,
        effective_date: r.effectiveDate,
        fee_difference: r.feeDifference,
        reason: r.reason,
        status: r.status,
        requested_on: r.requestedOn,
        history: r.history,
      })),
  );

  // ── Assignment history ─────────────────────────────────────
  await insertAll(
    'seat_assignments',
    mock.assignmentHistory.map((h) => ({
      student_id: dbId(h.studentId),
      student_name: h.studentName,
      type: h.type,
      from_seat: h.fromSeat,
      to_seat: h.toSeat,
      note: h.note || '',
      performed_by: h.by || '',
      occurred_at: `${h.date}T09:00:00Z`,
    })),
  );

  // ── Waitlist, expenses, maintenance, notifications ─────────
  await insertAll(
    'waitlist',
    mock.waitlist.map((w) => ({
      name: w.name,
      phone: w.phone,
      preferred_slot_id: slotUuid(w.preferredSlotId),
      preferred_section: w.preferredSection,
      exam: w.exam,
      note: w.note,
      priority: w.priority,
      added_on: w.addedOn,
    })),
  );

  await insertAll(
    'expenses',
    mock.expenses.map((e) => ({
      category: e.category,
      description: e.description,
      amount: e.amount,
      date: e.date,
      payment_method: e.paymentMethod,
      added_by: e.addedBy,
      receipt: e.receipt,
      notes: e.notes,
    })),
  );

  await insertAll(
    'maintenance_issues',
    mock.maintenance.map((m) => ({
      seat_number: m.deskNumber,
      issue: m.issue,
      priority: m.priority,
      status: m.status,
      reported_date: m.reportedDate,
      reported_by: m.reportedBy,
      expected_resolution: m.expectedResolution || null,
      assigned_staff: m.assignedStaff,
      resolved_date: m.resolvedDate,
      blocks_seat: m.blocksSeat,
      notes: m.notes,
    })),
  );

  await insertAll(
    'notifications',
    mock.notifications.map((n) => ({
      type: n.type,
      title: n.title,
      message: n.message,
      category: n.category,
      link: n.link,
      is_read: n.read,
    })),
  );

  await insertAll(
    'audit_log',
    mock.auditLog.map((a) => ({
      action: a.action,
      entity: a.entity,
      summary: a.summary,
      before: a.before,
      after: a.after,
      actor_name: a.admin,
      occurred_at: `${a.date}T10:00:00Z`,
    })),
  );

  // ── Temporary seat releases ────────────────────────────────
  // Applied last: the JSON references student uuids that only exist now.
  const released = mock.desks.filter((d) => d.temporary);
  for (const seat of released) {
    const holder = dbId(seat.temporary.holderStudentId);
    if (!holder) continue;
    await supabase
      .from('seats')
      .update({
        temporary: {
          holder_student_id: holder,
          temp_student_id: null,
          from: seat.temporary.from,
          to: seat.temporary.to,
          reason: seat.temporary.reason || '',
        },
      })
      .eq('number', seat.number);
  }
  if (released.length) console.log(`  seats: ${released.length} temporary release(s) applied`);

  // ── Summary ────────────────────────────────────────────────
  const counts = {};
  for (const table of ['seats', 'students', 'attendance', 'payments', 'leaves', 'shift_change_requests', 'waitlist', 'expenses', 'maintenance_issues']) {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true });
    counts[table] = count ?? 0;
  }

  console.log('\n=== Done ===');
  Object.entries(counts).forEach(([t, c]) => console.log(`  ${t.padEnd(24)} ${c}`));
  console.log('');
}

main().catch((err) => {
  console.error(`\n  Seed failed: ${err.message}\n`);
  process.exit(1);
});
