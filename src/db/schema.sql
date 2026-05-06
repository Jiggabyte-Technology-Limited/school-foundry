-- School Fees Manager Schema v1.0
-- Currency: INTEGER (cents)

PRAGMA foreign_keys = ON;

-- Metadata & Versioning
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('schema_version', '1.0');

-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  username           TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL CHECK(role IN ('admin', 'bursar')),
  last_login_at      TEXT,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until       TEXT
);

-- Academic Structure
CREATE TABLE IF NOT EXISTS academic_years (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE -- e.g., '2026'
);

CREATE TABLE IF NOT EXISTS terms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id     INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_number INTEGER NOT NULL,
  label       TEXT NOT NULL,
  UNIQUE(year_id, term_number)
);

CREATE TABLE IF NOT EXISTS grades (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE -- e.g., 'Grade 7'
);

-- Fee Structure
CREATE TABLE IF NOT EXISTS fee_structure (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id        INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_id        INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  grade_id       INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  fee_type       TEXT NOT NULL DEFAULT 'tuition' 
                 CHECK(fee_type IN ('tuition', 'registration', 'levy', 'exam', 'other')),
  amount_cents   INTEGER NOT NULL CHECK(amount_cents >= 0),
  is_locked      INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
  UNIQUE(year_id, term_id, grade_id, fee_type)
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name          TEXT NOT NULL,
  date_of_birth      TEXT,
  gender             TEXT,
  guardian_name      TEXT NOT NULL,
  guardian_contact   TEXT NOT NULL,
  guardian_name_2    TEXT,
  guardian_contact_2 TEXT,
  guardian_email     TEXT,
  is_active          INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS student_year_enrollment (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year_id           INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade_id          INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  enrollment_status TEXT NOT NULL DEFAULT 'active' 
                    CHECK(enrollment_status IN ('active', 'withdrawn', 'transferred', 'expelled', 'completed'))
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id        INTEGER NOT NULL REFERENCES students(id),
  year_id           INTEGER NOT NULL REFERENCES academic_years(id),
  term_id           INTEGER NOT NULL REFERENCES terms(id),
  receipt_number    TEXT NOT NULL UNIQUE,
  amount_paid_cents INTEGER NOT NULL CHECK(amount_paid_cents > 0),
  payment_date      TEXT NOT NULL DEFAULT (datetime('now')),
  received_by       INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_receipts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id        INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  fee_owed_cents    INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  outstanding_cents INTEGER NOT NULL,
  generated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  generated_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username  TEXT,
  action    TEXT NOT NULL,
  details   TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
