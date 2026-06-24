/**
 * verify-task9.mjs — Year-End Rollover verification
 *
 * Tests:
 * 1. Preview rollover (dry run)
 * 2. Execute rollover (full transaction)
 * 3. Verify data integrity after rollover
 * 4. Brought-forward debt query
 * 5. Error cases (duplicate year, missing data)
 */

import Database from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// ── Inline rollover functions (from src/lib/fees/rollover.ts) ──
// Inlined because Node ESM cannot directly import .ts files
// Note: dbRun, dbGet, dbAll helpers are defined below

async function previewRollover(db, options) {
  const { oldYearId, newYearLabel, promoteAutomatically, repeaterStudentIds } = options;

  const oldYear = await dbGet(db, 'SELECT * FROM academic_years WHERE id = ?', [oldYearId]);
  if (!oldYear) throw new Error(`Academic year ${oldYearId} not found`);

  const existing = await dbGet(db, 'SELECT id FROM academic_years WHERE label = ?', [newYearLabel]);
  if (existing) throw new Error(`Academic year "${newYearLabel}" already exists`);

  const maxGrade = await dbGet(db, 'SELECT * FROM grades ORDER BY sort_order DESC LIMIT 1');
  const finalGradeId = options.finalGradeOverride || maxGrade?.id;
  const finalGrade = await dbGet(db, 'SELECT * FROM grades WHERE id = ?', [finalGradeId]);
  const maxSortOrder = finalGrade?.sort_order || maxGrade?.sort_order;

  const enrollments = await dbAll(db, `
    SELECT sye.student_id, s.student_number, s.full_name, s.is_active,
           sye.grade_id, sye.class_section_id, sye.is_active as enrollment_active,
           g.label as grade_label, g.sort_order,
           cs.label as section_label
    FROM student_year_enrollment sye
    JOIN students s ON sye.student_id = s.id
    JOIN grades g ON sye.grade_id = g.id
    LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
    WHERE sye.year_id = ? AND sye.is_active = 1
    ORDER BY s.full_name
  `, [oldYearId]);

  const feeCount = await dbGet(db, `SELECT COUNT(*) as c FROM fee_structure WHERE year_id = ?`, [oldYearId]);
  const sectionCount = await dbGet(db, `
    SELECT COUNT(*) as c FROM class_sections cs
    JOIN grades g ON cs.grade_id = g.id
    WHERE g.sort_order < ?
  `, [maxSortOrder]);
  const termCount = await dbGet(db, `SELECT COUNT(*) as c FROM terms WHERE year_id = ?`, [oldYearId]);

  const actions = [];
  let promotedCount = 0, graduatedCount = 0, repeaterCount = 0, studentsWithDebt = 0;

  for (const enr of enrollments) {
    const balanceRow = await dbGet(db, `
      SELECT
        COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf
                  JOIN fee_structure fs ON sf.fee_structure_id = fs.id
                  WHERE sf.student_id = ? AND fs.year_id = ?), 0) as fees,
        COALESCE((SELECT SUM(p.amount_paid_cents) FROM payments p
                  WHERE p.student_id = ? AND p.year_id = ? AND p.is_voided = 0), 0) as paid
    `, [enr.student_id, oldYearId, enr.student_id, oldYearId]);

    const balance = (balanceRow?.fees || 0) - (balanceRow?.paid || 0);
    if (balance > 0) studentsWithDebt++;

    const isRepeater = repeaterStudentIds.includes(enr.student_id);
    let action, targetGradeId = null, targetGradeLabel = null, targetSection = null;

    if (isRepeater) {
      action = 'repeater';
      targetGradeId = enr.grade_id;
      targetGradeLabel = enr.grade_label;
      targetSection = enr.section_label;
      repeaterCount++;
    } else if (enr.sort_order >= maxSortOrder) {
      action = 'graduate';
      graduatedCount++;
    } else if (promoteAutomatically) {
      action = 'promote';
      const nextGrade = await dbGet(db, 'SELECT * FROM grades WHERE sort_order = ?', [enr.sort_order + 1]);
      targetGradeId = nextGrade?.id || null;
      targetGradeLabel = nextGrade?.label || null;
      if (enr.section_label && nextGrade) {
        const nextSection = await dbGet(db, 'SELECT * FROM class_sections WHERE grade_id = ? AND label = ? LIMIT 1', [nextGrade.id, enr.section_label]);
        targetSection = nextSection?.label || null;
      }
      promotedCount++;
    } else {
      action = 'graduate';
      graduatedCount++;
    }

    actions.push({
      studentId: enr.student_id, studentNumber: enr.student_number, fullName: enr.full_name,
      currentGradeId: enr.grade_id, currentGradeLabel: enr.grade_label,
      currentSection: enr.section_label || '', action, targetGradeId, targetGradeLabel, targetSection,
      hasOutstandingBalance: balance > 0, outstandingBalanceCents: balance,
    });
  }

  return {
    oldYearId, oldYearLabel: oldYear.label, newYearLabel,
    finalGradeId: finalGrade?.id || maxGrade?.id,
    finalGradeLabel: finalGrade?.label || maxGrade?.label,
    actions, feeStructureRowsToCopy: feeCount?.c || 0,
    classSectionsToCopy: sectionCount?.c || 0, termsToCopy: termCount?.c || 0,
    promotedCount, graduatedCount, repeaterCount, inactiveCount: 0, studentsWithDebt,
  };
}

async function executeRollover(db, options) {
  const { oldYearId, newYearLabel, copyFeeStructure, copyClassSections, promoteAutomatically, repeaterStudentIds } = options;

  const oldYear = await dbGet(db, 'SELECT * FROM academic_years WHERE id = ?', [oldYearId]);
  if (!oldYear) return { success: false, newYearId: 0, promotedCount: 0, graduatedCount: 0, repeaterCount: 0, feeStructureRowsCopied: 0, classSectionsCopied: 0, termsCopied: 0, error: 'Old year not found' };

  const existing = await dbGet(db, 'SELECT id FROM academic_years WHERE label = ?', [newYearLabel]);
  if (existing) return { success: false, newYearId: 0, promotedCount: 0, graduatedCount: 0, repeaterCount: 0, feeStructureRowsCopied: 0, classSectionsCopied: 0, termsCopied: 0, error: `Year "${newYearLabel}" already exists` };

  const maxGrade = await dbGet(db, 'SELECT * FROM grades ORDER BY sort_order DESC LIMIT 1');
  const finalGradeId = options.finalGradeOverride || maxGrade?.id;
  const finalGrade = await dbGet(db, 'SELECT * FROM grades WHERE id = ?', [finalGradeId]);
  const maxSortOrder = finalGrade?.sort_order || maxGrade?.sort_order;

  let newYearId = 0, termsCopied = 0, classSectionsCopied = 0, feeStructureRowsCopied = 0;
  let promotedCount = 0, graduatedCount = 0, repeaterCount = 0;

  await dbRun(db, 'BEGIN TRANSACTION');

  try {
    const yearResult = await dbRun(db, 'INSERT INTO academic_years (label, is_current, opened_by, created_at) VALUES (?, 1, ?, datetime("now"))', [newYearLabel, options.userId]);
    newYearId = yearResult.lastID;
    await dbRun(db, 'UPDATE academic_years SET is_current = 0 WHERE id = ?', [oldYearId]);

    const oldTerms = await dbAll(db, 'SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [oldYearId]);
    for (const term of oldTerms) {
      await dbRun(db, 'INSERT INTO terms (year_id, term_number, label, start_date, end_date, created_at) VALUES (?, ?, ?, NULL, NULL, datetime("now"))', [newYearId, term.term_number, term.label]);
      termsCopied++;
    }

    const newTerms = await dbAll(db, 'SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [newYearId]);
    const termMap = new Map();
    for (let i = 0; i < oldTerms.length && i < newTerms.length; i++) termMap.set(oldTerms[i].id, newTerms[i].id);

    if (copyClassSections) {
      const oldSections = await dbAll(db, 'SELECT cs.*, g.sort_order FROM class_sections cs JOIN grades g ON cs.grade_id = g.id WHERE g.sort_order < ?', [maxSortOrder]);
      for (const section of oldSections) {
        const nextGrade = await dbGet(db, 'SELECT id FROM grades WHERE sort_order = ?', [section.sort_order + 1]);
        if (nextGrade) {
          await dbRun(db, 'INSERT INTO class_sections (grade_id, label, created_at) VALUES (?, ?, datetime("now"))', [nextGrade.id, section.label]);
          classSectionsCopied++;
        }
      }
    }

    if (copyFeeStructure) {
      const oldFees = await dbAll(db, 'SELECT fs.*, g.sort_order FROM fee_structure fs JOIN grades g ON fs.grade_id = g.id WHERE fs.year_id = ? AND g.sort_order < ?', [oldYearId, maxSortOrder]);
      for (const fee of oldFees) {
        const nextGrade = await dbGet(db, 'SELECT id FROM grades WHERE sort_order = ?', [fee.sort_order + 1]);
        if (nextGrade) {
          const newTermId = termMap.get(fee.term_id);
          if (newTermId) {
            await dbRun(db, 'INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))', [newYearId, newTermId, nextGrade.id, fee.fee_type, fee.amount_cents, fee.description]);
            feeStructureRowsCopied++;
          }
        }
      }
    }

    const enrollments = await dbAll(db, 'SELECT sye.*, g.sort_order FROM student_year_enrollment sye JOIN grades g ON sye.grade_id = g.id WHERE sye.year_id = ? AND sye.is_active = 1', [oldYearId]);

    for (const enr of enrollments) {
      const isRepeater = repeaterStudentIds.includes(enr.student_id);
      if (isRepeater) {
        await dbRun(db, 'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime("now"))', [enr.student_id, newYearId, enr.grade_id, enr.class_section_id]);
        repeaterCount++;
      } else if (enr.sort_order >= maxSortOrder) {
        await dbRun(db, 'UPDATE students SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [enr.student_id]);
        graduatedCount++;
      } else if (promoteAutomatically) {
        const nextGrade = await dbGet(db, 'SELECT id FROM grades WHERE sort_order = ?', [enr.sort_order + 1]);
        if (nextGrade) {
          let newSectionId = enr.class_section_id;
          if (enr.class_section_id) {
            const oldSection = await dbGet(db, 'SELECT label FROM class_sections WHERE id = ?', [enr.class_section_id]);
            if (oldSection) {
              const newSection = await dbGet(db, 'SELECT id FROM class_sections WHERE grade_id = ? AND label = ? LIMIT 1', [nextGrade.id, oldSection.label]);
              if (newSection) newSectionId = newSection.id;
            }
          }
          await dbRun(db, 'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime("now"))', [enr.student_id, newYearId, nextGrade.id, newSectionId]);
          promotedCount++;
        }
      } else {
        await dbRun(db, 'UPDATE students SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [enr.student_id]);
        graduatedCount++;
      }
    }

    await dbRun(db, 'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [options.userId, 'admin', 'year_rollover', 'academic_years', newYearId, `Rolled over from ${oldYear.label} to ${newYearLabel}: ${promotedCount} promoted, ${graduatedCount} graduated, ${repeaterCount} repeating`]);
    await dbRun(db, 'COMMIT');

    return { success: true, newYearId, promotedCount, graduatedCount, repeaterCount, feeStructureRowsCopied, classSectionsCopied, termsCopied };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    return { success: false, newYearId: 0, promotedCount: 0, graduatedCount: 0, repeaterCount: 0, feeStructureRowsCopied: 0, classSectionsCopied: 0, termsCopied: 0, error: err.message || 'Rollover failed' };
  }
}

async function getBroughtForwardDebts(db, studentId, currentYearId) {
  const rows = await dbAll(db, `
    SELECT ay.label as from_year,
           COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf
                     JOIN fee_structure fs ON sf.fee_structure_id = fs.id
                     WHERE sf.student_id = ? AND fs.year_id = ay.id), 0) -
           COALESCE((SELECT SUM(p.amount_paid_cents) FROM payments p
                     WHERE p.student_id = ? AND p.year_id = ay.id AND p.is_voided = 0), 0) as balance
    FROM academic_years ay
    WHERE ay.id != ?
    GROUP BY ay.id
    HAVING balance > 0
    ORDER BY ay.label
  `, [studentId, studentId, currentYearId]);
  return rows.map(r => ({ fromYear: r.from_year, amountCents: r.balance }));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function getDbPath() {
  return path.join(os.tmpdir(), `schoolfoundry-rollover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
}
const testDbPath = getDbPath();
const schemaSql = fs.readFileSync(path.join(repoRoot, 'src', 'db', 'schema.sql'), 'utf-8');

const db = new Database.Database(testDbPath);
db.exec(schemaSql);

// Add student_fees table (migration 1.6)
db.exec(`CREATE TABLE IF NOT EXISTS student_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id INTEGER NOT NULL REFERENCES fee_structure(id) ON DELETE CASCADE,
  debit_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(student_id, fee_structure_id)
)`);

// ── Helpers ──
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${testName} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ── Seed test data ──
async function seedTestData() {
  db.exec('PRAGMA foreign_keys = OFF');

  // Create users
  await dbRun(db, `INSERT INTO users (id, full_name, username, password_hash, role) VALUES (1, 'Admin', 'admin', 'hash', 'admin')`);

  // Create grades (1-7)
  for (let i = 1; i <= 7; i++) {
    await dbRun(db, `INSERT INTO grades (id, label, sort_order) VALUES (?, ?, ?)`, [i, `Grade ${i}`, i]);
  }

  // Create academic years
  await dbRun(db, `INSERT INTO academic_years (id, label, is_current) VALUES (1, '2025', 0)`);
  await dbRun(db, `INSERT INTO academic_years (id, label, is_current) VALUES (2, '2026', 1)`);

  // Create terms for 2026
  await dbRun(db, `INSERT INTO terms (id, year_id, term_number, label, start_date, end_date) VALUES (1, 2, 1, 'Term 1', '2026-01-12', '2026-04-03')`);
  await dbRun(db, `INSERT INTO terms (id, year_id, term_number, label, start_date, end_date) VALUES (2, 2, 2, 'Term 2', '2026-05-04', '2026-07-24')`);
  await dbRun(db, `INSERT INTO terms (id, year_id, term_number, label, start_date, end_date) VALUES (3, 2, 3, 'Term 3', '2026-08-31', '2026-11-27')`);

  // Create class sections
  for (let gradeId = 1; gradeId <= 7; gradeId++) {
    for (const section of ['A', 'B']) {
      await dbRun(db, `INSERT INTO class_sections (grade_id, label) VALUES (?, ?)`, [gradeId, `${gradeId}${section}`]);
    }
  }

  // Create 20 students: 2 per grade (Grade 7 has 2 for graduation test)
  let studentId = 0;
  for (let gradeId = 1; gradeId <= 7; gradeId++) {
    for (let i = 0; i < 2; i++) {
      studentId++;
      const sectionId = (gradeId - 1) * 2 + i + 1; // crude mapping
      await dbRun(db,
        `INSERT INTO students (id, student_number, full_name, guardian_name, guardian_contact, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [studentId, `STU2026${String(studentId).padStart(4, '0')}`, `Student ${studentId}`, `Guardian ${studentId}`, `26377000${String(studentId).padStart(4, '0')}`]
      );
      await dbRun(db,
        `INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [studentId, 2, gradeId, sectionId]
      );
    }
  }

  // Create fee structure for 2026
  for (const termId of [1, 2, 3]) {
    for (let gradeId = 1; gradeId <= 7; gradeId++) {
      const amount = 30000 + (gradeId * 5000);
      await dbRun(db,
        `INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, description)
         VALUES (2, ?, ?, 'tuition', ?, ?)`,
        [termId, gradeId, amount, `Tuition Grade ${gradeId}`]
      );
    }
  }

  // Debit some fees
  for (let sid = 1; sid <= 20; sid++) {
    await dbRun(db,
      `INSERT INTO student_fees (student_id, fee_structure_id, debit_date, amount_cents)
       VALUES (?, 1, '2026-01-12', 35000)`,
      [sid]
    );
  }

  // Record some payments (not all students paid)
  for (let sid = 1; sid <= 10; sid++) {
    await dbRun(db,
      `INSERT INTO payments (student_id, year_id, amount_paid_cents, payment_date, receipt_number, payment_method, recorded_by)
       VALUES (?, 2, 20000, '2026-02-01', ?, 'cash', 1)`,
      [sid, `RCP-${sid}`]
    );
  }
}

// ── Test runner ──
async function runTests() {
  console.log('Task 9 — Year-End Rollover Verification');
  console.log('=========================================\n');

  await seedTestData();

  // ── Test 1: Preview rollover ──
  console.log('Test 1: Preview rollover (dry run)');
  const preview = await previewRollover(db, {
    userId: 1,
    oldYearId: 2,
    newYearLabel: '2027',
    copyFeeStructure: true,
    copyClassSections: true,
    promoteAutomatically: true,
    repeaterStudentIds: [],
  });

  assertEqual(preview.oldYearId, 2, 'Old year is 2 (2026)');
  assertEqual(preview.newYearLabel, '2027', 'New year label is 2027');
  assertEqual(preview.graduatedCount, 2, '2 Grade 7 students will graduate');
  assertEqual(preview.promotedCount, 12, '12 students will be promoted (14 total - 2 final grade)');
  assert(preview.feeStructureRowsToCopy > 0, 'Fee structure rows to copy > 0');
  assert(preview.termsToCopy === 3, '3 terms to copy');
  assertEqual(preview.repeaterCount, 0, 'No repeaters');

  // ── Test 2: Execute rollover ──
  console.log('\nTest 2: Execute rollover');
  const result = await executeRollover(db, {
    userId: 1,
    oldYearId: 2,
    newYearLabel: '2027',
    copyFeeStructure: true,
    copyClassSections: true,
    promoteAutomatically: true,
    repeaterStudentIds: [],
  });

  assert(result.success, 'Rollover executed successfully');
  assert(result.newYearId > 0, 'New year ID created');
  assertEqual(result.graduatedCount, 2, '2 students graduated');
  assertEqual(result.promotedCount, 12, '12 students promoted');

  // ── Test 3: Verify new year is current ──
  console.log('\nTest 3: Verify year states');
  const newYear = await dbGet(db, 'SELECT * FROM academic_years WHERE label = ?', ['2027']);
  const oldYear = await dbGet(db, 'SELECT * FROM academic_years WHERE label = ?', ['2026']);
  assertEqual(newYear.is_current, 1, '2027 is current');
  assertEqual(oldYear.is_current, 0, '2026 is not current');

  // ── Test 4: Verify student promotions ──
  console.log('\nTest 4: Verify student promotions');
  const grade1Students = await dbAll(db, `
    SELECT s.id, s.full_name, sye.grade_id, g.label
    FROM students s
    JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
    JOIN grades g ON sye.grade_id = g.id
    WHERE g.label = 'Grade 2'
  `, [newYear.id]);

  assert(grade1Students.length > 0, 'Students enrolled in Grade 2 (2027)');
  // Should be the 2 students from Grade 1 (2026) promoted
  assertEqual(grade1Students.length, 2, '2 students promoted to Grade 2');

  // ── Test 5: Verify graduates are inactive ──
  console.log('\nTest 5: Verify graduates');
  const inactiveStudents = await dbAll(db, `
    SELECT s.id, s.full_name FROM students s
    WHERE s.is_active = 0
  `);
  assertEqual(inactiveStudents.length, 2, '2 students are inactive (graduated)');

  // ── Test 6: Verify old year data preserved ──
  console.log('\nTest 6: Old year data preserved');
  const oldYearStudents = await dbAll(db, `
    SELECT COUNT(*) as c FROM student_year_enrollment WHERE year_id = ?
  `, [oldYear.id]);
  assertEqual(oldYearStudents[0].c, 14, '14 enrollment records still in 2026');

  const oldPayments = await dbAll(db, `
    SELECT COUNT(*) as c FROM payments WHERE year_id = ?
  `, [oldYear.id]);
  assertEqual(oldPayments[0].c, 10, '10 payments still in 2026');

  // ── Test 7: Brought-forward debt query ──
  console.log('\nTest 7: Brought-forward debt');
  // Students 1-10 have 20000 paid but 35000 owed = 15000 outstanding
  // Students 11-20 have 0 paid but 35000 owed = 35000 outstanding
  const debt = await getBroughtForwardDebts(db, 11, newYear.id);
  assert(debt.length > 0, 'Brought-forward debt found for student with unpaid balance');
  assertEqual(debt[0].amountCents, 35000, 'Debt amount = 35000 (35000 owed - 0 paid)');

  // Student who paid fully should have no brought-forward
  const noDebt = await getBroughtForwardDebts(db, 1, newYear.id);
  const s1Debt = noDebt.find(d => d.fromYear === '2026');
  // Student 1 paid 20000, owes 35000 — still has 15000 debt
  assert(s1Debt !== undefined, 'Student 1 has brought-forward debt (paid 20k, owed 35k)');

  // ── Test 8: Repeater scenario ──
  console.log('\nTest 8: Repeater scenario');
  // Clean up and re-seed for repeater test
  await new Promise(resolve => db.close(() => resolve()));
  try { fs.unlinkSync(testDbPath); } catch {}

  const testDbPath2 = getDbPath();
  const db2 = new Database.Database(testDbPath2);
  db2.exec(schemaSql);
  db2.exec(`CREATE TABLE IF NOT EXISTS student_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id INTEGER NOT NULL REFERENCES fee_structure(id) ON DELETE CASCADE,
    debit_date TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, fee_structure_id)
  )`);
  db2.exec('PRAGMA foreign_keys = OFF');

  // Quick seed: 3 students in Grade 3, 1 in Grade 7
  for (let i = 1; i <= 7; i++) {
    await dbRun(db2, `INSERT INTO grades (id, label, sort_order) VALUES (?, ?, ?)`, [i, `Grade ${i}`, i]);
  }
  await dbRun(db2, `INSERT INTO academic_years (id, label, is_current) VALUES (1, '2025', 0)`);
  await dbRun(db2, `INSERT INTO academic_years (id, label, is_current) VALUES (2, '2026', 1)`);
  await dbRun(db2, `INSERT INTO terms (id, year_id, term_number, label) VALUES (1, 2, 1, 'Term 1')`);
  await dbRun(db2, `INSERT INTO users (id, full_name, username, password_hash, role) VALUES (1, 'Admin', 'admin', 'h', 'admin')`);

  for (let sid = 1; sid <= 3; sid++) {
    await dbRun(db2, `INSERT INTO students (id, student_number, full_name, guardian_name, guardian_contact, is_active)
      VALUES (?, ?, ?, ?, ?, 1)`, [sid, `S${sid}`, `Student ${sid}`, `Guardian ${sid}`, '263770000000']);
    await dbRun(db2, `INSERT INTO student_year_enrollment (student_id, year_id, grade_id, is_active)
      VALUES (?, ?, ?, 1)`, [sid, 2, 3]);
  }
  // Grade 7 student
  await dbRun(db2, `INSERT INTO students (id, student_number, full_name, guardian_name, guardian_contact, is_active)
    VALUES (4, 'S4', 'Student 4', 'Guardian 4', '263770000000', 1)`);
  await dbRun(db2, `INSERT INTO student_year_enrollment (student_id, year_id, grade_id, is_active)
    VALUES (4, 2, 7, 1)`);

  const preview2 = await previewRollover(db2, {
    userId: 1, oldYearId: 2, newYearLabel: '2027',
    copyFeeStructure: false, copyClassSections: false,
    promoteAutomatically: true, repeaterStudentIds: [1],
  });

  assertEqual(preview2.graduatedCount, 1, '1 Grade 7 graduate (S4)');
  assertEqual(preview2.repeaterCount, 1, '1 repeater (S1)');
  assertEqual(preview2.promotedCount, 2, '2 promoted (S2, S3 → Grade 4)');

  const result2 = await executeRollover(db2, {
    userId: 1, oldYearId: 2, newYearLabel: '2027',
    copyFeeStructure: false, copyClassSections: false,
    promoteAutomatically: true, repeaterStudentIds: [1],
  });

  assert(result2.success, 'Repeater rollover succeeded');

  // Verify repeater is still in Grade 3
  const repeater = await dbGet(db2, `
    SELECT sye.grade_id FROM student_year_enrollment sye
    WHERE sye.student_id = 1 AND sye.year_id = ?
  `, [result2.newYearId]);
  assertEqual(repeater.grade_id, 3, 'Repeater (S1) stays in Grade 3');

  // Verify promoted students moved to Grade 4
  const promoted = await dbGet(db2, `
    SELECT sye.grade_id FROM student_year_enrollment sye
    WHERE sye.student_id = 2 AND sye.year_id = ?
  `, [result2.newYearId]);
  assertEqual(promoted.grade_id, 4, 'Promoted student (S2) moved to Grade 4');

  // Verify graduate is inactive
  const grad = await dbGet(db2, 'SELECT is_active FROM students WHERE id = 4');
  assertEqual(grad.is_active, 0, 'Graduate (S4) is inactive');

  await new Promise(resolve => db2.close(() => resolve()));
  try { fs.unlinkSync(testDbPath2); } catch {}

  // ── Test 9: Error case — duplicate year ──
  console.log('\nTest 9: Error cases');
  const testDbPath3 = getDbPath();
  const db3 = new Database.Database(testDbPath3);
  db3.exec(schemaSql);
  db3.exec('PRAGMA foreign_keys = OFF');
  await dbRun(db3, `INSERT INTO grades (id, label, sort_order) VALUES (1, 'Grade 1', 1)`);
  await dbRun(db3, `INSERT INTO academic_years (id, label, is_current) VALUES (1, '2026', 1)`);
  await dbRun(db3, `INSERT INTO academic_years (id, label, is_current) VALUES (2, '2027', 0)`);
  await dbRun(db3, `INSERT INTO users (id, full_name, username, password_hash, role) VALUES (1, 'Admin', 'admin', 'h', 'admin')`);

  const dupResult = await executeRollover(db3, {
    userId: 1, oldYearId: 1, newYearLabel: '2027',
    copyFeeStructure: true, copyClassSections: true,
    promoteAutomatically: true, repeaterStudentIds: [],
  });
  assert(!dupResult.success, 'Duplicate year label rejected');
  assert(dupResult.error?.includes('already exists'), 'Error mentions "already exists"');

  await new Promise(resolve => db3.close(() => resolve()));
  try { fs.unlinkSync(testDbPath3); } catch {}

  // ── Summary ──
  console.log('\n================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
