import sqlite3 from 'sqlite3';

interface MigrationStep {
  version: string;
  description: string;
  run: (db: sqlite3.Database) => Promise<void>;
}

function runSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getScalar(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

const migrations: MigrationStep[] = [
  {
    version: '1.1',
    description: 'Align schema with full database plan — add missing columns, indexes, and fields',
    run: async (db) => {
      // ── app_settings ──
      try {
        await runSql(db, `CREATE TABLE app_settings_new (
          key        TEXT PRIMARY KEY,
          value      TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );`);
        await runSql(db, `INSERT INTO app_settings_new (key, value, updated_at) SELECT key, value, datetime('now') FROM app_settings;`);
        await runSql(db, `DROP TABLE app_settings;`);
        await runSql(db, `ALTER TABLE app_settings_new RENAME TO app_settings;`);
      } catch (e) {
        console.warn('[Migrations] app_settings: Migration failed or table already updated:', e);
      }

      // ── users ──
      const userCols = [
        `ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT 'Admin';`,
        `ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));`,
        `ALTER TABLE users ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
        `ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`,
        `ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));`,
      ];
      for (const sql of userCols) {
        try { await runSql(db, sql); } catch (e) { /* already exists */ }
      }

      // ── academic_years ──
      try {
        await runSql(db, `ALTER TABLE academic_years ADD COLUMN is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1));`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE academic_years ADD COLUMN opened_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE academic_years ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`);
      } catch (e) { /* already exists */ }

      // ── terms ──
      try {
        await runSql(db, `ALTER TABLE terms ADD COLUMN start_date TEXT;`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE terms ADD COLUMN end_date TEXT;`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE terms ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`);
      } catch (e) { /* already exists */ }

      // ── grades ──
      try {
        await runSql(db, `ALTER TABLE grades ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE grades ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE grades ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`);
      } catch (e) { /* already exists */ }

      // ── students ──
      const studentCols = [
        `ALTER TABLE students ADD COLUMN student_number TEXT DEFAULT NULL;`,
        `ALTER TABLE students ADD COLUMN date_enrolled TEXT NOT NULL DEFAULT (datetime('now'));`,
        `ALTER TABLE students ADD COLUMN notes TEXT;`,
        `ALTER TABLE students ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
        `ALTER TABLE students ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`,
        `ALTER TABLE students ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));`,
      ];
      for (const sql of studentCols) {
        try { await runSql(db, sql); } catch (e) { /* already exists */ }
      }

      // ── student_year_enrollment ──
      try {
        await runSql(db, `ALTER TABLE student_year_enrollment ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE student_year_enrollment ADD COLUMN enrolled_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE student_year_enrollment ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`);
      } catch (e) { /* already exists */ }

      // ── payments ──
      const paymentCols = [
        `ALTER TABLE payments ADD COLUMN grade_id INTEGER REFERENCES grades(id) ON DELETE RESTRICT;`,
        `ALTER TABLE payments ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash', 'ecocash', 'bank_transfer', 'other'));`,
        `ALTER TABLE payments ADD COLUMN is_voided INTEGER NOT NULL DEFAULT 0 CHECK(is_voided IN (0, 1));`,
        `ALTER TABLE payments ADD COLUMN voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
        `ALTER TABLE payments ADD COLUMN voided_at TEXT;`,
        `ALTER TABLE payments ADD COLUMN void_reason TEXT;`,
        `ALTER TABLE payments ADD COLUMN recorded_by INTEGER REFERENCES users(id) ON DELETE RESTRICT;`,
        `ALTER TABLE payments ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`,
      ];
      for (const sql of paymentCols) {
        try { await runSql(db, sql); } catch (e) { /* already exists */ }
      }

      // ── activity_log ──
      // Rename old `timestamp` column to `logged_at` if it exists (pre-v1.1 schema)
      try {
        await runSql(db, `ALTER TABLE activity_log RENAME COLUMN timestamp TO logged_at;`);
      } catch (e) { /* column likely already named logged_at or does not exist */ }
      try {
        await runSql(db, `ALTER TABLE activity_log ADD COLUMN entity TEXT;`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE activity_log ADD COLUMN entity_id INTEGER;`);
      } catch (e) { /* already exists */ }

      // ── create missing indexes ──
      const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
        `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
        `CREATE INDEX IF NOT EXISTS idx_terms_year_id ON terms(year_id);`,
        `CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);`,
        `CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name COLLATE NOCASE);`,
        `CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);`,
        `CREATE INDEX IF NOT EXISTS idx_enrollment_student_id ON student_year_enrollment(student_id);`,
        `CREATE INDEX IF NOT EXISTS idx_enrollment_year_id ON student_year_enrollment(year_id);`,
        `CREATE INDEX IF NOT EXISTS idx_enrollment_grade_id ON student_year_enrollment(grade_id);`,
        `CREATE INDEX IF NOT EXISTS idx_fee_structure_year_id ON fee_structure(year_id);`,
        `CREATE INDEX IF NOT EXISTS idx_fee_structure_grade_id ON fee_structure(grade_id);`,
        `CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);`,
        `CREATE INDEX IF NOT EXISTS idx_payments_year_id ON payments(year_id);`,
        `CREATE INDEX IF NOT EXISTS idx_payments_term_id ON payments(term_id);`,
        `CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);`,
        `CREATE INDEX IF NOT EXISTS idx_payments_receipt_number ON payments(receipt_number);`,
        `CREATE INDEX IF NOT EXISTS idx_payments_is_voided ON payments(is_voided);`,
        `CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);`,
        `CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);`,
        `CREATE INDEX IF NOT EXISTS idx_activity_log_logged_at ON activity_log(logged_at);`,
        `CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity, entity_id);`,
      ];
      for (const sql of indexes) {
        try { await runSql(db, sql); } catch (e) { console.warn('Index creation warning:', e); }
      }

      // ── update schema version ──
      await runSql(db, `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.1', datetime('now'));`);
    },
  },
];

export async function runMigrations(db: sqlite3.Database): Promise<void> {
  const setting = await getScalar(db, `SELECT value FROM app_settings WHERE key = 'schema_version'`);
  let currentVersion = setting?.value || '1.0';

  console.log(`[Migrations] Current schema version: ${currentVersion}`);

  for (const migration of migrations) {
    if (currentVersion < migration.version) {
      console.log(`[Migrations] Running ${migration.version}: ${migration.description}`);
      try {
        await migration.run(db);
        currentVersion = migration.version;
        console.log(`[Migrations] Completed ${migration.version}`);
      } catch (err) {
        console.error(`[Migrations] Failed on ${migration.version}:`, err);
        throw err;
      }
    }
  }

  console.log(`[Migrations] Schema up to date at version ${currentVersion}`);
}
