# Fee Logic — Domain Model & Rules

> **Purpose:** Eliminate ambiguity around "what is owed, when, and how discounts apply."
> This document is the authoritative reference for fee computation. Any code that
> touches balances, fees, payments, or discounts MUST conform to these rules.

---

## 1. Data Model

### 1.1 fee_structure (the price list)

| Column | Type | Meaning |
|--------|------|---------|
| `year_id` | FK → academic_years | Which academic year this fee belongs to |
| `term_id` | FK → terms | Which term (Term 1, 2, 3…) |
| `grade_id` | FK → grades | Which grade/form level |
| `fee_type` | ENUM | `tuition`, `registration`, `levy`, `exam`, `other` |
| `amount_cents` | INTEGER | Fee amount in cents (never negative) |
| `description` | TEXT | Human label shown on statements (e.g. "Tuition — Term 2") |
| `same_amount_all_periods` | BOOLEAN | If true, fee repeats identically for each period in the year |
| `is_locked` | BOOLEAN | If true, fee is frozen and not affected by bulk edits |

**Key rule:** A fee is unique per `(year, term, grade, fee_type)`. A grade 10 student
in 2026 Term 1 has at most one `tuition` fee row.

### 1.2 student_fees (the debit ledger)

| Column | Type | Meaning |
|--------|------|---------|
| `student_id` | FK → students | Who is being charged |
| `fee_structure_id` | FK → fee_structure | Which fee they're being charged for |
| `debit_date` | TEXT (ISO date) | When the fee was debited (usually the term start date) |
| `amount_cents` | INTEGER | Actual amount debited (may differ from fee_structure.amount_cents if manually adjusted) |

**Key rule:** `UNIQUE(student_id, fee_structure_id)` — a student is debited at most once per fee entry.

### 1.3 payments (the credit ledger)

| Column | Type | Meaning |
|--------|------|---------|
| `student_id` | FK → students | Who paid |
| `year_id` | FK → academic_years | Which year the payment is credited to |
| `term_id` | FK → terms (nullable) | Which term (if payment is term-specific) |
| `amount_paid_cents` | INTEGER | Amount paid (always > 0) |
| `payment_date` | TEXT (ISO date) | When payment was received |
| `receipt_number` | TEXT (UNIQUE) | Receipt identifier |
| `payment_method` | ENUM | `cash`, `ecocash`, `bank_transfer`, `other` |
| `is_voided` | BOOLEAN | If true, payment is ignored in balance calculations |
| `voided_by` | FK → users | Who voided it |
| `void_reason` | TEXT | Why it was voided |

### 1.4 payment_receipts (receipt snapshots)

Immutable snapshot of the financial state at receipt generation time. Used for
historical reporting (what was outstanding when receipt #RCP-042 was printed).

---

## 2. Balance Computation

### 2.1 The Formula

```
balance_cents = SUM(student_fees.amount_cents)
              - SUM(payments.amount_paid_cents WHERE is_voided = 0)
              - SUM(discounts.amount_cents)
```

**All amounts are in cents. Never store or compute in floating-point dollars.**

### 2.2 Payment Application (FIFO)

Payments are applied to the **earliest debited fees first** (FIFO). This matters
when a student has fees from multiple terms:

1. Sort fees by `debit_date` ascending.
2. Sort payments by `payment_date` ascending.
3. Apply each payment to the oldest unpaid fee until the payment is exhausted.
4. Any remaining unpaid fees after all payments are applied = the balance.

**Example:**
- Fee 1 (Term 1): $50, debited 2026-01-15
- Fee 2 (Term 2): $50, debited 2026-04-01
- Payment 1: $30, paid 2026-02-01 → covers part of Fee 1 ($20 remaining on Fee 1)
- Payment 2: $40, paid 2026-05-01 → covers Fee 1 remainder ($20) + Fee 2 partial ($30 remaining on Fee 2)
- **Balance: $30** (remaining on Fee 2)

### 2.3 Overdue Determination

A fee is **overdue** when:
1. Its `debit_date` is in the past (≤ today), AND
2. It has an unpaid balance after FIFO payment application.

The **overdue amount** is the sum of unpaid portions of overdue fees.

### 2.4 Proration (Mid-Term Enrollment)

When a student enrolls mid-term, the auto-debit logic checks:
```sql
WHERE t.start_date IS NOT NULL
  AND t.start_date <= ?
  AND (t.end_date IS NULL OR date(t.end_date) >= date(sye.created_at))
```

This means a student is debited for a term if:
- The term has started, AND
- The term hasn't ended yet (or has no end date).

**Proration is NOT automatic.** The system does not split fees by week. The admin
decides whether to:
- Charge the full term amount (common for boarding schools)
- Manually adjust `student_fees.amount_cents` to a prorated value

---

## 3. Discount Rules

Discounts reduce what a student owes. They are applied in precedence order:

| Priority | Type | Rate | Description |
|----------|------|------|-------------|
| 1 | Bursary | Fixed amount | Admin-approved bursary. Reduces fees directly. |
| 2 | Staff Ward | 50% | Children of full-time staff. |
| 3 | Sibling | 10% per sibling (max 30%) | Each additional enrolled sibling. |
| 4 | Early Payment | 5% | Full payment within 14 days of debit. |
| 5 | Custom | Fixed or % | Admin override. Applied last. |

**Rules:**
- Total discount can never exceed total fees (balance can never go negative from discounts).
- Discounts are computed at statement generation time, not stored separately.
- To add persistent discount tracking, a `discounts` table can be introduced in Phase 4.

---

## 4. Auto-Debit Flow

The auto-debit process runs on app startup (via IPC `auto-debit-fees`):

1. Find all `fee_structure` rows where:
   - The term has started (`start_date <= today`)
   - The term hasn't ended (or has no end date)
   - The student is enrolled and active
   - No `student_fees` row already exists for this student + fee_structure

2. Insert a `student_fees` row for each match:
   - `debit_date` = term's `start_date`
   - `amount_cents` = `fee_structure.amount_cents`

3. Log the result in `activity_log`.

**Idempotent:** Running auto-debit twice does not double-debit. The `LEFT JOIN ... sf.id IS NULL`
clause prevents re-inserting existing debits.

---

## 5. Edge Cases

### 5.1 Student Transfers Mid-Term

- **Incoming student:** Enrolled via StudentWizard. Auto-debit picks them up on the
  next term start if `enrollment_date <= term.start_date`. For the current term,
  the admin manually creates a `student_fees` row with a prorated `amount_cents`.
- **Outgoing student:** Set `is_active = 0` on their enrollment. Auto-debit skips
  inactive enrollments. Existing `student_fees` remain (they may still owe for the
  current term).

### 5.2 Refunds

When a payment needs to be reversed:
1. **Do NOT delete the payment row.** Instead, set `is_voided = 1` with `voided_by`
   and `void_reason`.
2. The balance automatically increases by the voided amount on next computation.
3. If cash was physically returned, note it in `void_reason`.

### 5.3 Write-Offs

When a school decides to forgive a debt:
1. Create a `payments` row with:
   - `amount_paid_cents` = the amount being written off
   - `payment_method` = `'other'`
   - `receipt_number` = `WO-{YYYY}-{NNN}` (sequential)
   - `notes` = reason for write-off
2. This is functionally equivalent to a payment — it reduces the balance.

### 5.4 Same Amount All Periods

When `fee_structure.same_amount_all_periods = 1`:
- The fee amount is charged identically for every period in the year.
- Currently handled at the UI level (FeeStructureManager pre-fills the same amount
  across terms). The auto-debit logic reads from `fee_structure` per-term, so this
  flag is advisory for now.

### 5.5 Inactive Students

- Inactive students (`students.is_active = 0`) are excluded from auto-debit.
- Their existing `student_fees` and `payments` remain in the system.
- Their balance can still be computed and appears in historical reports.

### 5.6 Currency

All amounts are stored as **cents** (integer). The display layer converts using
the configured currency (`app_settings` key `currency`, default `USD`). Exchange
rate handling is out of scope for the current phase.

---

## 6. Extension Points

### 6.1 Reminders (Phase 4)

`computeOverdueAmount()` in `src/lib/fees/balance.ts` returns the overdue breakdown.
A cron job (or scheduled task) can call this for all students and generate SMS/email
reminders. The reminder logic is stubbed in `src/lib/fees/reminders.ts`.

### 6.2 Discount Persistence (Phase 4)

Currently discounts are computed at statement generation time. To persist them:
1. Add a `discounts` table: `(id, student_id, year_id, type, amount_cents, reason, created_by, created_at)`.
2. Store the `DiscountBreakdown[]` from `computeDiscounts()` when a statement is finalized.
3. Include `discounts` in the balance formula as a `SUM(amount_cents)` subquery.

### 6.3 Payment Plans (Phase 4)

Monthly/termly payment plans can be modeled as:
- A `payment_plans` table: `(student_id, year_id, plan_type, installment_cents, due_dates_json)`.
- Each installment becomes a "expected payment" shown on the statement.
- Overdue installments trigger reminders.

### 6.4 Fee Adjustments (Phase 4)

Per-student fee adjustments (e.g. "this student gets a $20 reduction on exam fees"):
- Add an `adjustments` table: `(student_id, fee_structure_id, adjustment_cents, reason)`.
- Include in the balance formula: `+ COALESCE(SUM(adjustments.adjustment_cents), 0)`.

---

## 7. Test Scenarios

These scenarios MUST be covered by unit tests on `computeBalance()`:

| Scenario | Fees | Payments | Expected Balance |
|----------|------|----------|------------------|
| Fully paid | $100 | $100 | $0 |
| Partially paid | $100 | $60 | $40 |
| Overpaid | $100 | $120 | $0 (never negative) |
| No payments | $100 | — | $100 |
| Multiple terms, FIFO | T1:$50, T2:$50 | $70 (paid Feb) | $30 (T1 fully paid, T2 partially) |
| Voided payment ignored | $100 | $50 (voided) | $100 |
| Bursary discount | $100 | — | $80 (with $20 bursary) |
| Sibling discount (1) | $100 | — | $90 (10% off) |
| Staff ward (50%) | $100 | — | $50 |
| Early payment (5%) | $100 | $100 (within 14 days) | $95 (discount applied to fees) |
| Mid-term enrollment | T1:$50, T2:$50 | — | $50 (only T2 debited) |
| Write-off | $100 | $100 (write-off receipt) | $0 |

---

## 8. File Map

| File | Role |
|------|------|
| `src/lib/fees/balance.ts` | Pure balance computation (`computeBalance`, `computeOverdueAmount`, `computeBalanceForGrade`) |
| `src/lib/fees/discounts.ts` | Discount rule engine (`computeDiscounts`, `getAllDiscountRules`) |
| `src/lib/fees/reminders.ts` | Stub for future SMS/email reminder integration |
| `src/lib/auto-debit.ts` | Auto-debit scheduler (runs on app startup) |
| `src/components/PaymentManager.tsx` | Payment UI — uses `computeBalance` for statements |
| `src/components/FeeStructureManager.tsx` | Fee structure CRUD — defines the price list |
| `docs/fee-logic.md` | This document |

---

## 9. Year-End Rollover

### 9.1 Overview

At the end of each academic year, the admin triggers a rollover to create the new year. This:

- Promotes active students to the next grade (Grade N → Grade N+1)
- Graduates final-grade students (sets `is_active = 0`)
- Creates a new academic year record
- Copies fee structure, terms, and class sections for promoted grades
- Preserves all historical data (payments, debits, enrollments, audit logs)
- Supports repeaters (individual students who stay in the same grade)

### 9.2 Rollover Flow

1. Admin opens Settings → Year Rollover tab
2. Configures: new year label, copy options, final grade
3. Preview: sees exactly what will happen (promotions, graduations, repeaters)
4. Confirm: executes inside a single transaction
5. Result: success/failure with full summary

### 9.3 What Happens to Each Entity

| Entity | What Happens |
|--------|-------------|
| `academic_years` | New row created with `is_current = 1`; old year set to `is_current = 0` |
| `terms` | Copied for new year with `start_date = NULL`, `end_date = NULL` |
| `class_sections` | Copied for grades 1–6 (not final grade) |
| `fee_structure` | Copied for grades 1–6 (not final grade) |
| `students` (active, non-final) | New enrollment in next grade |
| `students` (active, final grade) | `is_active = 0` (graduated) |
| `students` (inactive) | Not affected — not rolled over |
| `student_year_enrollment` (old year) | Preserved unchanged |
| `student_fees` (old year) | Preserved unchanged |
| `payments` (old year) | Preserved unchanged |
| `activity_log` | New entry logged: "Rolled over from X to Y: N promoted, M graduated, K repeating" |
| `custom_lists` | Not affected (student-scoped, not year-scoped) |

### 9.4 Brought-Forward Debt

If a student has an unpaid balance from the previous year, the new year's statement shows a "Brought forward from YYYY" line. This is computed by `getBroughtForwardDebts(studentId, currentYearId)` which checks all previous years for unpaid balances.

### 9.5 Repeaters

In the Preview step, the admin can click any promoted student to move them to the "Repeaters" list. Repeaters are re-enrolled in the same grade instead of being promoted.

### 9.6 Safety

- **Transaction**: The entire rollover is a single `BEGIN/COMMIT/ROLLBACK` transaction.
- **Idempotent**: Cannot roll over to a year that already exists (UNIQUE constraint on label).
- **Recoverable**: If it fails, the old year is untouched. A backup is recommended before proceeding.
- **Irreversible but non-destructive**: You can't undo a rollover, but no data is lost.
