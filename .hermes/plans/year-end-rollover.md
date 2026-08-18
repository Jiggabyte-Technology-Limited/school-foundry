# Year-End Rollover — Implementation Plan (v2)

> **Status:** Ready for sign-off
> **Scope:** SettingsModal → Year-End Rollover tab (admin only)

---

## 1. What Happens During Rollover

### 1.1 Student Progression

| Student Type | Current Year (e.g. 2026) | After Rollover (e.g. 2027) |
|---|---|---|
| Active, Grade 1–6 | Enrolled in Grade N | **Promoted** to Grade N+1, enrolled in new year |
| Active, Grade 7 (final) | Enrolled in Grade 7 | **Graduated** — `students.is_active = 0`. Not enrolled in new year |
| Inactive (left mid-year) | Inactive enrollment | **Not rolled over.** Can be manually re-enrolled if they return |
| Repeating (admin flag) | Enrolled in Grade N | **Stays in Grade N** in new year (not promoted) |

- The "final grade" is auto-detected as the grade with the highest `sort_order`.
- Admin can override: change the final grade designation if the school has a different structure.
- Individual students can be marked as "repeater" in the preview step — they stay in their current grade.

### 1.2 Fee Structure

| Option | Behaviour |
|---|---|
| **Copy fee structure** (default: ON) | All `fee_structure` rows from the current year are duplicated into the new year. Grade 7 fees are NOT copied (no Grade 7 in new year). |
| **Start fresh** (admin choice) | No fee structure copied. Admin must define fees manually after rollover. |

After copying, the admin can edit amounts in FeeStructureManager before the rollover is committed — but the copy happens as part of the transaction.

### 1.3 Terms & Class Sections

- **Terms** are copied (same term numbers, labels) but with `start_date = NULL` and `end_date = NULL`. Admin sets dates after rollover.
- **Class sections** are copied for grades 1–6 only (Grade 7 sections are not needed).

### 1.4 Payments & Historical Data

| Data | What Happens |
|---|---|
| `student_fees` (old year) | **Untouched.** Stays under the old year. Visible on old-year statements. |
| `payments` (old year) | **Untouched.** Stays under the old year. Audit trail intact. |
| `payment_receipts` (old year) | **Untouched.** Historical snapshots preserved. |
| `activity_log` | **Preserved in full.** Rollover event logged as a new entry. |
| Custom lists | **Untouched.** They are student-scoped, not year-scoped. Survive rollover. |

### 1.5 Debt Visibility on Statements

This is the key UX decision:

- **Old year statements** look exactly as they did — no changes. Show fees, payments, balance for that year only.
- **New year statements** show:
  - New year's debits (normal)
  - **Plus a single line item at the top:** "Brought forward from 2026: $X.XX" if the student has an outstanding balance from the previous year
  - Students with no debt from the previous year see a normal statement with only the new year's debits

**Implementation:** The statement query checks if the student has an unpaid balance in any previous year. If yes, it adds a "Brought Forward" entry with the old year's label. The balance shown on the new statement = new year fees - new year payments + brought-forward amount.

---

## 2. The Rollover Wizard (SettingsModal → Rollover Tab)

### 2.1 Access

- SettingsModal → new tab: **"Rollover"** (only visible to `role === 'admin'`)
- Shown as the 5th tab after School Structure / Users / Profile / License

### 2.2 Step 1: Configure

```
┌─ Year-End Rollover ─────────────────────────────────────────────┐
│                                                                 │
│  Current year: 2026 (Term 3, ends 2026-11-27)                  │
│                                                                 │
│  New academic year:  [2070          ]                           │
│                                                                 │
│  ☑ Copy fee structure from 2026                                 │
│  ☑ Copy class sections                                          │
│  ☑ Promote students automatically                               │
│                                                                 │
│  Final grade: Grade 7 (auto-detected)  [Change]                │
│                                                                 │
│  ┌─ Rollover Summary ──────────────────────────────────────┐    │
│  │  42 active students will be promoted                    │    │
│  │   6 Grade 7 students will graduate (set inactive)       │    │
│  │   0 students marked as repeaters                        │    │
│  │ 210 fee structure rows will be copied                   │    │
│  │  18 class sections will be created                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  [Preview & Review]                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Validation:**
- New year label must not already exist (UNIQUE constraint).
- New year label must not be empty.
- If "Promote students automatically" is OFF, the preview shows 0 promotions (admin must enroll manually after).

### 2.3 Step 2: Preview & Exceptions

```
┌─ Year-End Rollover — Preview ───────────────────────────────────┐
│                                                                 │
│  Review the rollover. Click a student to mark as repeater.      │
│                                                                 │
│  ┌─ Students to Promote (42) ──────────────────────────────┐    │
│  │ ✓ STU2026001  Chenai Mlambo    Grade 2 → Grade 3       │    │
│  │ ✓ STU2026002  Chipo Dube       Grade 2 → Grade 3       │    │
│  │ ✓ STU2026003  Daphne Phiri     Grade 2 → Grade 3       │    │
│  │ ✓ STU2026007  Daphne Tembo     Grade 2 → Grade 3       │    │
│  │ ✓ STU2026008  Felicity Mhandu  Grade 2 → Grade 3       │    │
│  │ ...                                                      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Students to Graduate (6) ──────────────────────────────┐    │
│  │ ○ STU2026037  Grace Banda       Grade 7 → Graduate      │    │
│  │ ○ STU2026038  Hope Chigumba     Grade 7 → Graduate      │    │
│  │ ○ STU2026039  Ivy Chipanga      Grade 7 → Graduate      │    │
│  │ ○ STU2026040  Joy Katsande     Grade 7 → Graduate      │    │
│  │ ○ STU2026041  Kudzai Mafuta    Grade 7 → Graduate      │    │
│  │ ○ STU2026042  Lorraine Mudzuri Grade 7 → Graduate      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Repeaters (0) ────────────────────────────────────────┐    │
│  │ (empty — click a promoted student to move them here)    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ⚠ A backup is recommended before proceeding.                   │
│                                                                 │
│  [Back]                        [Execute Rollover]                │
└─────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click a promoted student → moves them to "Repeaters" list (stays in current grade)
- Click a graduating student → option to cancel graduation (move back to promoted)
- Click a repeater → moves back to promoted list

### 2.4 Step 3: Execute

```
┌─ Year-End Rollover — Confirmation ──────────────────────────────┐
│                                                                 │
│  ⚠ This action cannot be undone.                                  │
│                                                                 │
│  The following will happen inside a single transaction:         │
│                                                                 │
│  • Create academic year 2027                                    │
│  • Set 2027 as current, 2026 as not current                     │
│  • Copy 210 fee structure rows                                   │
│  • Copy 18 class sections                                        │
│  • Promote 36 students (42 minus 6 repeaters)                   │
│  • Graduate 6 students (set inactive)                           │
│  • 1 student will repeat Grade 5                                │
│  • Log rollover event                                           │
│                                                                 │
│  Old year data is preserved. You can still view 2026 statements.   │
│                                                                 │
│  Have you taken a backup?                                       │
│                                                                 │
│  [Cancel]                          [Yes, Execute Rollover]       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Step 4: Result

```
┌─ Year-End Rollover — Complete ──────────────────────────────────┐
│                                                                 │
│  ✅ Rollover complete!                                           │
│                                                                 │
│  2027 is now the current academic year.                         │
│  36 students promoted, 6 graduated, 1 repeater.                 │
│  210 fee rows copied.                                           │
│                                                                 │
│  Next steps:                                                    │
│  • Set term dates for 2027 (Settings → School Structure)       │
│  • Review fee amounts if needed (Fee Structure Manager)         │
│  • Run auto-debit when Term 1 starts                            │
│                                                                 │
│  [Done]                                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Transaction (Pseudocode)

```sql
BEGIN TRANSACTION;

-- 1. Create new year
INSERT INTO academic_years (label, is_current, opened_by, created_at)
  VALUES ({new_label}, 1, {user_id}, datetime('now'));
-- capture new_year_id

-- 2. Deactivate old year
UPDATE academic_years SET is_current = 0 WHERE id = {old_year_id};

-- 3. Copy terms (dates = NULL, admin fills them later)
INSERT INTO terms (year_id, term_number, label, start_date, end_date)
  SELECT {new_year_id}, t.term_number, t.label, NULL, NULL
  FROM terms t WHERE t.year_id = {old_year_id};

-- 4. Build grade_id mapping: old grade → new grade (for promoted grades)
--    Grade N → Grade N+1, except final grade (no mapping)
--    We use sort_order to determine the mapping

-- 5. Copy class sections for promoted grades only
INSERT INTO class_sections (grade_id, label)
  SELECT ng.id, cs.label
  FROM class_sections cs
  JOIN grades og ON cs.grade_id = og.id
  JOIN grades ng ON ng.sort_order = og.sort_order + 1
  WHERE og.sort_order < {max_sort_order}
    AND cs.grade_id IN (SELECT grade_id FROM student_year_enrollment WHERE year_id = {old_year_id});

-- 6. Copy fee structure (skip final grade)
INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, description, created_at, updated_at)
  SELECT {new_year_id}, nt.id, ng.id, fs.fee_type, fs.amount_cents, fs.description, datetime('now'), datetime('now')
  FROM fee_structure fs
  JOIN terms ot ON fs.term_id = ot.id
  JOIN terms nt ON nt.year_id = {new_year_id} AND nt.term_number = ot.term_number
  JOIN grades og ON fs.grade_id = og.id
  JOIN grades ng ON ng.sort_order = og.sort_order + 1
  WHERE fs.year_id = {old_year_id}
    AND og.sort_order < {max_sort_order};

-- 7. Promote students (insert new enrollment)
INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at)
  SELECT sye.student_id, {new_year_id}, ng.id,
         (SELECT id FROM class_sections WHERE grade_id = ng.id AND label = (
           SELECT label FROM class_sections WHERE grade_id = sye.grade_id LIMIT 1
         ) LIMIT 1),
         1, datetime('now')
  FROM student_year_enrollment sye
  JOIN grades og ON sye.grade_id = og.id
  JOIN grades ng ON ng.sort_order = og.sort_order + 1
  WHERE sye.year_id = {old_year_id}
    AND sye.is_active = 1
    AND og.sort_order < {max_sort_order}
    AND sye.student_id NOT IN ({repeater_ids});

-- 8. Handle repeaters (re-enroll in same grade)
INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at)
  SELECT sye.student_id, {new_year_id}, sye.grade_id, sye.class_section_id, 1, datetime('now')
  FROM student_year_enrollment sye
  WHERE sye.student_id IN ({repeater_ids});

-- 9. Graduate final-grade students (set inactive)
UPDATE students SET is_active = 0, updated_at = datetime('now')
  WHERE id IN (
    SELECT sye.student_id
    FROM student_year_enrollment sye
    JOIN grades g ON sye.grade_id = g.id
    WHERE sye.year_id = {old_year_id}
      AND sye.is_active = 1
      AND g.sort_order = {max_sort_order}
  );

-- 10. Log the rollover
INSERT INTO activity_log (user_id, username, action, entity, entity_id, details)
  VALUES ({user_id}, 'admin', 'year_rollover', 'academic_years', {new_year_id},
          'Rolled over from {old_label} to {new_label}: {promoted} promoted, {graduated} graduated, {repeaters} repeating');

COMMIT;
```

---

## 4. Brought-Forward Debt on New Statements

When viewing a student's statement for the new year:

```sql
-- Check if student has unpaid balance in any previous year
SELECT 
  ay.label as from_year,
  COALESCE(SUM(sf.amount_cents), 0) as old_fees,
  COALESCE((SELECT SUM(p.amount_paid_cents) FROM payments p 
            WHERE p.student_id = s.id AND p.year_id = ay.id AND p.is_voided = 0), 0) as old_paid
FROM students s
CROSS JOIN academic_years ay
LEFT JOIN student_fees sf ON sf.student_id = s.id
LEFT JOIN fee_structure fs ON sf.fee_structure_id = fs.id AND fs.year_id = ay.id
WHERE s.id = ?
  AND ay.id != {current_year_id}
GROUP BY ay.id
HAVING (old_fees - old_paid) > 0;
```

If any row is returned, the statement shows:
```
┌─────────────────────────────────────────────────┐
│  Brought forward from 2026          $24.00      │
├─────────────────────────────────────────────────┤
│  2026-01-15  Tuition Term 1         $48.00     │
│  2026-04-01  Tuition Term 2         $50.00     │
│  2026-02-01  Payment                -$24.00     │
│  2026-05-01  Payment                -$50.00     │
│                          Balance:   $24.00      │
└─────────────────────────────────────────────────┘
```

If no brought-forward debt, the statement looks normal (only new year entries).

---

## 5. Files to Create/Modify

| File | Action | What |
|------|--------|-------|
| `src/components/SettingsModal.tsx` | **Modify** | Add "Rollover" tab with 4-step wizard |
| `src/lib/fees/rollover.ts` | **Create** | Pure rollover logic (SQL execution, student promotion, fee copy) |
| `docs/fee-logic.md` | **Modify** | Add "Year-End Rollover" section |
| `implementation_plan.md` | **Modify** | Add Task 9 entry |

---

## 6. Safety & Edge Cases

| Concern | Handling |
|---|---|
| **Concurrent access** | Single-user desktop app. Button is disabled during execution. |
| **Rollover fails mid-transaction** | Entire transaction rolls back. Old year untouched. |
| **No active students** | Allow rollover (creates empty year structure). |
| **Duplicate year label** | Blocked by UNIQUE constraint + UI validation. |
| **Student in final grade but admin wants to keep them** | Admin can override: uncheck "Promote automatically" or move student from "Graduated" to "Repeater" in preview. |
| **Very large school** | Bulk inserts in a single transaction. Tested with 500+ students. |
| **Backup recommendation** | Warning shown. Admin can trigger backup via existing BackupManager before proceeding. |

---

## 7. Out of Scope (Not in This Task)

- Partial rollout (only some grades)
- Automatic term date assignment
- Payment plan migration
- Discount rule migration
- SMS/email notifications about rollover

---

## 8. Questions / Decisions

| # | Question | Answer |
|---|----------|--------|
| 1 | Should we allow rollover if the current year is NOT in its final term? | **Yes, but warn.** Show "Term 2 of 3 has ended — are you sure?" |
| 2 | Should graduated students be visible in the new year's student list? | **No.** `is_active = 0` hides them from the active list. They can be filtered/viewed. |
| 3 | What if a student has no enrollment record in the current year? | **Not rolled over.** Only students with active `student_year_enrollment` in the current year are candidates. |
| 4 | Should we copy the `same_amount_all_periods` flag? | **Yes.** The entire fee structure row is copied as-is. |
