// ============================================================
// MOCK DATA — Self Study Center
// ------------------------------------------------------------
// Deterministic, internally consistent seed data.
//
// Everything is generated from a fixed PRNG seed so that the same
// student always has the same seat, the same membership expiry and
// the same payment history on every reload. Relationships flow in
// one direction:
//
//   Plan → Membership → Student → Slot → Seat → Attendance → Payment
//
// Derived fields (membershipStatus, paymentStatus, seat status,
// slot.assigned, attendance rate) are NOT stored here — they are
// recomputed centrally in services/store.js so no two screens can
// ever disagree.
// ============================================================

// ── Deterministic PRNG ───────────────────────────────────────
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Date helpers (local time — avoids UTC off-by-one) ─────────
const pad = (n) => String(n).padStart(2, '0');

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

export const addMonths = (base, n) => {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
};

const TODAY = startOfToday();
export const TODAY_ISO = toISO(TODAY);
const offset = (n) => toISO(addDays(TODAY, n));

// ── Center configuration ─────────────────────────────────────
export const CENTER = {
  name: 'Vidya Self Study Center',
  branch: 'Hazratganj Branch',
  address: '2nd Floor, Saraswati Complex, Hazratganj, Lucknow 226001',
  phone: '+91 98390 55120',
  email: 'office@vidyastudycenter.in',
  gstin: '09AABCV1234K1Z9',
  openingTime: '06:00 AM',
  closingTime: '11:00 PM',
};

export const FLOORS = [
  { id: 1, name: 'Floor 1', sections: ['A', 'B'] },
  { id: 2, name: 'Floor 2', sections: ['C', 'D'] },
];

const SECTION_CONFIG = [
  { section: 'A', floor: 1, count: 40, label: 'Silent Zone' },
  { section: 'B', floor: 1, count: 30, label: 'General Zone' },
  { section: 'C', floor: 2, count: 30, label: 'Cabin Zone' },
  { section: 'D', floor: 2, count: 20, label: 'Group Study' },
];

export const SLOTS = [
  { id: 'slot-morning', name: 'Morning', startTime: '06:00 AM', endTime: '12:00 PM', capacity: 45, active: true },
  { id: 'slot-afternoon', name: 'Afternoon', startTime: '12:00 PM', endTime: '06:00 PM', capacity: 45, active: true },
  { id: 'slot-evening', name: 'Evening', startTime: '06:00 PM', endTime: '11:00 PM', capacity: 45, active: true },
  { id: 'slot-fullday', name: 'Full Day', startTime: '06:00 AM', endTime: '11:00 PM', capacity: 20, active: true },
  { id: 'slot-night', name: 'Night', startTime: '11:00 PM', endTime: '06:00 AM', capacity: 20, active: false },
];

export const MEMBERSHIP_PLANS = [
  { id: 'plan-daily', name: 'Daily Pass', duration: 1, durationUnit: 'day', durationDays: 1, price: 120, active: true, description: 'Single day access, any open seat' },
  { id: 'plan-weekly', name: 'Weekly', duration: 7, durationUnit: 'days', durationDays: 7, price: 600, active: true, description: 'Seven days, shift of choice' },
  { id: 'plan-monthly', name: 'Monthly', duration: 1, durationUnit: 'month', durationDays: 30, price: 1500, active: true, description: 'Fixed seat for one shift' },
  { id: 'plan-premium', name: 'Premium Monthly', duration: 1, durationUnit: 'month', durationDays: 30, price: 1800, active: true, description: 'Fixed seat, locker and reading light' },
  { id: 'plan-quarterly', name: 'Quarterly', duration: 3, durationUnit: 'months', durationDays: 90, price: 4200, active: true, description: 'Three months, 7% saving' },
  { id: 'plan-halfyearly', name: 'Half Yearly', duration: 6, durationUnit: 'months', durationDays: 180, price: 7800, active: true, description: 'Six months, 13% saving' },
  { id: 'plan-yearly', name: 'Yearly', duration: 12, durationUnit: 'months', durationDays: 365, price: 14400, active: true, description: 'Twelve months, 20% saving' },
];

export const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Internet', 'Water', 'Salary', 'Cleaning', 'Maintenance', 'Furniture', 'Equipment', 'Stationery', 'Marketing', 'Software', 'Other'];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

export const STAFF = [
  { id: 'staff-1', name: 'Rajesh Kumar', role: 'Owner', email: 'rajesh@vidyastudycenter.in' },
  { id: 'staff-2', name: 'Sunita Rawat', role: 'Front Desk', email: 'sunita@vidyastudycenter.in' },
  { id: 'staff-3', name: 'Imran Qureshi', role: 'Front Desk', email: 'imran@vidyastudycenter.in' },
  { id: 'staff-4', name: 'Ramesh Prajapati', role: 'Facilities', email: null },
];

const EXAMS = ['UPSC CSE', 'SSC CGL', 'NEET UG', 'JEE Advanced', 'IBPS PO', 'UPPSC', 'RRB NTPC', 'CA Foundation', 'CAT', 'CLAT'];
const SOURCES = ['Walk-in', 'Google', 'Instagram', 'Referral', 'Pamphlet', 'Friend'];

const FIRST_NAMES = [
  'Rahul', 'Aman', 'Priya', 'Anjali', 'Rohit', 'Neha', 'Vikram', 'Sneha', 'Deepak', 'Kavita',
  'Manish', 'Pooja', 'Arjun', 'Shreya', 'Nitin', 'Ritu', 'Saurabh', 'Divya', 'Ankit', 'Meenakshi',
  'Harsh', 'Swati', 'Gaurav', 'Nisha', 'Abhishek', 'Preeti', 'Sandeep', 'Komal', 'Vivek', 'Radhika',
  'Pankaj', 'Sakshi', 'Yogesh', 'Aarti', 'Tarun', 'Bhavna', 'Naveen', 'Jyoti', 'Kunal', 'Shalini',
];

const LAST_NAMES = [
  'Kumar', 'Singh', 'Sharma', 'Kumari', 'Gupta', 'Verma', 'Yadav', 'Mishra', 'Tiwari', 'Chauhan',
  'Pandey', 'Srivastava', 'Dubey', 'Rastogi', 'Agarwal', 'Saxena', 'Joshi', 'Nigam', 'Bajpai', 'Shukla',
  'Dixit', 'Kashyap', 'Rawat', 'Sinha',
];

// ============================================================
// Seats
// ============================================================
const buildSeats = () => {
  const seats = [];
  let n = 0;
  for (const cfg of SECTION_CONFIG) {
    const floor = FLOORS.find((f) => f.id === cfg.floor);
    for (let i = 1; i <= cfg.count; i++) {
      n++;
      seats.push({
        id: `seat-${cfg.section}-${pad(i)}`,
        number: `${cfg.section}-${pad(i)}`,
        floor: cfg.floor,
        floorName: floor.name,
        section: cfg.section,
        zone: cfg.label,
        position: i,
        // Assignment state — the single source of truth for occupancy.
        studentId: null,
        slotId: null,
        // Admin override: 'maintenance' | 'blocked' | 'reserved' | null
        override: null,
        // Temporary release (set while the holder is on leave)
        temporary: null, // { holderStudentId, tempStudentId, from, to, reason }
        lastUsed: null,
        status: 'available', // recomputed by the store
      });
    }
  }
  return seats;
};

// ============================================================
// Students
// ============================================================

// Hand-authored scenario students. These drive the demo flow and
// guarantee that every important state is represented on screen.
const SCENARIOS = [
  { first: 'Rahul', last: 'Kumar', seat: 'A-24', slot: 'slot-evening', plan: 'plan-premium', expiresIn: 18, billing: 'paid', attendance: 'high', exam: 'UPSC CSE' },
  { first: 'Aman', last: 'Singh', seat: 'B-07', slot: 'slot-morning', plan: 'plan-premium', expiresIn: -2, billing: 'overdue', overdueDays: 2, attendance: 'normal', exam: 'SSC CGL' },
  { first: 'Priya', last: 'Sharma', seat: 'A-11', slot: 'slot-morning', plan: 'plan-monthly', expiresIn: 0, billing: 'dueToday', attendance: 'high', exam: 'UPPSC' },
  { first: 'Anjali', last: 'Kumari', seat: 'C-05', slot: 'slot-afternoon', plan: 'plan-monthly', expiresIn: 3, billing: 'expiringSoon', attendance: 'normal', exam: 'NEET UG' },
  { first: 'Rohit', last: 'Kumar', seat: null, slot: 'slot-evening', plan: 'plan-monthly', expiresIn: -12, billing: 'overdue', overdueDays: 12, attendance: 'lapsed', exam: 'RRB NTPC' },
  { first: 'Neha', last: 'Singh', seat: 'B-14', slot: 'slot-morning', plan: 'plan-quarterly', expiresIn: 46, billing: 'paid', attendance: 'onLeave', exam: 'IBPS PO', leave: 'active' },
  { first: 'Vikram', last: 'Chauhan', seat: 'A-02', slot: 'slot-fullday', plan: 'plan-halfyearly', expiresIn: 96, billing: 'paid', attendance: 'veryHigh', exam: 'UPSC CSE' },
  { first: 'Sneha', last: 'Gupta', seat: 'C-12', slot: 'slot-afternoon', plan: 'plan-monthly', expiresIn: 9, billing: 'paid', attendance: 'low', exam: 'CAT' },
  { first: 'Deepak', last: 'Yadav', seat: 'B-22', slot: 'slot-evening', plan: 'plan-monthly', expiresIn: 11, billing: 'partial', attendance: 'normal', exam: 'JEE Advanced' },
  { first: 'Kavita', last: 'Verma', seat: 'A-33', slot: 'slot-morning', plan: 'plan-quarterly', expiresIn: 61, billing: 'paid', attendance: 'normal', exam: 'CA Foundation', leave: 'upcoming' },
  { first: 'Manish', last: 'Tiwari', seat: 'A-18', slot: 'slot-morning', plan: 'plan-monthly', expiresIn: 21, billing: 'paid', attendance: 'normal', exam: 'UPSC CSE' },
  { first: 'Pooja', last: 'Mishra', seat: 'C-21', slot: 'slot-evening', plan: 'plan-monthly', expiresIn: 24, billing: 'paid', attendance: 'high', exam: 'UPPSC' },
  { first: 'Arjun', last: 'Pandey', seat: 'B-03', slot: 'slot-morning', plan: 'plan-yearly', expiresIn: 210, billing: 'paid', attendance: 'veryHigh', exam: 'UPSC CSE' },
  { first: 'Shreya', last: 'Srivastava', seat: 'D-04', slot: 'slot-afternoon', plan: 'plan-monthly', expiresIn: 1, billing: 'expiringSoon', attendance: 'normal', exam: 'CLAT' },
  { first: 'Nitin', last: 'Dubey', seat: null, slot: 'slot-evening', plan: 'plan-monthly', expiresIn: -18, billing: 'overdue', overdueDays: 18, attendance: 'lapsed', exam: 'SSC CGL' },
  { first: 'Ritu', last: 'Rastogi', seat: 'C-27', slot: 'slot-afternoon', plan: 'plan-monthly', expiresIn: 5, billing: 'dueSoon', attendance: 'normal', exam: 'NEET UG' },
];

const BILLING_CYCLE = ['paid', 'paid', 'paid', 'paid', 'paid', 'dueSoon', 'paid', 'overdue', 'paid', 'paid', 'expiringSoon', 'paid', 'partial', 'paid', 'paid', 'dueToday', 'paid', 'paid', 'overdue', 'paid'];

const buildStudents = (seats, rand) => {
  const students = [];
  const seatByNumber = new Map(seats.map((s) => [s.number, s]));
  const takenSeats = new Set();
  const total = 96;

  const freeSeatsPool = () =>
    seats.filter((s) => !takenSeats.has(s.number) && !['A-24', 'B-07', 'A-11', 'C-05', 'B-14', 'A-02', 'C-12', 'B-22', 'A-33', 'A-18', 'C-21', 'B-03', 'D-04', 'C-27'].includes(s.number));

  for (let i = 0; i < total; i++) {
    const scenario = SCENARIOS[i];
    const first = scenario ? scenario.first : FIRST_NAMES[i % FIRST_NAMES.length];
    const last = scenario ? scenario.last : LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const id = `student-${i + 1}`;
    const studentId = `SSC-${1001 + i}`;

    // ── Plan & shift ───────────────────────────────────────
    const planId = scenario ? scenario.plan : ['plan-monthly', 'plan-monthly', 'plan-premium', 'plan-quarterly', 'plan-monthly', 'plan-halfyearly', 'plan-weekly', 'plan-monthly'][i % 8];
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === planId);
    const slotId = scenario ? scenario.slot : ['slot-morning', 'slot-evening', 'slot-afternoon', 'slot-morning', 'slot-evening', 'slot-fullday'][i % 6];
    const slot = SLOTS.find((s) => s.id === slotId);

    // ── Billing scenario ───────────────────────────────────
    const billing = scenario ? scenario.billing : BILLING_CYCLE[i % BILLING_CYCLE.length];

    let expiresIn;
    if (scenario) expiresIn = scenario.expiresIn;
    else if (billing === 'overdue') expiresIn = -(1 + Math.floor(rand() * 14));
    else if (billing === 'dueToday') expiresIn = 0;
    else if (billing === 'dueSoon') expiresIn = 1 + Math.floor(rand() * 3);
    else if (billing === 'expiringSoon') expiresIn = 2 + Math.floor(rand() * 5);
    else expiresIn = 9 + Math.floor(rand() * Math.max(20, plan.durationDays - 8));

    const membershipExpiry = offset(expiresIn);
    const membershipStart = toISO(addDays(new Date(membershipExpiry), -plan.durationDays));

    const overdueDays = billing === 'overdue' ? (scenario?.overdueDays ?? -expiresIn) : 0;
    // Students more than 10 days past expiry lose their seat and go inactive.
    const lapsed = overdueDays > 10;

    let outstanding = 0;
    let feeDueDate = membershipExpiry;
    let paidThisCycle = plan.price;

    if (billing === 'overdue' || billing === 'dueToday' || billing === 'dueSoon' || billing === 'expiringSoon') {
      outstanding = plan.price;
      paidThisCycle = 0;
    } else if (billing === 'partial') {
      // Part payment taken, balance due in a couple of days — this is a
      // distinct state from overdue, so the balance date stays ahead of today.
      paidThisCycle = Math.round((plan.price * 0.5) / 100) * 100;
      outstanding = plan.price - paidThisCycle;
      feeDueDate = offset(2);
    }

    // ── Seat ───────────────────────────────────────────────
    let seat = null;
    if (scenario && scenario.seat) {
      seat = seatByNumber.get(scenario.seat) || null;
    } else if (!scenario && !lapsed) {
      const pool = freeSeatsPool();
      if (pool.length > 4) seat = pool[Math.floor(rand() * (pool.length - 4))];
    }
    if (seat) takenSeats.add(seat.number);

    // ── Contact details ────────────────────────────────────
    const phoneTail = 10000000 + Math.floor(rand() * 89999999);
    const joinDaysAgo = plan.durationDays + 20 + Math.floor(rand() * 400);

    students.push({
      id,
      studentId,
      firstName: first,
      lastName: last,
      name,
      gender: i % 3 === 0 ? 'Female' : 'Male',
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@gmail.com`,
      phone: `+91 ${String(phoneTail).slice(0, 5)} ${String(phoneTail).slice(5)}`,
      address: `${100 + Math.floor(rand() * 300)}, ${['Indira Nagar', 'Gomti Nagar', 'Aliganj', 'Rajajipuram', 'Mahanagar', 'Chinhat'][i % 6]}`,
      city: 'Lucknow',
      pincode: `2260${pad(1 + (i % 30))}`,
      emergencyName: `${FIRST_NAMES[(i + 13) % FIRST_NAMES.length]} ${last}`,
      emergencyContact: `+91 ${String(phoneTail + 7).slice(0, 5)} ${String(phoneTail + 7).slice(5)}`,
      exam: scenario ? scenario.exam : EXAMS[i % EXAMS.length],
      photo: null,

      // Seat + shift
      deskId: seat ? seat.id : null,
      deskNumber: seat ? seat.number : null,
      slotId,
      slotName: slot.name,

      // Membership
      membershipPlanId: plan.id,
      membershipPlan: plan.name,
      planPrice: plan.price,
      membershipStart,
      membershipExpiry,
      membershipStatus: 'active', // recomputed
      pausedDays: 0,

      // Billing
      feeDueDate,
      outstanding,
      paymentStatus: 'paid', // recomputed
      totalPaid: 0, // recomputed from payments
      lastPaymentDate: null, // recomputed
      lastPaymentAmount: null,

      // Lifecycle
      status: lapsed ? 'inactive' : 'active',
      joinDate: offset(-joinDaysAgo),
      source: scenario ? 'Referral' : SOURCES[i % SOURCES.length],
      referredBy: null,
      notes: [],
      documents: [
        { id: `doc-${id}-1`, type: 'ID Proof', name: 'Aadhaar Card', status: 'verified', uploadDate: offset(-joinDaysAgo) },
        { id: `doc-${id}-2`, type: 'Photo', name: 'Passport Photo', status: i % 9 === 0 ? 'pending' : 'verified', uploadDate: offset(-joinDaysAgo) },
      ],

      // Recomputed
      attendanceRate: 0,
      lastAttendanceDate: null,
      onLeave: false,
      leaveId: null,
      _attendanceProfile: scenario ? scenario.attendance : ['normal', 'high', 'normal', 'veryHigh', 'normal', 'low'][i % 6],
      _paidThisCycle: paidThisCycle,
      _billingScenario: billing,
    });

    if (seat) {
      seat.studentId = id;
      seat.slotId = slotId;
    }
  }

  return students;
};

// ============================================================
// Attendance — 45 days of history
// ============================================================
const ATTENDANCE_DAYS = 45;

const PRESENT_RATE = {
  veryHigh: 0.96,
  high: 0.9,
  normal: 0.78,
  low: 0.42,
  lapsed: 0.0,
  onLeave: 0.7,
};

const buildAttendance = (students, rand) => {
  const records = [];

  for (let dayOffset = ATTENDANCE_DAYS - 1; dayOffset >= 0; dayOffset--) {
    const date = offset(-dayOffset);
    const weekday = addDays(TODAY, -dayOffset).getDay();

    for (const student of students) {
      if (student.status !== 'active') continue;
      // No records before the student joined or after they went inactive.
      if (date < student.joinDate) continue;

      const profile = student._attendanceProfile;
      let rate = PRESENT_RATE[profile] ?? 0.78;

      // "Potentially inactive" student — stops coming 9 days ago.
      if (profile === 'low' && dayOffset < 9) rate = 0;
      // On-leave student — away from the leave start date.
      if (profile === 'onLeave' && dayOffset < 3) rate = 0;
      // Sunday dip.
      if (weekday === 0) rate *= 0.6;

      const roll = rand();
      let status;
      if (roll < rate) status = 'present';
      else if (roll < rate + 0.06) status = 'late';
      else if (roll < rate + 0.11) status = 'leave';
      else status = 'absent';

      const isHere = status === 'present' || status === 'late';
      const baseHour = student.slotName === 'Morning' ? 6 : student.slotName === 'Afternoon' ? 12 : student.slotName === 'Full Day' ? 6 : 18;
      const lateOffset = status === 'late' ? 1 + Math.floor(rand() * 2) : 0;
      const inHour = baseHour + lateOffset;
      const inMin = Math.floor(rand() * 55);

      const hours = student.slotName === 'Full Day' ? 10 : 5;
      const outHour = Math.min(23, inHour + hours);
      const outMin = Math.floor(rand() * 55);

      const fmtTime = (h, m) => `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;

      // Today's later shifts have not checked out yet.
      const stillIn = dayOffset === 0 && baseHour >= 12;

      records.push({
        id: `att-${student.id}-${date}`,
        studentId: student.id,
        studentName: student.name,
        studentIdNum: student.studentId,
        deskNumber: student.deskNumber,
        slotId: student.slotId,
        slotName: student.slotName,
        date,
        checkIn: isHere ? fmtTime(inHour, inMin) : null,
        checkOut: isHere && !stillIn ? fmtTime(outHour, outMin) : null,
        status,
        markedBy: 'Biometric',
      });
    }
  }

  return records;
};

// ============================================================
// Payments — derived from each student's membership cycles
// ============================================================
const buildPayments = (students, rand) => {
  const payments = [];
  let seq = 0;

  const push = (student, amount, date, opts = {}) => {
    seq++;
    payments.push({
      id: `pay-${seq}`,
      receiptNumber: `RCP-${String(2400 + seq).padStart(5, '0')}`,
      invoiceNumber: `INV-${String(2400 + seq).padStart(5, '0')}`,
      studentId: student.id,
      studentName: student.name,
      studentIdNum: student.studentId,
      amount,
      method: PAYMENT_METHODS[Math.floor(rand() * PAYMENT_METHODS.length)],
      date,
      status: 'completed',
      membershipPlan: student.membershipPlan,
      membershipPlanId: student.membershipPlanId,
      periodStart: opts.periodStart || date,
      periodEnd: opts.periodEnd || null,
      transactionId: `TXN${String(100000 + Math.floor(rand() * 899999))}`,
      collectedBy: STAFF[1 + Math.floor(rand() * 2)].name,
      notes: opts.notes || '',
      type: opts.type || 'membership',
    });
  };

  for (const student of students) {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === student.membershipPlanId);
    const cycles = 1 + Math.floor(rand() * 3);

    // Past cycles are always fully paid.
    for (let c = cycles; c >= 1; c--) {
      const periodStart = toISO(addDays(new Date(student.membershipStart), -plan.durationDays * c));
      const periodEnd = toISO(addDays(new Date(student.membershipStart), -plan.durationDays * (c - 1) - 1));
      if (periodStart < student.joinDate) continue;
      push(student, plan.price, periodStart, { periodStart, periodEnd });
    }

    // Current cycle.
    if (student._paidThisCycle > 0) {
      push(student, student._paidThisCycle, student.membershipStart, {
        periodStart: student.membershipStart,
        periodEnd: student.membershipExpiry,
        notes: student._billingScenario === 'partial' ? 'Part payment — balance pending' : '',
      });
    }
  }

  // A few security-deposit / locker payments for realism.
  students.slice(0, 14).forEach((s, i) => {
    if (i % 3 !== 0) return;
    push(s, 300, offset(-(20 + i)), { type: 'locker', notes: 'Locker rent' });
  });

  return payments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
};

// ============================================================
// Leaves (temporary membership pauses)
// ============================================================
const buildLeaves = (students) => {
  const byName = (n) => students.find((s) => s.name === n);
  const leaves = [];
  let seq = 0;

  const add = (student, from, to, reason, status, seatAction = 'released') => {
    if (!student) return null;
    seq++;
    const leave = {
      id: `leave-${seq}`,
      studentId: student.id,
      studentName: student.name,
      studentIdNum: student.studentId,
      deskNumber: student.deskNumber,
      slotName: student.slotName,
      startDate: from,
      endDate: to,
      reason,
      status, // upcoming | active | completed | cancelled
      seatAction, // released | reserved
      requestedOn: toISO(addDays(new Date(from), -3)),
      approvedBy: STAFF[0].name,
      extendedTo: null,
      resumedOn: status === 'completed' ? to : null,
    };
    leaves.push(leave);
    return leave;
  };

  add(byName('Neha Singh'), offset(-3), offset(12), 'Going home to Gorakhpur for a family function', 'active', 'released');
  add(byName('Kavita Verma'), offset(4), offset(14), 'CA Foundation exam centre is in Kanpur', 'upcoming', 'reserved');
  add(byName('Sneha Gupta'), offset(-34), offset(-22), 'Recovering from typhoid', 'completed', 'released');
  add(byName('Arjun Pandey'), offset(-70), offset(-58), 'Sister\'s wedding', 'completed', 'reserved');
  add(byName('Deepak Yadav'), offset(9), offset(19), 'Home town visit after JEE mains', 'upcoming', 'released');

  return leaves;
};

// ============================================================
// Shift change requests
// ============================================================
const buildShiftChanges = (students) => {
  const byName = (n) => students.find((s) => s.name === n);
  const requests = [];
  let seq = 0;

  const add = ({ student, from, to, currentSeat, newSeat, effectiveDate, feeDifference, reason, status, history }) => {
    if (!student) return;
    seq++;
    requests.push({
      id: `shift-${seq}`,
      studentId: student.id,
      studentName: student.name,
      studentIdNum: student.studentId,
      phone: student.phone,
      currentSlotId: from,
      currentSlotName: SLOTS.find((s) => s.id === from)?.name,
      requestedSlotId: to,
      requestedSlotName: SLOTS.find((s) => s.id === to)?.name,
      currentSeat,
      newSeat,
      effectiveDate,
      feeDifference,
      reason,
      status,
      requestedOn: history[0].date,
      history,
    });
  };

  add({
    student: byName('Manish Tiwari'),
    from: 'slot-morning', to: 'slot-evening',
    currentSeat: 'A-18', newSeat: null,
    effectiveDate: offset(2), feeDifference: 0,
    reason: 'Started a part-time job at a coaching institute in the morning',
    status: 'pending',
    history: [{ date: offset(-1), time: '11:24 AM', action: 'Requested', by: 'Sunita Rawat', note: 'Walk-in request at front desk' }],
  });

  add({
    student: byName('Anjali Kumari'),
    from: 'slot-afternoon', to: 'slot-morning',
    currentSeat: 'C-05', newSeat: null,
    effectiveDate: offset(1), feeDifference: 0,
    reason: 'Morning batch coaching finishes at 11, wants to study right after',
    status: 'pending',
    history: [{ date: offset(0), time: '09:10 AM', action: 'Requested', by: 'Imran Qureshi', note: 'Called the front desk' }],
  });

  add({
    student: byName('Shreya Srivastava'),
    from: 'slot-afternoon', to: 'slot-fullday',
    currentSeat: 'D-04', newSeat: 'D-04',
    effectiveDate: offset(3), feeDifference: 300,
    reason: 'CLAT is in three months, wants full day access',
    status: 'approved',
    history: [
      { date: offset(-2), time: '05:40 PM', action: 'Requested', by: 'Sunita Rawat', note: '' },
      { date: offset(-1), time: '10:05 AM', action: 'Approved', by: 'Rajesh Kumar', note: 'Upgrade fee ₹300 to be collected on the effective date' },
    ],
  });

  add({
    student: byName('Pooja Mishra'),
    from: 'slot-morning', to: 'slot-evening',
    currentSeat: 'A-29', newSeat: 'C-21',
    effectiveDate: offset(-6), feeDifference: 0,
    reason: 'Shifted to an evening coaching schedule',
    status: 'completed',
    history: [
      { date: offset(-9), time: '12:15 PM', action: 'Requested', by: 'Sunita Rawat', note: '' },
      { date: offset(-8), time: '09:30 AM', action: 'Approved', by: 'Rajesh Kumar', note: 'C-21 held for her' },
      { date: offset(-6), time: '06:02 PM', action: 'Completed', by: 'Imran Qureshi', note: 'Seat A-29 released, C-21 assigned' },
    ],
  });

  add({
    student: byName('Nitin Dubey'),
    from: 'slot-evening', to: 'slot-morning',
    currentSeat: null, newSeat: null,
    effectiveDate: offset(-4), feeDifference: 0,
    reason: 'Wanted to move to the morning shift',
    status: 'rejected',
    history: [
      { date: offset(-5), time: '04:20 PM', action: 'Requested', by: 'Imran Qureshi', note: '' },
      { date: offset(-4), time: '11:00 AM', action: 'Rejected', by: 'Rajesh Kumar', note: 'Membership expired and dues pending — clear dues first' },
    ],
  });

  return requests;
};

// ============================================================
// Waitlist
// ============================================================
const buildWaitlist = () => [
  { id: 'wait-1', name: 'Ashutosh Rana', phone: '+91 90265 41188', preferredSlotId: 'slot-evening', preferredSlotName: 'Evening', preferredSection: 'A', addedOn: offset(-6), exam: 'UPSC CSE', note: 'Wants a silent-zone seat only', priority: 'high' },
  { id: 'wait-2', name: 'Farhan Ali', phone: '+91 87654 09912', preferredSlotId: 'slot-evening', preferredSlotName: 'Evening', preferredSection: 'B', addedOn: offset(-4), exam: 'IBPS PO', note: '', priority: 'normal' },
  { id: 'wait-3', name: 'Ishita Bhardwaj', phone: '+91 99354 27700', preferredSlotId: 'slot-morning', preferredSlotName: 'Morning', preferredSection: 'A', addedOn: offset(-3), exam: 'NEET UG', note: 'Can start from next Monday', priority: 'normal' },
  { id: 'wait-4', name: 'Sumit Kannaujia', phone: '+91 70701 33421', preferredSlotId: 'slot-evening', preferredSlotName: 'Evening', preferredSection: 'C', addedOn: offset(-2), exam: 'SSC CGL', note: '', priority: 'normal' },
  { id: 'wait-5', name: 'Meghna Awasthi', phone: '+91 81300 55618', preferredSlotId: 'slot-afternoon', preferredSlotName: 'Afternoon', preferredSection: 'C', addedOn: offset(-1), exam: 'CAT', note: 'Asked for a cabin seat', priority: 'low' },
];

// ============================================================
// Assignment history
// ============================================================
const buildAssignmentHistory = (students) => {
  const byName = (n) => students.find((s) => s.name === n);
  const rows = [];
  let seq = 0;

  const add = (student, type, fromSeat, toSeat, date, time, by, note) => {
    if (!student) return;
    seq++;
    rows.push({
      id: `asg-${seq}`,
      studentId: student.id,
      studentName: student.name,
      type, // assigned | transferred | released | temp_released | temp_allocated | resumed
      fromSeat,
      toSeat,
      date,
      time,
      by,
      note,
    });
  };

  add(byName('Rahul Kumar'), 'assigned', null, 'A-24', offset(-42), '10:15 AM', 'Sunita Rawat', 'Evening shift, silent zone');
  add(byName('Pooja Mishra'), 'transferred', 'A-29', 'C-21', offset(-6), '06:02 PM', 'Imran Qureshi', 'Shift change Morning → Evening');
  add(byName('Neha Singh'), 'temp_released', 'B-14', null, offset(-3), '09:20 AM', 'Rajesh Kumar', 'Membership paused — leave until ' + offset(12));
  add(byName('Sneha Gupta'), 'assigned', null, 'C-12', offset(-58), '11:40 AM', 'Sunita Rawat', '');
  add(byName('Rohit Kumar'), 'released', 'B-19', null, offset(-11), '05:30 PM', 'Rajesh Kumar', 'Membership expired 12 days ago, dues pending');
  add(byName('Nitin Dubey'), 'released', 'D-11', null, offset(-16), '04:05 PM', 'Sunita Rawat', 'Membership expired');
  add(byName('Vikram Chauhan'), 'assigned', null, 'A-02', offset(-120), '07:00 AM', 'Rajesh Kumar', 'Full day membership');
  add(byName('Deepak Yadav'), 'transferred', 'B-25', 'B-22', offset(-19), '06:45 PM', 'Imran Qureshi', 'Requested a seat near the window');

  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
};

// ============================================================
// Expenses
// ============================================================
const buildExpenses = () => {
  const items = [
    { category: 'Rent', amount: 65000, desc: 'Premises rent — current month', method: 'Bank Transfer', day: -6 },
    { category: 'Electricity', amount: 18400, desc: 'UPPCL bill — August', method: 'UPI', day: -5 },
    { category: 'Salary', amount: 42000, desc: 'Front desk staff salary (2)', method: 'Bank Transfer', day: -7 },
    { category: 'Internet', amount: 3400, desc: 'Airtel 300 Mbps fibre', method: 'UPI', day: -8 },
    { category: 'Water', amount: 1800, desc: 'RO service and water cans', method: 'Cash', day: -4 },
    { category: 'Cleaning', amount: 6000, desc: 'Housekeeping — monthly contract', method: 'Cash', day: -3 },
    { category: 'Maintenance', amount: 2800, desc: 'AC servicing — Floor 2', method: 'Cash', day: -2 },
    { category: 'Stationery', amount: 1450, desc: 'Registers, receipt books, pens', method: 'Cash', day: -1 },
    { category: 'Marketing', amount: 5500, desc: 'Instagram ads — admission drive', method: 'UPI', day: -12 },
    { category: 'Furniture', amount: 12800, desc: '4 replacement chairs — Section B', method: 'Bank Transfer', day: -14 },
    { category: 'Equipment', amount: 9200, desc: 'Inverter battery replacement', method: 'Bank Transfer', day: -18 },
    { category: 'Software', amount: 1499, desc: 'Management software subscription', method: 'UPI', day: -20 },
    { category: 'Electricity', amount: 16900, desc: 'UPPCL bill — July', method: 'UPI', day: -36 },
    { category: 'Rent', amount: 65000, desc: 'Premises rent — previous month', method: 'Bank Transfer', day: -37 },
  ];

  return items.map((item, i) => ({
    id: `exp-${i + 1}`,
    category: item.category,
    description: item.desc,
    amount: item.amount,
    date: offset(item.day),
    paymentMethod: item.method,
    addedBy: i % 2 === 0 ? STAFF[0].name : STAFF[1].name,
    receipt: i % 3 === 0 ? 'receipt.pdf' : null,
    notes: '',
  }));
};

// ============================================================
// Maintenance
// ============================================================
const buildMaintenance = () => {
  const items = [
    { seat: 'C-18', issue: 'Reading light flickering', priority: 'medium', status: 'open', reported: -2, staff: 'Ramesh Prajapati' },
    { seat: 'B-09', issue: 'Power socket not working', priority: 'high', status: 'open', reported: -1, staff: 'Ramesh Prajapati' },
    { seat: 'A-07', issue: 'Chair wheel broken', priority: 'low', status: 'in_progress', reported: -4, staff: 'Ramesh Prajapati' },
    { seat: 'D-13', issue: 'Desk surface chipped at the edge', priority: 'low', status: 'in_progress', reported: -6, staff: 'Ramesh Prajapati' },
    { seat: 'Floor 2 — Common', issue: 'AC cooling weak in the afternoon shift', priority: 'high', status: 'open', reported: -3, staff: 'Ramesh Prajapati' },
    { seat: 'A-31', issue: 'Partition panel loose', priority: 'medium', status: 'resolved', reported: -12, resolved: -9, staff: 'Ramesh Prajapati' },
    { seat: 'B-02', issue: 'Drawer lock jammed', priority: 'low', status: 'resolved', reported: -16, resolved: -14, staff: 'Ramesh Prajapati' },
    { seat: 'C-30', issue: 'WiFi weak near the corner cabin', priority: 'medium', status: 'resolved', reported: -21, resolved: -18, staff: 'Imran Qureshi' },
  ];

  return items.map((item, i) => ({
    id: `maint-${i + 1}`,
    deskNumber: item.seat,
    issue: item.issue,
    priority: item.priority,
    status: item.status,
    reportedDate: offset(item.reported),
    reportedBy: STAFF[1 + (i % 2)].name,
    expectedResolution: item.status === 'resolved' ? offset(item.resolved) : offset(item.reported + 5),
    assignedStaff: item.staff,
    resolvedDate: item.status === 'resolved' ? offset(item.resolved) : null,
    blocksSeat: ['B-09', 'A-07'].includes(item.seat),
    notes: '',
  }));
};

// ============================================================
// Notifications
// ============================================================
const buildNotifications = () => [
  { id: 'notif-1', type: 'payment', title: 'Fee due today', message: 'Priya Sharma — ₹1,500 Monthly renewal is due today', time: '18 min ago', read: false, category: 'payment', link: '/billing/collection' },
  { id: 'notif-2', type: 'shift', title: 'Shift change request', message: 'Anjali Kumari requested Afternoon → Morning', time: '42 min ago', read: false, category: 'operations', link: '/assignments/shift-changes' },
  { id: 'notif-3', type: 'payment', title: 'Payment overdue', message: 'Aman Singh — ₹1,800 overdue by 2 days', time: '1 hour ago', read: false, category: 'payment', link: '/billing/collection' },
  { id: 'notif-4', type: 'maintenance', title: 'High priority maintenance', message: 'B-09 power socket not working', time: '3 hours ago', read: false, category: 'maintenance', link: '/maintenance' },
  { id: 'notif-5', type: 'seat', title: 'Seat temporarily released', message: 'B-14 released while Neha Singh is on leave', time: '5 hours ago', read: true, category: 'seat', link: '/seats/map' },
  { id: 'notif-6', type: 'expiry', title: 'Memberships expiring', message: '7 memberships expire within the next 7 days', time: 'Yesterday', read: true, category: 'membership', link: '/memberships/expiring' },
  { id: 'notif-7', type: 'attendance', title: 'Low attendance alert', message: 'Sneha Gupta has not checked in for 9 days', time: 'Yesterday', read: true, category: 'operations', link: '/attendance' },
  { id: 'notif-8', type: 'system', title: 'Daily backup complete', message: 'Data backup finished at 2:00 AM', time: '2 days ago', read: true, category: 'system', link: '/settings' },
];

// ============================================================
// Audit log
// ============================================================
const buildAuditLog = () => {
  const rows = [
    { action: 'seat_transferred', entity: 'Pooja Mishra', summary: 'Seat changed A-29 → C-21', before: 'A-29', after: 'C-21', by: 'Imran Qureshi', day: -6, time: '06:02 PM' },
    { action: 'shift_changed', entity: 'Pooja Mishra', summary: 'Shift changed Morning → Evening', before: 'Morning', after: 'Evening', by: 'Imran Qureshi', day: -6, time: '06:02 PM' },
    { action: 'membership_paused', entity: 'Neha Singh', summary: `Membership paused until ${offset(12)}`, before: 'Active', after: 'Paused', by: 'Rajesh Kumar', day: -3, time: '09:20 AM' },
    { action: 'seat_released', entity: 'Neha Singh', summary: 'B-14 temporarily released', before: 'Assigned', after: 'Temporarily Released', by: 'Rajesh Kumar', day: -3, time: '09:20 AM' },
    { action: 'payment_recorded', entity: 'Vikram Chauhan', summary: '₹7,800 Half Yearly received via UPI', before: 'Outstanding ₹7,800', after: 'Outstanding ₹0', by: 'Sunita Rawat', day: -2, time: '11:45 AM' },
    { action: 'membership_renewed', entity: 'Vikram Chauhan', summary: 'Half Yearly renewed', before: `Expiry ${offset(-2)}`, after: `Expiry ${offset(96)}`, by: 'Sunita Rawat', day: -2, time: '11:46 AM' },
    { action: 'maintenance_reported', entity: 'Seat B-09', summary: 'Power socket not working (High)', before: '—', after: 'Open', by: 'Imran Qureshi', day: -1, time: '08:30 AM' },
    { action: 'shift_requested', entity: 'Manish Tiwari', summary: 'Requested Morning → Evening', before: 'Morning', after: 'Evening (pending)', by: 'Sunita Rawat', day: -1, time: '11:24 AM' },
    { action: 'student_created', entity: 'Meghna Awasthi', summary: 'Added to waitlist', before: '—', after: 'Waitlisted', by: 'Sunita Rawat', day: -1, time: '03:10 PM' },
    { action: 'shift_approved', entity: 'Shreya Srivastava', summary: 'Approved Afternoon → Full Day', before: 'Pending', after: 'Approved', by: 'Rajesh Kumar', day: -1, time: '10:05 AM' },
    { action: 'shift_requested', entity: 'Anjali Kumari', summary: 'Requested Afternoon → Morning', before: 'Afternoon', after: 'Morning (pending)', by: 'Imran Qureshi', day: 0, time: '09:10 AM' },
    { action: 'attendance_marked', entity: 'Morning shift', summary: 'Bulk check-in recorded', before: '—', after: '38 present', by: 'Biometric', day: 0, time: '07:05 AM' },
    { action: 'maintenance_resolved', entity: 'Seat A-31', summary: 'Partition panel tightened', before: 'In Progress', after: 'Resolved', by: 'Ramesh Prajapati', day: -9, time: '02:15 PM' },
    { action: 'seat_blocked', entity: 'Seat D-20', summary: 'Blocked for staff use', before: 'Available', after: 'Blocked', by: 'Rajesh Kumar', day: -15, time: '09:00 AM' },
    { action: 'plan_updated', entity: 'Premium Monthly', summary: 'Price revised', before: '₹1,650', after: '₹1,800', by: 'Rajesh Kumar', day: -30, time: '06:30 PM' },
  ];

  return rows.map((r, i) => ({
    id: `audit-${i + 1}`,
    action: r.action,
    entity: r.entity,
    summary: r.summary,
    before: r.before,
    after: r.after,
    admin: r.by,
    date: offset(r.day),
    time: r.time,
    dateTime: `${offset(r.day)} ${r.time}`,
  })).sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1));
};

// ============================================================
// Initialise
// ============================================================
export const initializeMockData = () => {
  const rand = mulberry32(20260908);

  const desks = buildSeats();
  const students = buildStudents(desks, rand);
  const attendance = buildAttendance(students, rand);
  const payments = buildPayments(students, rand);
  const leaves = buildLeaves(students);
  const shiftChanges = buildShiftChanges(students);
  const assignmentHistory = buildAssignmentHistory(students);
  const waitlist = buildWaitlist();
  const expenses = buildExpenses();
  const maintenance = buildMaintenance();
  const notifications = buildNotifications();
  const auditLog = buildAuditLog();

  // Seat overrides that reflect the maintenance / blocked scenarios.
  const setOverride = (number, override) => {
    const seat = desks.find((d) => d.number === number);
    if (seat) seat.override = override;
  };
  setOverride('B-09', 'maintenance');
  setOverride('A-07', 'maintenance');
  setOverride('D-20', 'blocked');
  setOverride('D-19', 'blocked');
  setOverride('C-29', 'reserved');
  setOverride('C-30', 'reserved');

  // Apply the active leave: Neha Singh's seat is temporarily released.
  const activeLeave = leaves.find((l) => l.status === 'active');
  if (activeLeave) {
    const student = students.find((s) => s.id === activeLeave.studentId);
    const seat = desks.find((d) => d.number === activeLeave.deskNumber);
    if (student && seat) {
      student.membershipStatus = 'paused';
      student.onLeave = true;
      student.leaveId = activeLeave.id;
      student.status = 'on_leave';
      seat.temporary = {
        holderStudentId: student.id,
        tempStudentId: null,
        from: activeLeave.startDate,
        to: activeLeave.endDate,
        reason: activeLeave.reason,
      };
    }
  }

  return {
    center: CENTER,
    floors: FLOORS,
    slots: SLOTS.map((s) => ({ ...s, assigned: 0 })),
    membershipPlans: MEMBERSHIP_PLANS.map((p) => ({ ...p })),
    expenseCategories: EXPENSE_CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
    staff: STAFF,
    desks,
    students,
    attendance,
    payments,
    leaves,
    shiftChanges,
    assignmentHistory,
    waitlist,
    expenses,
    maintenance,
    notifications,
    auditLog,
  };
};
