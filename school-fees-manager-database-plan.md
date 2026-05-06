# 🗄️ School Fees Manager — Database Plan
> Complete database specification for the School Fees Manager desktop application.
> Engine: **SQLite** via `better-sqlite3` in Electron.js

---

## 📐 Design Principles

- **SQLite** is used as the local embedded database — single `.db` file, zero configuration, fully offline.
- All timestamps are stored as **ISO 8601 UTC text** (`YYYY-MM-DDTHH:MM:SS`) for portability.
- All monetary values are stored as **REAL** (floating point) in USD or local currency — consistent throughout.
- **Soft deletes** are used throughout — records are never hard deleted, only marked inactive/voided. This preserves history and audit integrity.
- **Foreign key enforcement** is enabled explicitly on every connection: `PRAGMA foreign_keys = ON;`
- **Activity logging** is non-negotiable — every write operation produces a log entry.
- All tables include `created_at`. Tables with mutable records also include `updated_at`.

---

## 🗂️ Table Index

| # | Table | Purpose |
|---|---|---|
| 1 | `app_settings` | Global application configuration and school info |
| 2 | `users` | Staff accounts with roles |
| 3 | `academic_years` | Academic year registry |
| 4 | `terms` | Terms within each academic year |
| 5 | `grades` | Grade/form levels offered by the school |
| 6 | `students` | Student registry |
| 7 | `student_year_enrollment` | Links students to academic years and grades |
| 8 | `fee_structure` | Fee amounts per grade per term per year |
| 9 | `payments` | All payment transactions |
| 10 | `activity_log` | Permanent audit trail of all system actions |

---

## 📋 Table Definitions

---

### 1. `app_settings`

Stores global key-value configuration for the application. Seeded on first run.

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Seeded Rows

| key | Example Value | Description |
|---|---|---|
| `school_name` | `Mutare High School` | Displayed on receipts and reports |
| `school_address` | `123 Main Rd, Mutare` | Displayed on receipts |
| `school_phone` | `+263 20 123456` | Displayed on receipts |
| `school_logo_path` | `/assets/logo.png` | Path to school logo image |
| `currency_symbol` | `USD` | Currency label used in reports |
| `current_year_id` | `1` | FK reference to active academic year |
| `license_key` | `XXXX-XXXX-XXXX-XXXX` | Machine-locked license key |
| `machine_id` | `a3f9...` | Hardware fingerprint hash |
| `app_version` | `1.0.0` | Installed app version |
| `last_backup_at` | `2025-07-14T10:30:00` | Timestamp of last backup |

---

### 2. `users`

All staff accounts that can log into the application.

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT    NOT NULL,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('admin', 'bursar', 'viewer')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `username` | Case-insensitive unique. No spaces. |
| `password_hash` | bcrypt hash, minimum cost factor 10. Never store plain text. |
| `role` | `admin` — full access. `bursar` — record/view payments. `viewer` — read-only reports. |
| `is_active` | `0` = deactivated. Deactivated users cannot log in but their records are preserved in logs. |
| `created_by` | Which admin created this account. NULL for the first admin (self-created on setup). |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
```

#### Role Permissions Summary

| Action | admin | bursar | viewer |
|---|---|---|---|
| Manage users | ✅ | ❌ | ❌ |
| Configure fee structure | ✅ | ❌ | ❌ |
| Add/edit students | ✅ | ✅ | ❌ |
| Record payments | ✅ | ✅ | ❌ |
| Void payments | ✅ | ❌ | ❌ |
| View all reports | ✅ | ✅ | ✅ |
| View activity log | ✅ | ❌ | ❌ |
| Backup / Restore | ✅ | ❌ | ❌ |
| Open new academic year | ✅ | ❌ | ❌ |

---

### 3. `academic_years`

Registry of all academic years in the system.

```sql
CREATE TABLE IF NOT EXISTS academic_years (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year_label  TEXT    NOT NULL UNIQUE,
  is_current  INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
  opened_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `year_label` | Human-readable label, e.g. `2025` or `2025/2026`. Must be unique. |
| `is_current` | Only one row should ever have `is_current = 1` at a time. Enforced at application layer. |
| `opened_by` | Admin who created/opened this year. |

#### Business Rules
- When a new academic year is opened, the previous year's `is_current` is set to `0`.
- The new year is seeded with all active students from the previous year via `student_year_enrollment`.
- Fee structure is **not** automatically copied — admin must configure it (but a "copy from last year" helper is provided in the UI).

---

### 4. `terms`

The three terms within each academic year.

```sql
CREATE TABLE IF NOT EXISTS terms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id      INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_number  INTEGER NOT NULL CHECK(term_number IN (1, 2, 3)),
  term_name    TEXT    NOT NULL,
  start_date   TEXT,
  end_date     TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year_id, term_number)
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `term_number` | Always 1, 2, or 3. |
| `term_name` | Display label, e.g. `Term 1`, `First Term`. |
| `start_date` / `end_date` | Optional. Used for date-range filtering in reports. Format: `YYYY-MM-DD`. |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_terms_year_id ON terms(year_id);
```

#### Seed on Year Creation
When a new academic year is opened, three term rows are automatically inserted:
```
Term 1, Term 2, Term 3 — all linked to the new year_id
```

---

### 5. `grades`

The grade/form levels offered at the school. Configurable by admin.

```sql
CREATE TABLE IF NOT EXISTS grades (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT    NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Example Data

| id | label | sort_order |
|---|---|---|
| 1 | Form 1 | 1 |
| 2 | Form 2 | 2 |
| 3 | Form 3 | 3 |
| 4 | Form 4 | 4 |
| 5 | Form 5 | 5 |
| 6 | Form 6L | 6 |
| 7 | Form 6U | 7 |

#### Notes
- Using a `grades` table rather than a free-text field on students ensures consistency in reports and prevents typos like `"Form 3"` vs `"form3"` vs `"F3"`.
- `sort_order` controls display ordering in dropdowns and reports.

---

### 6. `students`

The core student registry. One row per student, persists across all years.

```sql
CREATE TABLE IF NOT EXISTS students (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_number   TEXT    NOT NULL UNIQUE,
  full_name        TEXT    NOT NULL,
  date_of_birth    TEXT,
  guardian_name    TEXT,
  guardian_contact TEXT,
  date_enrolled    TEXT    NOT NULL,
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  notes            TEXT,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `student_number` | School-assigned registration number. Unique. Used on receipts. |
| `full_name` | Full legal name. Searchable. |
| `date_of_birth` | Optional. Format: `YYYY-MM-DD`. |
| `guardian_name` | Primary parent or guardian. |
| `guardian_contact` | Phone number for contact. |
| `date_enrolled` | Date the student first enrolled at the school. |
| `is_active` | `0` = left the school. Historical data is preserved. |
| `notes` | Any admin notes (bursary, scholarship, etc.). |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_full_name      ON students(full_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_students_is_active      ON students(is_active);
```

#### Design Note — Grade is NOT on the student table
A student's grade changes every year. Grade is stored on `student_year_enrollment` (see table 7), not on the student record itself. This correctly models the reality that a student is in Form 2 in 2024 and Form 3 in 2025.

---

### 7. `student_year_enrollment`

Links a student to an academic year and records what grade they are in that year. This is the bridge table that tracks grade progression.

```sql
CREATE TABLE IF NOT EXISTS student_year_enrollment (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year_id      INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade_id     INTEGER NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  enrolled_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, year_id)
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `student_id` | The student. |
| `year_id` | The academic year. |
| `grade_id` | The grade the student is in during this year. |
| `is_active` | Set to `0` if a student withdraws mid-year. |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_enrollment_student_id ON student_year_enrollment(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_year_id    ON student_year_enrollment(year_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_grade_id   ON student_year_enrollment(grade_id);
```

#### Why This Table Exists
Without this table, you cannot correctly answer:
- "What grade was this student in during 2023?"
- "Who were all the Form 3 students in 2024?"
- "What fees applied to this student in Term 2 of 2023?" (requires knowing their grade that year)

---

### 8. `fee_structure`

Defines the fee amount owed for a specific grade, in a specific term, in a specific academic year.

```sql
CREATE TABLE IF NOT EXISTS fee_structure (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id     INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id     INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  grade_id    INTEGER NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  amount      REAL    NOT NULL CHECK(amount >= 0),
  description TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year_id, term_id, grade_id)
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `amount` | The full fee owed for this grade/term/year. |
| `description` | Optional label, e.g. "Includes development levy". |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_fee_structure_year_id  ON fee_structure(year_id);
CREATE INDEX IF NOT EXISTS idx_fee_structure_grade_id ON fee_structure(grade_id);
```

#### Example Data

| year | term | grade | amount |
|---|---|---|---|
| 2025 | Term 1 | Form 1 | 150.00 |
| 2025 | Term 1 | Form 2 | 150.00 |
| 2025 | Term 1 | Form 4 | 180.00 |
| 2025 | Term 2 | Form 1 | 150.00 |

---

### 9. `payments`

Every payment transaction ever recorded. The heart of the system.

```sql
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  year_id         INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  term_id         INTEGER NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  grade_id        INTEGER NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  amount_paid     REAL    NOT NULL CHECK(amount_paid > 0),
  payment_date    TEXT    NOT NULL,
  receipt_number  TEXT    NOT NULL,
  payment_method  TEXT    NOT NULL CHECK(payment_method IN (
                    'cash', 'ecocash', 'bank_transfer', 'other'
                  )),
  notes           TEXT,
  is_voided       INTEGER NOT NULL DEFAULT 0 CHECK(is_voided IN (0, 1)),
  voided_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  voided_at       TEXT,
  void_reason     TEXT,
  recorded_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `grade_id` | Snapshot of the student's grade at time of payment. Prevents issues if grade data changes. |
| `amount_paid` | The amount actually paid in this transaction. May be less than the full fee (partial payment). |
| `payment_date` | The real-world date the money was received. Format: `YYYY-MM-DD`. |
| `receipt_number` | Manual entry matching the physical receipt book. Must be recorded for reconciliation. |
| `payment_method` | How the payment was made. |
| `is_voided` | `1` = this payment has been cancelled/reversed. Voided payments are excluded from balance calculations. |
| `voided_by` | Admin who voided the payment. Only admin role can void. |
| `void_reason` | Required when voiding — explains why the payment was reversed. |
| `recorded_by` | Staff member who entered this payment into the system. |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_payments_student_id    ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_year_id       ON payments(year_id);
CREATE INDEX IF NOT EXISTS idx_payments_term_id       ON payments(term_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date  ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_is_voided     ON payments(is_voided);
```

#### Business Rules
- Multiple payments per student per term are allowed (partial payments).
- Total paid = sum of all non-voided payments for that student + term.
- Outstanding = fee_structure.amount − total paid. Can be negative (overpayment) — flag in UI.
- Payments are never deleted. Mistakes are corrected by voiding and re-entering.

---

### 10. `activity_log`

A permanent, append-only audit trail. Every meaningful action in the system writes a row here.

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT,
  action     TEXT    NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  logged_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

#### Column Notes

| Column | Detail |
|---|---|
| `user_id` | FK to the user who performed the action. |
| `username` | Snapshot of the username at time of action. Preserved even if user is later renamed. |
| `action` | Standardised action code (see list below). |
| `entity` | The table/entity affected, e.g. `students`, `payments`. |
| `entity_id` | The ID of the affected record. |
| `details` | JSON string with additional context — old values, new values, reasons. |

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action    ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_logged_at ON activity_log(logged_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity    ON activity_log(entity, entity_id);
```

#### Standardised Action Codes

| Action Code | Trigger |
|---|---|
| `USER_LOGIN` | Successful login |
| `USER_LOGIN_FAILED` | Failed login attempt |
| `USER_LOGOUT` | User logs out |
| `USER_CREATED` | New user account created |
| `USER_UPDATED` | User account edited |
| `USER_DEACTIVATED` | User account deactivated |
| `STUDENT_CREATED` | New student added |
| `STUDENT_UPDATED` | Student record edited |
| `STUDENT_DEACTIVATED` | Student marked inactive |
| `PAYMENT_RECORDED` | New payment entered |
| `PAYMENT_VOIDED` | Payment voided |
| `FEE_STRUCTURE_SET` | Fee amount configured |
| `YEAR_OPENED` | New academic year created |
| `BACKUP_CREATED` | Database backup exported |
| `BACKUP_RESTORED` | Database restored from backup |
| `SETTINGS_UPDATED` | App settings changed |

#### Example Log Entry (details field as JSON)
```json
{
  "action": "PAYMENT_VOIDED",
  "entity": "payments",
  "entity_id": 142,
  "details": {
    "student_name": "Tatenda Moyo",
    "student_number": "STU-0044",
    "receipt_number": "REC-2025-0312",
    "amount": 75.00,
    "void_reason": "Duplicate entry — same payment entered twice"
  }
}
```

---

## 🔗 Entity Relationship Overview

```
app_settings          (standalone config)

users
  └──< payments           (recorded_by, voided_by)
  └──< activity_log       (user_id)
  └──< students           (created_by)
  └──< fee_structure      (created_by)
  └──< academic_years     (opened_by)
  └──< student_year_enrollment (enrolled_by)

academic_years
  └──< terms
        └──< fee_structure >── grades
        └──< payments      >── students
                           >── grades

students
  └──< student_year_enrollment >── academic_years
  │                            >── grades
  └──< payments
```

---

## 🔍 Key Queries

### Outstanding Balance — Single Student, Single Term
```sql
SELECT
  fs.amount                                        AS fee_owed,
  COALESCE(SUM(p.amount_paid), 0)                  AS total_paid,
  fs.amount - COALESCE(SUM(p.amount_paid), 0)      AS outstanding
FROM fee_structure fs
JOIN student_year_enrollment sye
  ON sye.student_id = :student_id
  AND sye.year_id   = :year_id
  AND sye.grade_id  = fs.grade_id
LEFT JOIN payments p
  ON  p.student_id = :student_id
  AND p.year_id    = :year_id
  AND p.term_id    = :term_id
  AND p.is_voided  = 0
WHERE fs.year_id = :year_id
  AND fs.term_id = :term_id
GROUP BY fs.amount;
```

---

### Student Statement — Custom Date Range (All Terms + Years)
```sql
SELECT
  ay.year_label,
  t.term_name,
  g.label                                          AS grade,
  fs.amount                                        AS fee_owed,
  COALESCE(SUM(p.amount_paid), 0)                  AS total_paid,
  fs.amount - COALESCE(SUM(p.amount_paid), 0)      AS balance
FROM student_year_enrollment sye
JOIN academic_years ay  ON ay.id  = sye.year_id
JOIN terms t            ON t.year_id = ay.id
JOIN grades g           ON g.id   = sye.grade_id
JOIN fee_structure fs   ON fs.year_id  = sye.year_id
                       AND fs.term_id  = t.id
                       AND fs.grade_id = sye.grade_id
LEFT JOIN payments p    ON  p.student_id = sye.student_id
                        AND p.year_id    = sye.year_id
                        AND p.term_id    = t.id
                        AND p.is_voided  = 0
WHERE sye.student_id  = :student_id
  AND ay.year_label  >= :from_year
  AND ay.year_label  <= :to_year
GROUP BY ay.id, t.id
ORDER BY ay.year_label ASC, t.term_number ASC;
```

---

### Full Grade Report — Who Has Paid / Who Hasn't (One Term)
```sql
SELECT
  s.student_number,
  s.full_name,
  g.label                                          AS grade,
  fs.amount                                        AS fee_owed,
  COALESCE(SUM(p.amount_paid), 0)                  AS total_paid,
  fs.amount - COALESCE(SUM(p.amount_paid), 0)      AS outstanding,
  CASE
    WHEN COALESCE(SUM(p.amount_paid), 0) >= fs.amount THEN 'PAID'
    WHEN COALESCE(SUM(p.amount_paid), 0) > 0           THEN 'PARTIAL'
    ELSE 'UNPAID'
  END                                              AS status
FROM students s
JOIN student_year_enrollment sye ON sye.student_id = s.id
                                 AND sye.year_id   = :year_id
JOIN grades g                    ON g.id = sye.grade_id
JOIN fee_structure fs             ON fs.year_id  = :year_id
                                 AND fs.term_id  = :term_id
                                 AND fs.grade_id = sye.grade_id
LEFT JOIN payments p              ON p.student_id = s.id
                                 AND p.year_id   = :year_id
                                 AND p.term_id   = :term_id
                                 AND p.is_voided = 0
WHERE sye.grade_id = :grade_id
  AND s.is_active  = 1
GROUP BY s.id
ORDER BY s.full_name ASC;
```

---

### Outstanding Fees — All Students, Across All Terms, One Year
```sql
SELECT
  s.student_number,
  s.full_name,
  g.label                                              AS grade,
  SUM(fs.amount)                                       AS total_owed,
  COALESCE(SUM(p.amount_paid), 0)                      AS total_paid,
  SUM(fs.amount) - COALESCE(SUM(p.amount_paid), 0)    AS total_outstanding
FROM students s
JOIN student_year_enrollment sye ON sye.student_id = s.id
                                 AND sye.year_id   = :year_id
JOIN grades g                    ON g.id = sye.grade_id
JOIN terms t                     ON t.year_id = :year_id
JOIN fee_structure fs             ON fs.year_id  = :year_id
                                 AND fs.term_id  = t.id
                                 AND fs.grade_id = sye.grade_id
LEFT JOIN payments p              ON p.student_id = s.id
                                 AND p.year_id   = :year_id
                                 AND p.is_voided = 0
WHERE s.is_active = 1
GROUP BY s.id
HAVING total_outstanding > 0
ORDER BY total_outstanding DESC;
```

---

## 🚀 Initialisation & Migration Strategy

### First Run Sequence
1. Check if the `.db` file exists at the app data path.
2. If not — run the full `CREATE TABLE IF NOT EXISTS` script (schema v1).
3. Seed `app_settings` with defaults.
4. Seed `grades` with default Form 1–6 levels.
5. Prompt admin to complete setup wizard: school name, logo, first admin account, first academic year.

### Schema Versioning
Track the current schema version in `app_settings`:
```sql
INSERT INTO app_settings (key, value) VALUES ('schema_version', '1');
```

On every app launch:
1. Read `schema_version` from `app_settings`.
2. Compare against the latest version bundled in the app.
3. If behind — run the appropriate migration scripts in order.
4. Update `schema_version` after each migration.

### Migration Script Naming Convention
```
migrations/
  001_initial_schema.sql
  002_add_payment_method_other.sql
  003_add_student_notes_column.sql
```

---

## 💾 Backup Strategy

The backup is a **full copy of the SQLite `.db` file**, optionally encrypted using AES-256 before writing to disk.

### Backup File
- Format: Encrypted binary `.bak` file
- Filename: `SchoolFees_Backup_YYYY-MM-DD_HHMMSS.bak`
- Contains: The entire database — all students, payments, users, logs, settings

### Restore Process
1. User selects a `.bak` file.
2. App decrypts the file using the app's built-in key.
3. The decrypted `.db` is written to the app data path, replacing the current database.
4. App restarts and loads the restored data.

### License on Restore
- After restore on a new machine, the `machine_id` in `app_settings` will not match the new hardware.
- The app detects this mismatch and prompts for a new license key.
- The admin contacts the developer to re-issue a license for the new machine.
- This is the designed migration path — backup solves the data problem, license re-issue solves the activation problem.

---

## 📁 Database File Location

The `.db` file is stored in the OS app data directory — not in the install folder (which may be read-only).

```
Windows:  C:\Users\<username>\AppData\Roaming\SchoolFeesManager\data.db
```

This path is accessed in Electron via:
```javascript
const { app } = require('electron');
const dbPath = path.join(app.getPath('userData'), 'data.db');
```

---

## ✅ Summary Checklist

- [x] All tables use `INTEGER PRIMARY KEY AUTOINCREMENT`
- [x] All foreign keys defined with appropriate `ON DELETE` behaviour
- [x] `PRAGMA foreign_keys = ON` enforced on every connection
- [x] Soft deletes used throughout — no hard deletes on business data
- [x] Payments are never deleted — only voided with reason
- [x] Activity log is append-only — no update or delete operations on this table
- [x] All timestamps in ISO 8601 UTC text format
- [x] Monetary values stored as REAL
- [x] Grade stored on enrollment, not on student — supports year-on-year grade progression
- [x] Schema versioning built in from day one
- [x] Backup/restore strategy defined
