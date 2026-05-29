-- School Fees Manager Schema v1.1
-- Currency: INTEGER (cents)
-- All timestamps: ISO 8601 UTC text (YYYY-MM-DDTHH:MM:SS)

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. app_settings — Global application configuration
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('schema_version', '1.1');

-- ============================================
-- 2. users — Staff accounts with roles
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name          TEXT    NOT NULL,
  username           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash      TEXT    NOT NULL,
  role               TEXT    NOT NULL CHECK(role IN ('admin', 'user')),
  is_active          INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at      TEXT,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until       TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);

-- ============================================
-- 3. academic_years — Academic year registry
-- ============================================
CREATE TABLE IF NOT EXISTS academic_years (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT    NOT NULL UNIQUE,
  is_current  INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
  opened_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 4. terms — Terms within each academic year
-- ============================================
CREATE TABLE IF NOT EXISTS terms (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id      INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_number  INTEGER NOT NULL,
  label        TEXT    NOT NULL,
  start_date   TEXT,
  end_date     TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year_id, term_number)
);

CREATE INDEX IF NOT EXISTS idx_terms_year_id ON terms(year_id);

-- ============================================
-- 5. grades — Grade/form levels offered by the school
-- ============================================
CREATE TABLE IF NOT EXISTS grades (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT    NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 6. students — Student registry (one row per student, persists across years)
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_number   TEXT    NOT NULL UNIQUE,
  full_name        TEXT    NOT NULL,
  date_of_birth    TEXT,
  gender           TEXT,
  guardian_name    TEXT NOT NULL,
  guardian_contact TEXT NOT NULL,
  guardian_name_2  TEXT,
  guardian_contact_2 TEXT,
  guardian_email   TEXT,
  date_enrolled    TEXT    NOT NULL DEFAULT (datetime('now')),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  notes            TEXT,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);
CREATE INDEX IF NOT EXISTS idx_students_full_name      ON students(full_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_students_is_active     ON students(is_active);

-- ============================================
-- 6a. class_sections — Subgrades/Class Sections (e.g. 1A, 1B)
-- ============================================
CREATE TABLE IF NOT EXISTS class_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(grade_id, label)
);

CREATE INDEX IF NOT EXISTS idx_class_sections_grade_id ON class_sections(grade_id);

-- ============================================
-- 7. student_year_enrollment — Links students to academic years and grades
-- ============================================
CREATE TABLE IF NOT EXISTS student_year_enrollment (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year_id      INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade_id     INTEGER NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  class_section_id INTEGER REFERENCES class_sections(id) ON DELETE SET NULL,
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  enrolled_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, year_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_student_id ON student_year_enrollment(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_year_id    ON student_year_enrollment(year_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_grade_id   ON student_year_enrollment(grade_id);

-- ============================================
-- 8. fee_structure — Fee amounts per grade per term per year
-- ============================================
CREATE TABLE IF NOT EXISTS fee_structure (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id     INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id     INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  grade_id    INTEGER NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  fee_type    TEXT    NOT NULL DEFAULT 'tuition'
              CHECK(fee_type IN ('tuition', 'registration', 'levy', 'exam', 'other')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  description TEXT,
  is_locked   INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year_id, term_id, grade_id, fee_type)
);

CREATE INDEX IF NOT EXISTS idx_fee_structure_year_id  ON fee_structure(year_id);
CREATE INDEX IF NOT EXISTS idx_fee_structure_grade_id ON fee_structure(grade_id);

-- ============================================
-- 9. payments — All payment transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  year_id         INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  term_id         INTEGER REFERENCES terms(id) ON DELETE SET NULL,
  grade_id        INTEGER REFERENCES grades(id) ON DELETE SET NULL,
  amount_paid_cents INTEGER NOT NULL CHECK(amount_paid_cents > 0),
  payment_date    TEXT    NOT NULL,
  receipt_number  TEXT    NOT NULL UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_payments_student_id     ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_year_id        ON payments(year_id);
CREATE INDEX IF NOT EXISTS idx_payments_term_id        ON payments(term_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date   ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_is_voided      ON payments(is_voided);

-- ============================================
-- 10. payment_receipts — Snapshot of receipt values at generation time
-- ============================================
CREATE TABLE IF NOT EXISTS payment_receipts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id        INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  fee_owed_cents    INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  outstanding_cents INTEGER NOT NULL,
  generated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  generated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 11. activity_log — Permanent audit trail of all system actions
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username   TEXT,
  action     TEXT    NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  logged_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id   ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action    ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_logged_at ON activity_log(logged_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity    ON activity_log(entity, entity_id);
