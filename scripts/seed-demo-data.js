#!/usr/bin/env node
/**
 * seed-demo-data.js — Populate the SchoolFoundry database with realistic demo data.
 *
 * Targets the same DB the app uses: app.getPath('userData')/data.db
 * On Windows: C:\Users\<user>\AppData\Roaming\schoolfoundry\data.db
 *
 * Run: node scripts/seed-demo-data.js
 *
 * Safe to re-runclears existing data first, then re-seeds from scratch.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');

// ── Resolve DB path (same as app) ──
const APP_NAME = 'schoolfoundry';
let dbDir;
if (process.platform === 'win32') {
  dbDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME);
} else if (process.platform === 'darwin') {
  dbDir = path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
} else {
  dbDir = path.join(os.homedir(), '.config', APP_NAME);
}
const dbPath = path.join(dbDir, 'data.db');

console.log('=== SchoolFoundry Demo Database Seeder ===');
console.log('Target:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('ERROR: Database not found. Run the app once first to initialize the schema.');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

// ── Helpers ──
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ── Data pools ──
const FIRST_NAMES = [
  'Munashe', 'Tadiwa', 'Nyasha', 'Farai', 'Tendai', 'Ruvimbo', 'Tafadzwa',
  'Rutendo', 'Kupakwashe', 'Anesu', 'Kudzai', 'Sekai', 'Tapiwa', 'Chipo',
  'Danai', 'Fadzai', 'Gugulethu', 'Hazvinei', 'Isheanesu', 'Jabulani',
  'Kumbirai', 'Lindiwe', 'Maita', 'Nhamo', 'Olipa', 'Patience', 'Rumbidzai',
  'Sibongile', 'Tariro', 'Upenyu', 'Vimbai', 'Wadzanai', 'Yemurai',
  'Zanele', 'Blessing', 'Chenai', 'Daphne', 'Ethel', 'Felicity', 'Grace',
  'Hope', 'Ivy', 'Joy', 'Kudzai', 'Lorraine', 'Memory', 'Nobuhle',
  'Otilia', 'Praise', 'Quincy', 'Rudo', 'Shingai', 'Tawana',
];

const LAST_NAMES = [
  'Mupenge', 'Moyo', 'Nyathi', 'Chikwanha', 'Muzanenhamo', 'Tsvangirai',
  'Mugabe', 'Ncube', 'Dube', 'Sibanda', 'Mlambo', 'Nkomo', 'Mujuru',
  'Chigumba', 'Mushore', 'Gumbo', 'Mhandu', 'Banda', 'Phiri',
  'Tembo', 'Chirwa', 'Katsande', 'Mafuta', 'Chipanga', 'Mudzuri',
  'Mangoma', 'Charema', 'Mukasa', 'Tirivavi', 'Mazhambe', 'Chipato',
  'Mukasa', 'Mabika', 'Chingono', 'Matsilele', 'Mudenge', 'Mukumba',
];

const GUARDIAN_FIRST = [
  'Grace', 'Mary', 'Thandiwe', 'Patience', 'Rumbidzai', 'Sibongile',
  'Tendai', 'Kudzai', 'Blessing', 'Memory', 'Nobuhle', 'Olipa',
  'John', 'Peter', 'David', 'Tatenda', 'Farai', 'Munashe',
  'Jabulani', 'Kupakwashe', 'Tafadzwa', 'Isheanesu', 'Chenai',
];

const GUARDIAN_LAST = [
  'Mupenge', 'Moyo', 'Nyathi', 'Chikwanha', 'Muzanenhamo', 'Banda',
  'Phiri', 'Sibanda', 'Dube', 'Ncube', 'Tembo', 'Mlambo',
  'Chirwa', 'Katsande', 'Mafuta', 'Chipanga', 'Mudzuri', 'Mangoma',
  'Charema', 'Mukasa', 'Tirivavi', 'Mazhambe', 'Chipato', 'Mudenge',
];

const GRADES = [
  { label: 'Grade 1', sort_order: 1 },
  { label: 'Grade 2', sort_order: 2 },
  { label: 'Grade 3', sort_order: 3 },
  { label: 'Grade 4', sort_order: 4 },
  { label: 'Grade 5', sort_order: 5 },
  { label: 'Grade 6', sort_order: 6 },
  { label: 'Grade 7', sort_order: 7 },
];

const CLASS_SECTIONS = ['A', 'B', 'C'];

const PAYMENT_METHODS = ['cash', 'ecocash', 'bank_transfer', 'other'];

const FEE_TYPES = ['tuition', 'registration', 'levy', 'exam', 'other'];

const FEE_DESCRIPTIONS = {
  tuition: 'Tuition Fee',
  registration: 'Registration Fee',
  levy: 'School Levy',
  exam: 'Examination Fee',
  other: 'Sports & Activities',
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStudentNumber(index) {
  const year = 2026;
  return `STU${year}${String(index).padStart(4, '0')}`;
}

function generateReceiptNumber(index) {
  const year = 2026;
  return `RCP-${year}-${String(index).padStart(4, '0')}`;
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

// ── Main seed function ──
async function seed() {
  console.log('\nClearing existing data...');

  // Disable FK during cleanup
  await run('PRAGMA foreign_keys = OFF');

  const tables = [
    'activity_log', 'payment_receipts', 'payments', 'student_fees',
    'custom_list_members', 'custom_lists', 'fee_structure',
    'student_year_enrollment', 'class_sections', 'students',
    'grades', 'terms', 'academic_years', 'users', 'app_settings',
  ];
  for (const t of tables) {
    await run(`DELETE FROM ${t}`);
  }

  console.log('Seeding...\n');

  // ── 1. App settings ──
  await run(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2.1', datetime('now'))`);
  await run(`INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('currency', 'USD', datetime('now'))`);
  await run(`INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('enable_subgrades', 'true', datetime('now'))`);
  await run(`INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('school_name', 'Mupenge Primary School', datetime('now'))`);
  await run(`INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('school_contact', '263-24-2750000', datetime('now'))`);

  // ── 2. Users ──
  const adminHash = bcrypt.hashSync('admin123', 10);
  const userHash = bcrypt.hashSync('teacher123', 10);

  await run(
    `INSERT INTO users (full_name, username, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    ['Seward Mupereri', 'admin', adminHash, 'admin']
  );
  await run(
    `INSERT INTO users (full_name, username, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    ['Rumbidzai Moyo', 'rumbidzai', userHash, 'user']
  );
  await run(
    `INSERT INTO users (full_name, username, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
    ['Tendai Nyathi', 'tendai', userHash, 'user']
  );
  console.log('  ✓ 3 users (admin: admin/admin123, teachers: rumbidzai/teacher123, tendai/teacher123)');

  // ── 3. Academic years ──
  await run(`INSERT INTO academic_years (label, is_current, created_at) VALUES ('2025', 0, datetime('now'))`);
  await run(`INSERT INTO academic_years (label, is_current, created_at) VALUES ('2026', 1, datetime('now'))`);
  const year2025 = await get('SELECT id FROM academic_years WHERE label = ?', ['2025']);
  const year2026 = await get('SELECT id FROM academic_years WHERE label = ?', ['2026']);
  console.log('  ✓ 2 academic years (2025, 2026 current)');

  // ── 4. Terms ──
  const termData = [
    { year_id: year2025.id, number: 1, label: 'Term 1', start: '2025-01-13', end: '2025-04-04' },
    { year_id: year2025.id, number: 2, label: 'Term 2', start: '2025-05-05', end: '2025-07-25' },
    { year_id: year2025.id, number: 3, label: 'Term 3', start: '2025-09-01', end: '2025-11-28' },
    { year_id: year2026.id, number: 1, label: 'Term 1', start: '2026-01-12', end: '2026-04-03' },
    { year_id: year2026.id, number: 2, label: 'Term 2', start: '2026-05-04', end: '2026-07-24' },
    { year_id: year2026.id, number: 3, label: 'Term 3', start: '2026-08-31', end: '2026-11-27' },
  ];
  for (const t of termData) {
    await run(
      `INSERT INTO terms (year_id, term_number, label, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [t.year_id, t.number, t.label, t.start, t.end]
    );
  }
  console.log('  ✓ 6 terms (3 per year)');

  // ── 5. Grades ──
  for (const g of GRADES) {
    await run(
      `INSERT INTO grades (label, sort_order, is_active, created_at)
       VALUES (?, ?, 1, datetime('now'))`,
      [g.label, g.sort_order]
    );
  }
  const grades = await all('SELECT id, label FROM grades ORDER BY sort_order');
  console.log('  ✓ 7 grades (Grade 1–7)');

  // ── 6. Class sections ──
  for (const g of grades) {
    for (const section of CLASS_SECTIONS) {
      await run(
        `INSERT INTO class_sections (grade_id, label, created_at)
         VALUES (?, ?, datetime('now'))`,
        [g.id, `${g.label.split(' ')[1]}${section}`]
      );
    }
  }
  console.log('  ✓ 21 class sections (A/B/C per grade)');

  // ── 7. Students (42 students — 2 per section) ──
  let studentCount = 0;
  const students = [];
  for (const g of grades) {
    for (const section of CLASS_SECTIONS) {
      for (let i = 0; i < 2; i++) {
        studentCount++;
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const guardianFirst = pick(GUARDIAN_FIRST);
        const guardianLast = pick(GUARDIAN_LAST);
        const sectionRow = await get(
          'SELECT id FROM class_sections WHERE grade_id = ? AND label = ?',
          [g.id, `${g.label.split(' ')[1]}${section}`]
        );

        const result = await run(
          `INSERT INTO students (student_number, full_name, date_of_birth, gender, guardian_name, guardian_contact, guardian_name_2, guardian_contact_2, guardian_email, date_enrolled, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
          [
            generateStudentNumber(studentCount),
            `${firstName} ${lastName}`,
            randomDate(new Date('2008-01-01'), new Date('2014-12-31')),
            Math.random() > 0.5 ? 'male' : 'female',
            `${guardianFirst} ${guardianLast}`,
            `26377${pickInt(1000000, 9999999)}`,
            Math.random() > 0.5 ? `${pick(GUARDIAN_FIRST)} ${pick(GUARDIAN_LAST)}` : null,
            Math.random() > 0.5 ? `26377${pickInt(1000000, 9999999)}` : null,
            Math.random() > 0.5 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com` : null,
            randomDate(new Date('2022-01-01'), new Date('2025-12-31')),
          ]
        );

        // Enroll in current year
        await run(
          `INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at)
           VALUES (?, ?, ?, ?, 1, datetime('now'))`,
          [result.lastID, year2026.id, g.id, sectionRow.id]
        );

        // Also enroll in 2025 for history
        await run(
          `INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at)
           VALUES (?, ?, ?, ?, 1, datetime('now'))`,
          [result.lastID, year2025.id, Math.max(1, g.id - 1), sectionRow.id]
        );

        students.push({ id: result.lastID, grade_id: g.id, year_id: year2026.id });
      }
    }
  }
  console.log(`  ✓ ${studentCount} students enrolled in 2025 + 2026`);

  // ── 8. Fee structure (per grade per term per year) ──
  const feeAmounts = {
    tuition: { 'Grade 1': 150000, 'Grade 2': 150000, 'Grade 3': 160000, 'Grade 4': 160000, 'Grade 5': 170000, 'Grade 6': 180000, 'Grade 7': 200000 },
    registration: 25000,
    levy: 30000,
    exam: 15000,
    other: 20000,
  };

  for (const yearRow of [year2025, year2026]) {
    const termsForYear = await all('SELECT id, term_number FROM terms WHERE year_id = ? ORDER BY term_number', [yearRow.id]);
    for (const g of grades) {
      for (const term of termsForYear) {
        for (const feeType of FEE_TYPES) {
          const amount = feeAmounts[feeType][g.label] || feeAmounts[feeType];
          await run(
            `INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, description, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [yearRow.id, term.id, g.id, feeType, amount, FEE_DESCRIPTIONS[feeType]]
          );
        }
      }
    }
  }
  console.log('  ✓ Fee structure: 5 fee types × 7 grades × 6 terms');

  // ── 9. Student fees (auto-debited for past/current terms) ──
  const today = new Date().toISOString().split('T')[0];
  let feeCount = 0;

  for (const student of students) {
    const feeStructures = await all(
      `SELECT fs.id, fs.amount_cents, t.start_date
       FROM fee_structure fs
       JOIN terms t ON fs.term_id = t.id
       WHERE fs.year_id = ? AND fs.grade_id = ? AND t.start_date <= ?`,
      [student.year_id, student.grade_id, today]
    );

    for (const fs of feeStructures) {
      await run(
        `INSERT INTO student_fees (student_id, fee_structure_id, debit_date, amount_cents)
         VALUES (?, ?, ?, ?)`,
        [student.id, fs.id, fs.start_date, fs.amount_cents]
      );
      feeCount++;
    }
  }
  console.log(`  ✓ ${feeCount} student fee debits`);

  // ── 10. Payments (mix of fully paid, partially paid, and owing) ──
  let paymentIndex = 0;
  let paymentCount = 0;

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const studentFees = await all(
      `SELECT sf.id, sf.amount_cents, sf.debit_date
       FROM student_fees sf
       JOIN fee_structure fs ON sf.fee_structure_id = fs.id
       WHERE sf.student_id = ? AND fs.year_id = ?`,
      [student.id, student.year_id]
    );

    const totalFees = studentFees.reduce((s, f) => s + f.amount_cents, 0);

    // Vary payment scenarios:
    // 0: fully paid, 1: partially paid, 2: no payment yet
    const scenario = i % 5; // 0,1,2,3,4 → patterns

    let paymentAmount = 0;
    if (scenario === 0 || scenario === 3) paymentAmount = totalFees;       // fully paid
    else if (scenario === 1) paymentAmount = Math.round(totalFees * 0.5);  // half paid
    else if (scenario === 4) paymentAmount = Math.round(totalFees * 0.25); // quarter paid
    // scenario === 2: no payment

    if (paymentAmount > 0) {
      // Split into 1-2 payments
      const numPayments = paymentAmount > 30000 ? 2 : 1;
      let remaining = paymentAmount;

      for (let p = 0; p < numPayments; p++) {
        paymentIndex++;
        const thisPayment = p === numPayments - 1 ? remaining : Math.round(remaining / (numPayments - p));
        remaining -= thisPayment;

        await run(
          `INSERT INTO payments (student_id, year_id, term_id, amount_paid_cents, payment_date, receipt_number, payment_method, is_voided, recorded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, datetime('now'))`,
          [
            student.id,
            student.year_id,
            null,
            thisPayment,
            randomDate(new Date('2026-01-15'), new Date('2026-06-15')),
            generateReceiptNumber(paymentIndex),
            pick(PAYMENT_METHODS),
          ]
        );
        paymentCount++;
      }
    }
  }
  console.log(`  ✓ ${paymentCount} payments across ${paymentIndex} receipts`);

  // ── 11. Custom lists ──
  await run(
    `INSERT INTO custom_lists (name, description, created_at)
     VALUES ('Scholarship Students', 'Students on full scholarship', datetime('now'))`
  );
  await run(
    `INSERT INTO custom_lists (name, description, created_at)
     VALUES ('Outstanding Balance', 'Students with unpaid fees', datetime('now'))`
  );
  await run(
    `INSERT INTO custom_lists (name, description, created_at)
     VALUES ('Grade 7 Final Year', 'Candidates for 2026 final exams', datetime('now'))`
  );

  // Add members to lists
  const lists = await all('SELECT id, name FROM custom_lists');
  for (let s = 0; s < 5; s++) {
    await run(`INSERT INTO custom_list_members (list_id, student_id) VALUES (?, ?)`, [lists[0].id, students[s].id]);
  }
  for (let s = 0; s < 8; s++) {
    await run(`INSERT INTO custom_list_members (list_id, student_id) VALUES (?, ?)`, [lists[1].id, students[s * 3 + 2]?.id || students[s].id]);
  }
  const grade7Students = students.filter(s => s.grade_id === grades[6].id);
  for (const s of grade7Students) {
    await run(`INSERT INTO custom_list_members (list_id, student_id) VALUES (?, ?)`, [lists[2].id, s.id]);
  }
  console.log('  ✓ 3 custom lists with members');

  // ── 12. Activity log ──
  const activityEntries = [
    { action: 'app_started', entity: 'system', details: 'Application launched' },
    { action: 'student_added', entity: 'students', details: 'Bulk enrolled 42 students' },
    { action: 'fee_structure_updated', entity: 'fee_structure', details: 'Updated 2026 Term 1 tuition fees' },
    { action: 'payment_recorded', entity: 'payments', details: 'Recorded batch payments' },
    { action: 'auto_debit_run', entity: 'student_fees', details: 'Auto-debited Term 1 fees for active students' },
    { action: 'custom_list_created', entity: 'custom_lists', details: 'Created Scholarship Students list' },
    { action: 'settings_updated', entity: 'app_settings', details: 'Updated school name to Mupenge Primary School' },
    { action: 'statement_viewed', entity: 'students', details: 'Viewed statement for STU2026001' },
    { action: 'import_completed', entity: 'students', details: 'Imported 42 students from Excel' },
    { action: 'login', entity: 'users', details: 'Admin logged in' },
  ];

  for (const a of activityEntries) {
    await run(
      `INSERT INTO activity_log (user_id, username, action, entity, details, logged_at)
       VALUES (1, 'admin', ?, ?, ?, datetime('now'))`,
      [a.action, a.entity, a.details]
    );
  }
  console.log('  ✓ 10 activity log entries');

  // ── 13. Payment receipts (snapshot for a few payments) ──
  const samplePayments = await all('SELECT id, student_id, amount_paid_cents FROM payments LIMIT 5');
  for (const p of samplePayments) {
    const studentFeesTotal = await get(
      `SELECT COALESCE(SUM(sf.amount_cents), 0) as total
       FROM student_fees sf
       JOIN fee_structure fs ON sf.fee_structure_id = fs.id
       WHERE sf.student_id = ?`,
      [p.student_id]
    );
    const paidSoFar = await get(
      `SELECT COALESCE(SUM(amount_paid_cents), 0) as total
       FROM payments WHERE student_id = ? AND is_voided = 0 AND id <= ?`,
      [p.student_id, p.id]
    );

    const feeTotal = studentFeesTotal?.total || 0;
    const paidTotal = paidSoFar?.total || 0;

    await run(
      `INSERT INTO payment_receipts (payment_id, fee_owed_cents, amount_paid_cents, outstanding_cents, generated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [p.id, feeTotal, p.amount_paid_cents, Math.max(0, feeTotal - paidTotal)]
    );
  }
  console.log('  ✓ 5 payment receipt snapshots');

  // ── Summary ──
  console.log('\n=== Seed Complete ===');
  console.log('\nDatabase summary:');

  const counts = {};
  for (const t of ['users', 'academic_years', 'terms', 'grades', 'class_sections', 'students', 'student_year_enrollment', 'fee_structure', 'student_fees', 'payments', 'custom_lists', 'custom_list_members', 'activity_log', 'payment_receipts']) {
    const row = await get(`SELECT COUNT(*) as c FROM ${t}`);
    counts[t] = row?.c || 0;
    console.log(`  ${t.padEnd(30)} ${counts[t]}`);
  }

  console.log('\nLogin credentials:');
  console.log('  Admin:  username=admin,     password=admin123');
  console.log('  Teacher: username=rumbidzai, password=teacher123');
  console.log('  Teacher: username=tendai,   password=teacher123');
  console.log('\nDone! Run the app to explore with demo data.');
}

seed().catch(err => {
  console.error('SEED ERROR:', err.message);
  process.exit(1);
}).finally(() => {
  db.close();
});
