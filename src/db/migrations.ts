import sqlite3 from 'sqlite3';

interface MigrationStep {
  version: string;
  description: string;
  run: (db: sqlite3.Database) => Promise<void>;
}

function runSql(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => {
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
    run: async db => {
      // ── app_settings ──
      try {
        await runSql(
          db,
          `CREATE TABLE app_settings_new (
          key        TEXT PRIMARY KEY,
          value      TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );`
        );
        await runSql(
          db,
          `INSERT INTO app_settings_new (key, value, updated_at) SELECT key, value, datetime('now') FROM app_settings;`
        );
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
        try {
          await runSql(db, sql);
        } catch (e) {
          /* already exists */
        }
      }

      // ── academic_years ──
      try {
        await runSql(
          db,
          `ALTER TABLE academic_years ADD COLUMN is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1));`
        );
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE academic_years ADD COLUMN opened_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`
        );
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE academic_years ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`
        );
      } catch (e) {
        /* already exists */
      }

      // ── terms ──
      try {
        await runSql(db, `ALTER TABLE terms ADD COLUMN start_date TEXT;`);
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(db, `ALTER TABLE terms ADD COLUMN end_date TEXT;`);
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE terms ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`
        );
      } catch (e) {
        /* already exists */
      }

      // ── grades ──
      try {
        await runSql(db, `ALTER TABLE grades ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`);
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE grades ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));`
        );
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE grades ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`
        );
      } catch (e) {
        /* already exists */
      }

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
        try {
          await runSql(db, sql);
        } catch (e) {
          /* already exists */
        }
      }

      // ── student_year_enrollment ──
      try {
        await runSql(
          db,
          `ALTER TABLE student_year_enrollment ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));`
        );
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE student_year_enrollment ADD COLUMN enrolled_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`
        );
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE student_year_enrollment ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`
        );
      } catch (e) {
        /* already exists */
      }

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
        try {
          await runSql(db, sql);
        } catch (e) {
          /* already exists */
        }
      }

      // ── activity_log ──
      // Rename old `timestamp` column to `logged_at` if it exists (pre-v1.1 schema)
      try {
        await runSql(db, `ALTER TABLE activity_log RENAME COLUMN timestamp TO logged_at;`);
      } catch (e) {
        /* column likely already named logged_at or does not exist */
      }
      try {
        await runSql(db, `ALTER TABLE activity_log ADD COLUMN entity TEXT;`);
      } catch (e) {
        /* already exists */
      }
      try {
        await runSql(db, `ALTER TABLE activity_log ADD COLUMN entity_id INTEGER;`);
      } catch (e) {
        /* already exists */
      }

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
        try {
          await runSql(db, sql);
        } catch (e) {
          console.warn('Index creation warning:', e);
        }
      }

      // ── fee_structure columns (ensuring description exists) ──
      const feeCols = [
        `ALTER TABLE fee_structure ADD COLUMN description TEXT;`,
        `ALTER TABLE fee_structure ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
        `ALTER TABLE fee_structure ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`,
        `ALTER TABLE fee_structure ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));`,
      ];
      for (const sql of feeCols) {
        try {
          await runSql(db, sql);
        } catch (e) {
          /* already exists */
        }
      }

      // ── update schema version ──
      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.1', datetime('now'));`
      );
    },
  },
  {
    version: '1.2',
    description:
      'Ensure missing columns in fee_structure and payments are added (fix for v1.1 gaps)',
    run: async db => {
      // ── fee_structure ──
      const feeCols = [
        `ALTER TABLE fee_structure ADD COLUMN description TEXT;`,
        `ALTER TABLE fee_structure ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
        `ALTER TABLE fee_structure ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`,
        `ALTER TABLE fee_structure ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));`,
      ];
      for (const sql of feeCols) {
        try {
          await runSql(db, sql);
        } catch (e) {
          /* already exists */
        }
      }

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
        try {
          await runSql(db, sql);
        } catch (e) {
          /* already exists */
        }
      }

      // ── activity_log ──
      try {
        await runSql(db, `ALTER TABLE activity_log RENAME COLUMN timestamp TO logged_at;`);
      } catch (e) {
        /* already exists or not supported */
      }
      try {
        await runSql(
          db,
          `ALTER TABLE activity_log ADD COLUMN logged_at TEXT NOT NULL DEFAULT (datetime('now'));`
        );
      } catch (e) {
        /* already exists */
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.2', datetime('now'));`
      );
    },
  },
  {
    version: '1.3',
    description: 'Add missing notes column to payments table',
    run: async db => {
      try {
        await runSql(db, `ALTER TABLE payments ADD COLUMN notes TEXT;`);
      } catch (e) {
        console.warn('[Migrations] payments: notes column already exists:', e);
      }
      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.3', datetime('now'));`
      );
    },
  },
  {
    version: '1.4',
    description: 'Restrict user roles to admin and user; migrate bursar/viewer to user',
    run: async db => {
      // Recreate users table to update CHECK constraint and migrate roles simultaneously
      try {
        // Disable foreign keys temporarily to allow table recreation
        await runSql(db, `PRAGMA foreign_keys = OFF;`);

        // Drop temporary table if it exists from a previous failed run
        await runSql(db, `DROP TABLE IF EXISTS users_new;`);

        await runSql(
          db,
          `CREATE TABLE users_new (
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
        );`
        );

        // Insert into new table while mapping 'bursar' and 'viewer' to 'user'
        await runSql(
          db,
          `INSERT INTO users_new (id, full_name, username, password_hash, role, is_active, created_by, created_at, updated_at, last_login_at, failed_login_count, locked_until)
                          SELECT 
                            id, 
                            full_name, 
                            username, 
                            password_hash, 
                            CASE WHEN role IN ('bursar', 'viewer') THEN 'user' ELSE role END, 
                            is_active, 
                            created_by, 
                            created_at, 
                            updated_at, 
                            last_login_at, 
                            failed_login_count, 
                            locked_until 
                          FROM users;`
        );

        await runSql(db, `DROP TABLE users;`);
        await runSql(db, `ALTER TABLE users_new RENAME TO users;`);

        // Re-create indexes
        await runSql(db, `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
        await runSql(db, `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`);

        // Re-enable foreign keys
        await runSql(db, `PRAGMA foreign_keys = ON;`);
      } catch (e) {
        // Ensure foreign keys are back on even if it fails
        await runSql(db, `PRAGMA foreign_keys = ON;`);
        console.error('[Migrations] users role update FAILED:', e);
        throw e;
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.4', datetime('now'));`
      );
    },
  },
  {
    version: '1.5',
    description: 'Add payment period type and same-amount tracking for fee structure',
    run: async db => {
      // Add period_type column to terms table
      try {
        await runSql(
          db,
          `ALTER TABLE terms ADD COLUMN period_type TEXT CHECK(period_type IN ('term', 'month', 'quarter', 'half_year', 'custom'));`
        );
      } catch (e) {
        /* already exists */
      }

      // Add same_amount_all_periods column to fee_structure table
      try {
        await runSql(
          db,
          `ALTER TABLE fee_structure ADD COLUMN same_amount_all_periods INTEGER NOT NULL DEFAULT 0 CHECK(same_amount_all_periods IN (0, 1));`
        );
      } catch (e) {
        /* already exists */
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.5', datetime('now'));`
      );
    },
  },
  {
    version: '1.6',
    description: 'Add student_fees table for tracking debited fees with dates',
    run: async db => {
      // Create student_fees table to track when fees are applied to each student
      try {
        await runSql(
          db,
          `
          CREATE TABLE IF NOT EXISTS student_fees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            fee_structure_id INTEGER NOT NULL REFERENCES fee_structure(id) ON DELETE CASCADE,
            debit_date TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(student_id, fee_structure_id)
          );
        `
        );
      } catch (e) {
        /* table may already exist */
      }

      // Add index for faster queries
      try {
        await runSql(
          db,
          `CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id);`
        );
      } catch (e) {
        /* index may exist */
      }
      try {
        await runSql(
          db,
          `CREATE INDEX IF NOT EXISTS idx_student_fees_debit_date ON student_fees(debit_date);`
        );
      } catch (e) {
        /* index may exist */
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.6', datetime('now'));`
      );
    },
  },
  {
    version: '1.7',
    description: 'Make term_id and grade_id nullable in payments table',
    run: async db => {
      // Make term_id nullable in payments (payments no longer tied to specific terms)
      try {
        await runSql(db, `ALTER TABLE payments ALTER COLUMN term_id DROP NOT NULL;`);
      } catch (e) {
        console.warn('[Migrations] payments: term_id already nullable:', e);
      }
      // Make grade_id nullable in payments
      try {
        await runSql(db, `ALTER TABLE payments ALTER COLUMN grade_id DROP NOT NULL;`);
      } catch (e) {
        console.warn('[Migrations] payments: grade_id already nullable:', e);
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.7', datetime('now'));`
      );
    },
  },
  {
    version: '1.8',
    description: 'Add class_sections and class_section_id to student_year_enrollment',
    run: async db => {
      try {
        await runSql(
          db,
          `CREATE TABLE IF NOT EXISTS class_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(grade_id, label)
          );`
        );
        await runSql(
          db,
          `CREATE INDEX IF NOT EXISTS idx_class_sections_grade_id ON class_sections(grade_id);`
        );
      } catch (e) {
        console.warn('[Migrations] class_sections creation warning:', e);
      }

      try {
        await runSql(db, `ALTER TABLE student_year_enrollment ADD COLUMN class_section_id INTEGER REFERENCES class_sections(id) ON DELETE SET NULL;`);
      } catch (e) {
        /* already exists */
      }

      await runSql(
        db,
        `INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('enable_subgrades', 'false', datetime('now'));`
      );

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.8', datetime('now'));`
      );
    },
  },
  {
    version: '1.9',
    description: 'Add date_of_birth to students table if missing',
    run: async db => {
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN date_of_birth TEXT;`);
        console.log('[Migrations] Added date_of_birth column to students table.');
      } catch (e) {
        console.warn('[Migrations] students: date_of_birth column already exists or other error:', e);
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '1.9', datetime('now'));`
      );
    },
  },
  {
    version: '2.0',
    description: 'Add deactivated_at to students table if missing',
    run: async db => {
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN deactivated_at TEXT;`);
        console.log('[Migrations] Added deactivated_at column to students table.');
      } catch (e) {
        console.warn('[Migrations] students: deactivated_at column already exists or other error:', e);
      }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2.0', datetime('now'));`
      );
    },
  },
  {
    version: '2.1',
    description: 'Add custom_lists + custom_list_members tables (Task 6)',
    run: async db => {
      // custom_lists: saved subsets of students. Soft-deletable via deleted_at.
      await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS custom_lists (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
          description TEXT,
          created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at  TEXT,
          deleted_at  TEXT
        );`
      );

      // M-N between custom_lists and students. CASCADE on both sides so
      // deleting a list or a student cleans up its membership rows.
      await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS custom_list_members (
          list_id    INTEGER NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id)     ON DELETE CASCADE,
          added_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          PRIMARY KEY (list_id, student_id)
        );`
      );

      // Reverse lookup: which lists does this student belong to?
      await runSql(
        db,
        `CREATE INDEX IF NOT EXISTS idx_custom_list_members_student
           ON custom_list_members(student_id);`
      );

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2.1', datetime('now'));`
      );
    },
  },
  {
    version: '2.2',
    description: 'Split full_name into first_name + surname for students and guardians',
    run: async db => {
      // -- Student name split --
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN first_name TEXT;`);
        console.log('[Migrations] Added first_name to students.');
      } catch (e) {
        console.warn('[Migrations] students.first_name already exists:', e);
      }
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN surname TEXT;`);
        console.log('[Migrations] Added surname to students.');
      } catch (e) {
        console.warn('[Migrations] students.surname already exists:', e);
      }

      // Backfill: take first word as first_name, rest as surname
      await runSql(db, `
        UPDATE students
        SET first_name = TRIM(SUBSTR(full_name, 1, INSTR(full_name, ' ') - 1)),
            surname    = TRIM(SUBSTR(full_name, INSTR(full_name, ' ') + 1))
        WHERE first_name IS NULL AND full_name IS NOT NULL AND INSTR(full_name, ' ') > 0
      `);
      // Edge case: single-word names → put in first_name, surname empty
      await runSql(db, `
        UPDATE students
        SET first_name = TRIM(full_name),
            surname    = ''
        WHERE first_name IS NULL AND full_name IS NOT NULL
      `);

      // -- Guardian 1 name split --
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN guardian_first_name TEXT;`);
      } catch (e) { /* exists */ }
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN guardian_surname TEXT;`);
      } catch (e) { /* exists */ }

      await runSql(db, `
        UPDATE students
        SET guardian_first_name = TRIM(SUBSTR(guardian_name, 1, INSTR(guardian_name, ' ') - 1)),
            guardian_surname    = TRIM(SUBSTR(guardian_name, INSTR(guardian_name, ' ') + 1))
        WHERE guardian_first_name IS NULL AND guardian_name IS NOT NULL AND INSTR(guardian_name, ' ') > 0
      `);
      await runSql(db, `
        UPDATE students
        SET guardian_first_name = TRIM(guardian_name),
            guardian_surname    = ''
        WHERE guardian_first_name IS NULL AND guardian_name IS NOT NULL
      `);

      // -- Guardian 2 name split --
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN guardian_first_name_2 TEXT;`);
      } catch (e) { /* exists */ }
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN guardian_surname_2 TEXT;`);
      } catch (e) { /* exists */ }

      await runSql(db, `
        UPDATE students
        SET guardian_first_name_2 = TRIM(SUBSTR(guardian_name_2, 1, INSTR(guardian_name_2, ' ') - 1)),
            guardian_surname_2    = TRIM(SUBSTR(guardian_name_2, INSTR(guardian_name_2, ' ') + 1))
        WHERE guardian_first_name_2 IS NULL AND guardian_name_2 IS NOT NULL AND INSTR(guardian_name_2, ' ') > 0
      `);
      await runSql(db, `
        UPDATE students
        SET guardian_first_name_2 = TRIM(guardian_name_2),
            guardian_surname_2    = ''
        WHERE guardian_first_name_2 IS NULL AND guardian_name_2 IS NOT NULL
      `);

      // Indexes
      await runSql(db, `CREATE INDEX IF NOT EXISTS idx_students_surname ON students(surname COLLATE NOCASE);`);

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2.2', datetime('now'));`
      );
    },
  },
  {
    version: '2.3',
    description: 'Digital Public Good (DPG) & Child Safeguarding — Subsidies, Scholarships & Anti-Exclusion Protection',
    run: async db => {
      // 1. subsidy_providers table
      await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS subsidy_providers (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          name           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
          provider_type  TEXT    NOT NULL CHECK(provider_type IN ('government', 'ngo', 'bursary', 'internal_scholarship', 'private_donor')),
          contact_person TEXT,
          contact_email  TEXT,
          contact_phone  TEXT,
          created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
        );`
      );

      // Seed default providers if table empty
      const defaultProviders = [
        ['Ministry of Education - Free Education Policy Grant', 'government', 'District Education Board Secretary (DEBS)', 'debs@moe.gov.zm'],
        ['Constituency Development Fund (CDF) Secondary Bursary', 'government', 'CDF Bursaries Committee', ''],
        ['UNICEF Education Continuity Grant', 'ngo', 'UNICEF Education Desk', ''],
        ['CAMFED Girls Education Bursary', 'ngo', 'CAMFED Zambia Operations', ''],
        ['School Internal OVC / Vulnerable Child Scholarship', 'internal_scholarship', 'Headteacher Welfare Desk', ''],
      ];

      for (const [name, pType, contact, email] of defaultProviders) {
        await runSql(
          db,
          `INSERT OR IGNORE INTO subsidy_providers (name, provider_type, contact_person, contact_email)
           VALUES ('${name.replace(/'/g, "''")}', '${pType}', '${contact.replace(/'/g, "''")}', '${email}');`
        );
      }

      // 2. student_subsidies table
      await runSql(
        db,
        `CREATE TABLE IF NOT EXISTS student_subsidies (
          id                         INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id                 INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          provider_id                INTEGER NOT NULL REFERENCES subsidy_providers(id) ON DELETE RESTRICT,
          year_id                    INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
          term_id                    INTEGER REFERENCES terms(id) ON DELETE CASCADE,
          coverage_type              TEXT    NOT NULL CHECK(coverage_type IN ('full_100', 'percentage', 'fixed_amount')),
          coverage_value             INTEGER NOT NULL,
          application_reason         TEXT,
          grant_reference_number     TEXT,
          is_active                  INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          prevent_academic_exclusion INTEGER NOT NULL DEFAULT 1 CHECK(prevent_academic_exclusion IN (0, 1)),
          created_by                 INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at                 TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          UNIQUE(student_id, provider_id, year_id, term_id)
        );`
      );

      await runSql(db, `CREATE INDEX IF NOT EXISTS idx_student_subsidies_student ON student_subsidies(student_id);`);
      await runSql(db, `CREATE INDEX IF NOT EXISTS idx_student_subsidies_year    ON student_subsidies(year_id);`);
      await runSql(db, `CREATE INDEX IF NOT EXISTS idx_student_subsidies_active  ON student_subsidies(is_active);`);

      // 3. Add is_vulnerable_child / ovc_category columns to students table
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN is_vulnerable_child INTEGER NOT NULL DEFAULT 0 CHECK(is_vulnerable_child IN (0, 1));`);
      } catch (e) { /* already exists */ }
      try {
        await runSql(db, `ALTER TABLE students ADD COLUMN ovc_category TEXT;`);
      } catch (e) { /* already exists */ }

      await runSql(
        db,
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2.3', datetime('now'));`
      );
    },
  },
];

export async function runMigrations(db: sqlite3.Database): Promise<void> {
  const setting = await getScalar(
    db,
    `SELECT value FROM app_settings WHERE key = 'schema_version'`
  );
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
