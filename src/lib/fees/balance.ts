/**
 * fees/balance.ts — Pure balance computation engine.
 *
 * All balance-related logic lives here as pure functions. No UI, no DB writes,
 * no activity-log side effects — just data in, results out. This makes the
 * logic testable in isolation and reusable across the app (PaymentManager,
 * auto-debit, statement preview, future cron reminders, API endpoints).
 *
 * Public API:
 *   computeBalance(studentId, yearId) → BalanceResult
 *   computeBalanceForGrade(yearId, gradeId, termId?) → GradeBalanceResult
 */

import { db } from '../../db/init';

// ── Types ──

export interface FeeEntry {
  fee_structure_id: number;
  description: string;
  amount_cents: number;
  term_id: number;
  term_label: string;
  fee_type: string;
  debit_date: string;
}

export interface PaymentEntry {
  payment_id: number;
  receipt_number: string;
  amount_paid_cents: number;
  payment_date: string;
  payment_method: string;
  term_id: number | null;
  term_label: string | null;
  is_voided: boolean;
}

export interface BalanceResult {
  student_id: number;
  year_id: number;
  fees_total_cents: number;
  payments_total_cents: number;
  discounts_total_cents: number;
  balance_cents: number;          // = fees - payments - discounts
  is_overdue: boolean;            // true if balance > 0 and any fee is past due
  overdue_amount_cents: number;
  fee_entries: FeeEntry[];
  payment_entries: PaymentEntry[];
  discount_breakdown: DiscountBreakdown[];
}

export interface GradeBalanceResult {
  year_id: number;
  grade_id: number;
  term_id: number | null;
  expected_fees_cents: number;    // total fees for this grade/term
  student_count: number;
  total_expected_cents: number;
}

export interface DiscountBreakdown {
  type: DiscountType;
  amount_cents: number;
  description: string;
  applies_to: number[];  // fee_structure_ids this discount touches
}

export type DiscountType = 'sibling' | 'early_payment' | 'bursary' | 'staff_ward' | 'custom' | 'subsidy';

export interface DiscountRule {
  type: DiscountType;
  label: string;
  description: string;
  /**
   * Compute the discount amount for a given set of fees.
   * @param fees — the fee entries this student is being charged
   * @param payments — payments already made (for early-payment discount context)
   * @param context — additional context (sibling count, enrollment date, etc.)
   * @returns total discount in cents (always >= 0)
   */
  compute: (fees: FeeEntry[], payments: PaymentEntry[], context: DiscountContext) => number;
  /**
   * Whether this discount is currently applicable to this student.
   * Quick-check to avoid running expensive compute() when not relevant.
   */
  isApplicable: (fees: FeeEntry[], context: DiscountContext) => boolean;
}

export interface DiscountContext {
  sibling_count?: number;          // number of siblings enrolled at the school
  enrollment_date?: string;        // ISO date — for early-payment / proration
  is_staff_ward?: boolean;
  bursary_requested?: boolean;
  bursary_amount_cents?: number;    // fixed bursary if approved
  custom_discount_cents?: number;   // arbitrary admin override
}

// ── Core balance function ──

/**
 * Compute the full balance for a student in a given academic year.
 *
 * Pure function: fetches fees + payments internally (via injected fetchers)
 * but never writes to the database. Returns a complete balance breakdown.
 */
export async function computeBalance(
  studentId: number,
  yearId: number,
  fetchers?: BalanceFetchers,
): Promise<BalanceResult> {
  const { fetchFees, fetchPayments, fetchDiscounts } = defaultFetchers;

  const [fees, payments, discounts] = await Promise.all([
    (fetchers?.fetchFees ?? fetchFees)(studentId, yearId),
    (fetchers?.fetchPayments ?? fetchPayments)(studentId, yearId),
    (fetchers?.fetchDiscounts ?? fetchDiscounts)(studentId, yearId),
  ]);

  const fees_total = fees.reduce((sum, f) => sum + f.amount_cents, 0);
  const payments_total = payments
    .filter(p => !p.is_voided)
    .reduce((sum, p) => sum + p.amount_paid_cents, 0);

  const discount_breakdown = discounts || [];
  const discounts_total = discount_breakdown.reduce((sum, d) => sum + d.amount_cents, 0);

  const balance = Math.max(0, fees_total - payments_total - discounts_total);

  // Determine overdue status: any fee with debit_date in the past
  const today = new Date().toISOString().split('T')[0];
  const overdue_fees = fees.filter(f => f.debit_date <= today);
  const overdue_total = overdue_fees.reduce((sum, f) => {
    // Only count fees not fully covered by payments (simplified: pro-rata)
    return sum + f.amount_cents;
  }, 0);
  // Overdue amount = portion of overdue fees not covered by payments
  const overdue_amount = Math.max(0, Math.min(overdue_total, balance));

  return {
    student_id: studentId,
    year_id: yearId,
    fees_total_cents: fees_total,
    payments_total_cents: payments_total,
    discounts_total_cents: discounts_total,
    balance_cents: balance,
    is_overdue: balance > 0 && overdue_amount > 0,
    overdue_amount_cents: overdue_amount,
    fee_entries: fees,
    payment_entries: payments.filter(p => !p.is_voided),
    discount_breakdown,
  };
}

// ── Grade-level balance (for projections / fee-structure planning) ──

/**
 * Compute total expected fees for a grade in a given year/term.
 * Used by the fee-structure manager and dashboard projections.
 */
export async function computeBalanceForGrade(
  yearId: number,
  gradeId: number,
  termId: number | null,
  fetchers?: GradeBalanceFetchers,
): Promise<GradeBalanceResult> {
  const { fetchGradeFees, fetchEnrollmentCount } = defaultGradeFetchers;

  const fees = await (fetchers?.fetchGradeFees ?? fetchGradeFees)(yearId, gradeId, termId);
  const student_count = await (fetchers?.fetchEnrollmentCount ?? fetchEnrollmentCount)(yearId, gradeId);

  const expected_fees = fees.reduce((sum, f) => sum + f.expected_amount_cents, 0);

  return {
    year_id: yearId,
    grade_id: gradeId,
    term_id: termId,
    expected_fees_cents: expected_fees,
    student_count,
    total_expected_cents: expected_fees * student_count,
  };
}

// ── Overdue determination ──

/**
 * Given a list of fee entries and payment entries, determine which fees
 * are overdue (debit_date in the past and not yet fully paid) and how much
 * is overdue. Uses FIFO ordering: payments applied to earliest fees first.
 */
export function computeOverdueAmount(fees: FeeEntry[], payments: PaymentEntry[]): {
  is_overdue: boolean;
  overdue_amount_cents: number;
  overdue_fees: FeeEntry[];
} {
  const today = new Date().toISOString().split('T')[0];

  // Sort fees by debit_date (FIFO)
  const sorted_fees = [...fees].sort((a, b) => a.debit_date.localeCompare(b.debit_date));

  // Sort payments by date (FIFO)
  const sorted_payments = [...payments]
    .filter(p => !p.is_voided)
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date));

  let remaining_payment = sorted_payments.reduce((sum, p) => sum + p.amount_paid_cents, 0);
  let overdue_cents = 0;
  const overdue_fees: FeeEntry[] = [];

  for (const fee of sorted_fees) {
    // Apply remaining payment to this fee
    const applied = Math.min(fee.amount_cents, remaining_payment);
    remaining_payment -= applied;
    const unpaid = fee.amount_cents - applied;

    // Is this fee overdue? (debit_date in past and still unpaid)
    if (unpaid > 0 && fee.debit_date <= today) {
      overdue_cents += unpaid;
      overdue_fees.push(fee);
    }
  }

  return {
    is_overdue: overdue_cents > 0,
    overdue_amount_cents: overdue_cents,
    overdue_fees,
  };
}

// ── Fetcher signatures (for dependency injection in tests) ──

export interface BalanceFetchers {
  fetchFees: (studentId: number, yearId: number) => Promise<FeeEntry[]>;
  fetchPayments: (studentId: number, yearId: number) => Promise<PaymentEntry[]>;
  fetchDiscounts: (studentId: number, yearId: number) => Promise<DiscountBreakdown[]>;
}

export interface GradeBalanceFetchers {
  fetchGradeFees: (yearId: number, gradeId: number, termId: number | null) => Promise<{ expected_amount_cents: number }[]>;
  fetchEnrollmentCount: (yearId: number, gradeId: number) => Promise<number>;
}

// ── Default fetchers (wire to the app's DB) ──

async function defaultFeesFetcher(studentId: number, yearId: number): Promise<FeeEntry[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sf.fee_structure_id, fs.description, sf.amount_cents, fs.term_id,
              t.label as term_label, fs.fee_type, sf.debit_date
       FROM student_fees sf
       JOIN fee_structure fs ON sf.fee_structure_id = fs.id
       JOIN terms t ON fs.term_id = t.id
       WHERE sf.student_id = ? AND fs.year_id = ?
       ORDER BY sf.debit_date`,
      [studentId, yearId],
      (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as FeeEntry[]);
      }
    );
  });
}

async function defaultPaymentsFetcher(studentId: number, yearId: number): Promise<PaymentEntry[]> {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT p.id as payment_id, p.receipt_number, p.amount_paid_cents, p.payment_date,
              p.payment_method, p.term_id, t.label as term_label, p.is_voided
       FROM payments p
       LEFT JOIN terms t ON p.term_id = t.id
       WHERE p.student_id = ? AND p.year_id = ?
       ORDER BY p.payment_date`,
      [studentId, yearId],
      (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as PaymentEntry[]);
      }
    );
  });
}

async function defaultDiscountsFetcher(studentId: number, yearId: number): Promise<DiscountBreakdown[]> {
  return new Promise((resolve) => {
    db.all(
      `SELECT sf.fee_structure_id, fs.description, sf.amount_cents, fs.term_id,
              t.label as term_label, fs.fee_type, sf.debit_date
       FROM student_fees sf
       JOIN fee_structure fs ON sf.fee_structure_id = fs.id
       JOIN terms t ON fs.term_id = t.id
       WHERE sf.student_id = ? AND fs.year_id = ?
       ORDER BY sf.debit_date`,
      [studentId, yearId],
      (feeErr: Error | null, feeRows: any[]) => {
        if (feeErr || !feeRows || feeRows.length === 0) {
          resolve([]);
          return;
        }

        db.all(
          `SELECT ss.*, sp.name as provider_name, sp.provider_type
           FROM student_subsidies ss
           JOIN subsidy_providers sp ON ss.provider_id = sp.id
           WHERE ss.student_id = ? AND ss.year_id = ? AND ss.is_active = 1`,
          [studentId, yearId],
          (subErr: Error | null, subRows: any[]) => {
            if (subErr || !subRows || subRows.length === 0) {
              resolve([]);
              return;
            }

            const deductions: DiscountBreakdown[] = [];
            const fees = feeRows as FeeEntry[];

            for (const sub of subRows) {
              const applicableFees = sub.term_id
                ? fees.filter(f => f.term_id === sub.term_id)
                : fees;
              if (applicableFees.length === 0) continue;

              const totalCents = applicableFees.reduce((s, f) => s + f.amount_cents, 0);
              let amountCents = 0;
              if (sub.coverage_type === 'full_100') {
                amountCents = totalCents;
              } else if (sub.coverage_type === 'percentage') {
                amountCents = Math.round((totalCents * sub.coverage_value) / 100);
              } else if (sub.coverage_type === 'fixed_amount') {
                amountCents = Math.min(totalCents, sub.coverage_value);
              }

              if (amountCents > 0) {
                deductions.push({
                  type: 'subsidy',
                  amount_cents: amountCents,
                  description: `Sponsored: ${sub.provider_name}${sub.grant_reference_number ? ` (${sub.grant_reference_number})` : ''}`,
                  applies_to: applicableFees.map(f => f.fee_structure_id),
                });
              }
            }
            resolve(deductions);
          }
        );
      }
    );
  });
}

async function defaultGradeFeesFetcher(yearId: number, gradeId: number, termId: number | null): Promise<{ expected_amount_cents: number }[]> {
  const query = termId
    ? `SELECT amount_cents as expected_amount_cents FROM fee_structure WHERE year_id = ? AND grade_id = ? AND term_id = ?`
    : `SELECT amount_cents as expected_amount_cents FROM fee_structure WHERE year_id = ? AND grade_id = ?`;
  const params = termId ? [yearId, gradeId, termId] : [yearId, gradeId];

  return new Promise((resolve, reject) => {
    db.all(query, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows as { expected_amount_cents: number }[]);
    });
  });
}

async function defaultEnrollmentCountFetcher(yearId: number, gradeId: number): Promise<number> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT COUNT(*) as c FROM student_year_enrollment WHERE year_id = ? AND grade_id = ? AND is_active = 1',
      [yearId, gradeId],
      (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row?.c || 0);
      }
    );
  });
}

const defaultFetchers: BalanceFetchers = {
  fetchFees: defaultFeesFetcher,
  fetchPayments: defaultPaymentsFetcher,
  fetchDiscounts: defaultDiscountsFetcher,
};

const defaultGradeFetchers: GradeBalanceFetchers = {
  fetchGradeFees: defaultGradeFeesFetcher,
  fetchEnrollmentCount: defaultEnrollmentCountFetcher,
};
