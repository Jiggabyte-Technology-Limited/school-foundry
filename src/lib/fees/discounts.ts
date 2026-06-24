/**
 * fees/discounts.ts — Discount rule engine.
 *
 * Discounts reduce the amount a student owes. Each discount is a rule with:
 *   - isApplicable(fees, context) → boolean  (quick check)
 *   - compute(fees, payments, context) → cents  (calculate the discount)
 *
 * Discounts are applied in precedence order:
 *   1. Bursary (fixed amount, highest priority — reduces what's owed)
 *   2. Staff ward (percentage or fixed)
 *   3. Sibling (percentage per sibling)
 *   4. Early payment (percentage if paid before a threshold date)
 *   5. Custom (admin override, applied last)
 *
 * The total discount can never exceed the fees total.
 */

import type { DiscountRule, DiscountType, DiscountContext, FeeEntry, PaymentEntry, DiscountBreakdown } from './balance';

// ── Built-in discount rules ──

const DISCOUNT_RULES: DiscountRule[] = [
  {
    type: 'bursary',
    label: 'Bursary',
    description: 'Fixed-amount bursary approved by the school. Reduces fees directly.',
    isApplicable: (_fees, ctx) => ctx.bursary_requested === true && (ctx.bursary_amount_cents ?? 0) > 0,
    compute: (_fees, _payments, ctx) => Math.max(0, ctx.bursary_amount_cents ?? 0),
  },
  {
    type: 'staff_ward',
    label: 'Staff Ward',
    description: '50% fee reduction for children of staff members.',
    isApplicable: (_fees, ctx) => ctx.is_staff_ward === true,
    compute: (fees, _payments, _ctx) => {
      const total = fees.reduce((sum, f) => sum + f.amount_cents, 0);
      return Math.round(total * 0.5);
    },
  },
  {
    type: 'sibling',
    label: 'Sibling Discount',
    description: '10% reduction per additional sibling enrolled (max 30%).',
    isApplicable: (_fees, ctx) => (ctx.sibling_count ?? 0) > 0,
    compute: (fees, _payments, ctx) => {
      const total = fees.reduce((sum, f) => sum + f.amount_cents, 0);
      const sibling_count = Math.min(ctx.sibling_count ?? 0, 3); // cap at 3 siblings
      const rate = sibling_count * 0.10; // 10% per sibling, max 30%
      return Math.round(total * rate);
    },
  },
  {
    type: 'early_payment',
    label: 'Early Payment Discount',
    description: '5% discount if full payment is made within 14 days of fee debit.',
    isApplicable: (fees, _ctx) => fees.length > 0, // always check; compute() validates dates
    compute: (fees, payments, _ctx) => {
      if (payments.length === 0) return 0;
      const total_fees = fees.reduce((sum, f) => sum + f.amount_cents, 0);
      const total_paid = payments.reduce((sum, p) => sum + p.amount_paid_cents, 0);
      if (total_paid < total_fees) return 0; // not fully paid

      // Check if all payments were made within 14 days of their corresponding fee debit
      const all_early = fees.every(fee => {
        const first_payment_for_fee = payments.find(p => p.payment_date >= fee.debit_date);
        if (!first_payment_for_fee) return false;
        const debit_date = new Date(fee.debit_date);
        const payment_date = new Date(first_payment_for_fee.payment_date);
        const days_diff = (payment_date.getTime() - debit_date.getTime()) / (1000 * 60 * 60 * 24);
        return days_diff <= 14;
      });

      return all_early ? Math.round(total_fees * 0.05) : 0;
    },
  },
  {
    type: 'custom',
    label: 'Custom Discount',
    description: 'Admin-specified discount (flat amount or percentage). Applied last.',
    isApplicable: (_fees, ctx) => (ctx.custom_discount_cents ?? 0) > 0,
    compute: (_fees, _payments, ctx) => Math.max(0, ctx.custom_discount_cents ?? 0),
  },
];

// ── Public API ──

/**
 * Compute all applicable discounts for a student.
 * Returns an array of discount breakdowns (one per applicable rule).
 * Total discount is capped at the fees total.
 */
export function computeDiscounts(
  fees: FeeEntry[],
  payments: PaymentEntry[],
  context: DiscountContext,
): DiscountBreakdown[] {
  const fee_total = fees.reduce((sum, f) => sum + f.amount_cents, 0);
  if (fee_total === 0) return [];

  const breakdowns: DiscountBreakdown[] = [];
  let remaining_cap = fee_total;

  for (const rule of DISCOUNT_RULES) {
    if (remaining_cap <= 0) break;
    if (!rule.isApplicable(fees, context)) continue;

    const amount = Math.min(rule.compute(fees, payments, context), remaining_cap);
    if (amount <= 0) continue;

    remaining_cap -= amount;
    breakdowns.push({
      type: rule.type,
      amount_cents: amount,
      description: rule.label,
      applies_to: fees.map(f => f.fee_structure_id),
    });
  }

  return breakdowns;
}

/**
 * Get a specific discount rule by type.
 */
export function getDiscountRule(type: DiscountType): DiscountRule | undefined {
  return DISCOUNT_RULES.find(r => r.type === type);
}

/**
 * Get all registered discount rules (for UI display / configuration).
 */
export function getAllDiscountRules(): DiscountRule[] {
  return [...DISCOUNT_RULES];
}

/**
 * Validate a discount configuration before applying.
 * Returns error message if invalid, or null if valid.
 */
export function validateDiscount(type: DiscountType, amount_cents: number): string | null {
  if (amount_cents < 0) return 'Discount amount cannot be negative';
  if (type === 'bursary' && amount_cents === 0) return 'Bursary amount must be greater than 0';
  if (type === 'custom' && amount_cents === 0) return 'Custom discount must be greater than 0';
  return null;
}
