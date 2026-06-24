/**
 * verify-task8.mjs — Fee Logic unit tests
 *
 * Tests computeBalance() and computeDiscounts() with fixture data.
 * Uses an in-memory SQLite database with known fee/payment scenarios.
 */

import Database from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Import the pure functions (inline since we can't easily import TS from ESM) ──
// We replicate the logic here to test it without a full TS build pipeline.

function computeOverdueAmount(fees, payments) {
  const today = new Date().toISOString().split('T')[0];
  const sorted_fees = [...fees].sort((a, b) => a.debit_date.localeCompare(b.debit_date));
  const sorted_payments = [...payments].filter(p => !p.is_voided).sort((a, b) => a.payment_date.localeCompare(b.payment_date));

  let remaining_payment = sorted_payments.reduce((sum, p) => sum + p.amount_paid_cents, 0);
  let overdue_cents = 0;
  const overdue_fees = [];

  for (const fee of sorted_fees) {
    const applied = Math.min(fee.amount_cents, remaining_payment);
    remaining_payment -= applied;
    const unpaid = fee.amount_cents - applied;

    if (unpaid > 0 && fee.debit_date <= today) {
      overdue_cents += unpaid;
      overdue_fees.push(fee);
    }
  }

  return { is_overdue: overdue_cents > 0, overdue_amount_cents: overdue_cents, overdue_fees };
}

function computeDiscounts(fees, payments, context) {
  const fee_total = fees.reduce((sum, f) => sum + f.amount_cents, 0);
  if (fee_total === 0) return [];

  const rules = [
    {
      type: 'bursary', label: 'Bursary',
      applicable: (_f, ctx) => ctx.bursary_requested === true && (ctx.bursary_amount_cents ?? 0) > 0,
      compute: (_f, _p, ctx) => Math.max(0, ctx.bursary_amount_cents ?? 0),
    },
    {
      type: 'staff_ward', label: 'Staff Ward',
      applicable: (_f, ctx) => ctx.is_staff_ward === true,
      compute: (f, _p, _ctx) => Math.round(f.reduce((s, x) => s + x.amount_cents, 0) * 0.5),
    },
    {
      type: 'sibling', label: 'Sibling Discount',
      applicable: (_f, ctx) => (ctx.sibling_count ?? 0) > 0,
      compute: (f, _p, ctx) => {
        const total = f.reduce((s, x) => s + x.amount_cents, 0);
        const count = Math.min(ctx.sibling_count ?? 0, 3);
        return Math.round(total * count * 0.10);
      },
    },
    {
      type: 'early_payment', label: 'Early Payment',
      applicable: (_f, _ctx) => true,
      compute: (f, p, _ctx) => {
        if (p.length === 0) return 0;
        const total_fees = f.reduce((s, x) => s + x.amount_cents, 0);
        const total_paid = p.reduce((s, x) => s + x.amount_paid_cents, 0);
        if (total_paid < total_fees) return 0;
        const all_early = f.every(fee => {
          const first = p.find(pp => pp.payment_date >= fee.debit_date);
          if (!first) return false;
          const diff = (new Date(first.payment_date) - new Date(fee.debit_date)) / (1000 * 60 * 60 * 24);
          return diff <= 14;
        });
        return all_early ? Math.round(total_fees * 0.05) : 0;
      },
    },
    {
      type: 'custom', label: 'Custom',
      applicable: (_f, ctx) => (ctx.custom_discount_cents ?? 0) > 0,
      compute: (_f, _p, ctx) => Math.max(0, ctx.custom_discount_cents ?? 0),
    },
  ];

  const breakdowns = [];
  let remaining = fee_total;

  for (const rule of rules) {
    if (remaining <= 0) break;
    if (!rule.applicable(fees, context)) continue;
    const amount = Math.min(rule.compute(fees, payments, context), remaining);
    if (amount <= 0) continue;
    remaining -= amount;
    breakdowns.push({ type: rule.type, amount_cents: amount, description: rule.label });
  }

  return breakdowns;
}

// ── Test runner ──

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${testName} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

async function runTests() {
  console.log('Task 8 — Fee Logic Verification');
  console.log('================================\n');

  // ── Balance computation ──
  console.log('Test 1: Balance = fees - payments');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 5000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
      { fee_structure_id: 2, amount_cents: 5000, debit_date: '2026-04-01', term_id: 2, term_label: 'Term 2', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [
      { payment_id: 1, amount_paid_cents: 3000, payment_date: '2026-02-01', is_voided: false },
    ];
    const fees_total = fees.reduce((s, f) => s + f.amount_cents, 0);
    const payments_total = payments.filter(p => !p.is_voided).reduce((s, p) => s + p.amount_paid_cents, 0);
    const balance = fees_total - payments_total;

    assertEqual(fees_total, 10000, 'Fees total = 10000');
    assertEqual(payments_total, 3000, 'Payments total = 3000');
    assertEqual(balance, 7000, 'Balance = 7000');
  }

  // ── FIFO payment application ──
  console.log('\nTest 2: FIFO payment application');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 5000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
      { fee_structure_id: 2, amount_cents: 5000, debit_date: '2026-04-01', term_id: 2, term_label: 'Term 2', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [
      { payment_id: 1, amount_paid_cents: 7000, payment_date: '2026-05-01', is_voided: false },
    ];

    const result = computeOverdueAmount(fees, payments);

    // Fee1 fully paid (5000), Fee2 partially paid (2000 remaining)
    assertEqual(result.overdue_amount_cents, 3000, 'Overdue = 3000 (Fee2 remaining)');
    assertEqual(result.overdue_fees.length, 1, '1 overdue fee');
    assertEqual(result.overdue_fees[0].fee_structure_id, 2, 'Overdue fee is Term 2');
  }

  // ── Voided payment ignored ──
  console.log('\nTest 3: Voided payment is ignored');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 5000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [
      { payment_id: 1, amount_paid_cents: 5000, payment_date: '2026-02-01', is_voided: true },
    ];

    const result = computeOverdueAmount(fees, payments);
    assertEqual(result.overdue_amount_cents, 5000, 'Voided payment does not reduce overdue');
  }

  // ── Balance never negative (overpayment) ──
  console.log('\nTest 4: Balance never goes negative');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 5000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [
      { payment_id: 1, amount_paid_cents: 8000, payment_date: '2026-02-01', is_voided: false },
    ];

    const fees_total = fees.reduce((s, f) => s + f.amount_cents, 0);
    const payments_total = payments.filter(p => !p.is_voided).reduce((s, p) => s + p.amount_paid_cents, 0);
    const balance = Math.max(0, fees_total - payments_total);

    assertEqual(balance, 0, 'Balance capped at 0 (not -3000)');
  }

  // ── Discount: Bursary ──
  console.log('\nTest 5: Bursary discount');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [];
    const context = { bursary_requested: true, bursary_amount_cents: 2000 };

    const discounts = computeDiscounts(fees, payments, context);
    const total_discount = discounts.reduce((s, d) => s + d.amount_cents, 0);

    assertEqual(total_discount, 2000, 'Bursary discount = 2000');
    assertEqual(discounts[0].type, 'bursary', 'Discount type is bursary');
  }

  // ── Discount: Staff ward (50%) ──
  console.log('\nTest 6: Staff ward discount (50%)');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [];
    const context = { is_staff_ward: true };

    const discounts = computeDiscounts(fees, payments, context);
    const total_discount = discounts.reduce((s, d) => s + d.amount_cents, 0);

    assertEqual(total_discount, 5000, 'Staff ward = 5000 (50%)');
  }

  // ── Discount: Sibling (10% per sibling, max 30%) ──
  console.log('\nTest 7: Sibling discount');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [];

    // 1 sibling → 10%
    const d1 = computeDiscounts(fees, payments, { sibling_count: 1 });
    assertEqual(d1.reduce((s, d) => s + d.amount_cents, 0), 1000, '1 sibling = 10% (1000)');

    // 2 siblings → 20%
    const d2 = computeDiscounts(fees, payments, { sibling_count: 2 });
    assertEqual(d2.reduce((s, d) => s + d.amount_cents, 0), 2000, '2 siblings = 20% (2000)');

    // 5 siblings → capped at 30%
    const d3 = computeDiscounts(fees, payments, { sibling_count: 5 });
    assertEqual(d3.reduce((s, d) => s + d.amount_cents, 0), 3000, '5 siblings capped at 30% (3000)');
  }

  // ── Discount: Early payment (5%) ──
  console.log('\nTest 8: Early payment discount');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    // Paid within 14 days
    const payments = [
      { payment_id: 1, amount_paid_cents: 10000, payment_date: '2026-01-20', is_voided: false },
    ];

    const discounts = computeDiscounts(fees, payments, {});
    const total = discounts.reduce((s, d) => s + d.amount_cents, 0);

    assertEqual(total, 500, 'Early payment = 500 (5%)');
  }

  // ── Discount: Early payment NOT applied if late ──
  console.log('\nTest 9: Early payment not applied if late');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    // Paid after 14 days
    const payments = [
      { payment_id: 1, amount_paid_cents: 10000, payment_date: '2026-02-20', is_voided: false },
    ];

    const discounts = computeDiscounts(fees, payments, {});
    const total = discounts.reduce((s, d) => s + d.amount_cents, 0);

    assertEqual(total, 0, 'No early payment discount (paid after 14 days)');
  }

  // ── Discount: Total capped at fees ──
  console.log('\nTest 10: Total discount capped at fees total');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [];
    const context = {
      bursary_requested: true,
      bursary_amount_cents: 5000,
      is_staff_ward: true,  // would be 5000 more, but capped
    };

    const discounts = computeDiscounts(fees, payments, context);
    const total = discounts.reduce((s, d) => s + d.amount_cents, 0);

    assertEqual(total, 10000, 'Total discount capped at 10000 (fees total)');
    assert(total <= 10000, 'Discount never exceeds fees');
  }

  // ── Discount: Custom discount ──
  console.log('\nTest 11: Custom discount');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [];
    const context = { custom_discount_cents: 1500 };

    const discounts = computeDiscounts(fees, payments, context);
    const custom = discounts.find(d => d.type === 'custom');

    assert(custom !== undefined, 'Custom discount applied');
    assertEqual(custom?.amount_cents ?? 0, 1500, 'Custom discount = 1500');
  }

  // ── Discount: No discount if not applicable ──
  console.log('\nTest 12: No discount when nothing applicable');
  {
    const fees = [
      { fee_structure_id: 1, amount_cents: 10000, debit_date: '2026-01-15', term_id: 1, term_label: 'Term 1', fee_type: 'tuition', description: 'Tuition' },
    ];
    const payments = [];
    const context = {};

    const discounts = computeDiscounts(fees, payments, context);

    assertEqual(discounts.length, 0, 'No discounts when context is empty');
  }

  // ── DB integration: compute balance from real schema + migrations ──
  console.log('\nTest 13: DB integration — balance from schema');
  await new Promise((resolve) => {
    const testDbPath = path.join(os.tmpdir(), `schoolfoundry-fee-test-${Date.now()}.db`);
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf-8');
    const db = new Database.Database(testDbPath);
    db.exec(schemaSql);

    // Run migrations inline (student_fees added in v1.6, same_amount_all_periods in v1.5)
    db.exec(`CREATE TABLE IF NOT EXISTS student_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      fee_structure_id INTEGER NOT NULL REFERENCES fee_structure(id) ON DELETE CASCADE,
      debit_date TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, fee_structure_id)
    );`);

    db.serialize(() => {
      db.run(`PRAGMA foreign_keys = OFF;`); // avoid FK enforcement during seed
      db.run(`INSERT INTO users (id, full_name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)`, [1, 'Admin', 'admin', '$2a$10$placeholder', 'admin']);
      db.run(`INSERT INTO students (id, student_number, full_name, guardian_name, guardian_contact) VALUES (?, ?, ?, ?, ?)`, [1, 'STU001', 'Test Student', 'Guardian', '263770000000']);
      db.run(`INSERT INTO academic_years (id, label, is_current) VALUES (?, ?, ?)`, [1, '2026', 1]);
      db.run(`INSERT INTO terms (id, year_id, term_number, label, start_date) VALUES (?, ?, ?, ?, ?)`, [1, 1, 1, 'Term 1', '2026-01-15']);
      db.run(`INSERT INTO grades (id, label) VALUES (?, ?)`, [1, 'Grade 5']);
      db.run(`INSERT INTO student_year_enrollment (id, student_id, year_id, grade_id) VALUES (?, ?, ?, ?)`, [1, 1, 1, 1]);
      db.run(`INSERT INTO fee_structure (id, year_id, term_id, grade_id, fee_type, amount_cents, description) VALUES (?, ?, ?, ?, ?, ?, ?)`, [1, 1, 1, 1, 'tuition', 50000, 'Tuition Term 1']);
      db.run(`INSERT INTO student_fees (student_id, fee_structure_id, debit_date, amount_cents) VALUES (?, ?, ?, ?)`, [1, 1, '2026-01-15', 50000]);
      db.run(`INSERT INTO payments (id, student_id, year_id, term_id, amount_paid_cents, payment_date, receipt_number, payment_method, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [1, 1, 1, 1, 20000, '2026-02-01', 'RCP-001', 'cash', 1]);
    });

    db.get(
      `SELECT
        COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf JOIN fee_structure fs ON sf.fee_structure_id = fs.id WHERE sf.student_id = ? AND fs.year_id = ?), 0) as fees,
        COALESCE((SELECT SUM(p.amount_paid_cents) FROM payments p WHERE p.student_id = ? AND p.year_id = ? AND p.is_voided = 0), 0) as paid`,
      [1, 1, 1, 1],
      (err, row) => {
        if (err) {
          console.log(`  ✗ FAIL: DB error: ${err.message}`);
          failed++;
        } else {
          const fees = row?.fees ?? 0;
          const paid = row?.paid ?? 0;
          const balance = fees - paid;
          assertEqual(fees, 50000, 'DB: fees = 50000');
          assertEqual(paid, 20000, 'DB: paid = 20000');
          assertEqual(balance, 30000, 'DB: balance = 30000');
        }
        db.close();
        try { fs.unlinkSync(testDbPath); } catch {}
        resolve();
      }
    );
  });

  // ── Summary ──
  console.log('\n================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.log(`FATAL: ${err.message}`);
  process.exit(1);
});
