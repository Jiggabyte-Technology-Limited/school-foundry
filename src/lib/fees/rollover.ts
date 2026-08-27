/**
 * fees/rollover.ts — Year-End Rollover Engine
 *
 * Executes the full academic year rollover inside a single SQLite transaction.
 * Idempotent: if anything fails, the entire transaction rolls back and the
 * old year is untouched.
 *
 * Public API:
 *   previewRollover(options) → RolloverPreview (dry run — what would happen)
 *   executeRollover(options) → RolloverResult (commits the transaction)
 */

import type { DbRunResult } from '../../declarations';

// ── Types ──

export interface RolloverOptions {
  userId: number;
  oldYearId: number;
  newYearLabel: string;
  copyFeeStructure: boolean;
  copyClassSections: boolean;
  promoteAutomatically: boolean;
  repeaterStudentIds: number[];  // students to keep in same grade
  finalGradeOverride?: number;   // override auto-detected final grade (grade_id)
}

export interface StudentAction {
  studentId: number;
  studentNumber: string;
  fullName: string;
  currentGradeId: number;
  currentGradeLabel: string;
  currentSection: string;
  action: 'promote' | 'graduate' | 'repeater';
  targetGradeId: number | null;
  targetGradeLabel: string | null;
  targetSection: string | null;
  hasOutstandingBalance: boolean;
  outstandingBalanceCents: number;
}

export interface RolloverPreview {
  oldYearId: number;
  oldYearLabel: string;
  newYearLabel: string;
  finalGradeId: number;
  finalGradeLabel: string;
  actions: StudentAction[];
  feeStructureRowsToCopy: number;
  classSectionsToCopy: number;
  termsToCopy: number;
  promotedCount: number;
  graduatedCount: number;
  repeaterCount: number;
  inactiveCount: number;
  studentsWithDebt: number;
}

export interface RolloverResult {
  success: boolean;
  newYearId: number;
  promotedCount: number;
  graduatedCount: number;
  repeaterCount: number;
  feeStructureRowsCopied: number;
  classSectionsCopied: number;
  termsCopied: number;
  error?: string;
}

// ── SQL helpers (callback-based, matching app's sqlite3 pattern) ──

function dbRun(db: any, sql: string, params: any[] = []): Promise<DbRunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(this: any, err: Error | null) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(db: any, sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: any) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(db: any, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ── Preview (dry run — no writes) ──

export async function previewRollover(
  db: any,
  options: RolloverOptions,
): Promise<RolloverPreview> {
  const { oldYearId, newYearLabel, promoteAutomatically, repeaterStudentIds } = options;

  // 1. Get old year info
  const oldYear = await dbGet(db, 'SELECT * FROM academic_years WHERE id = ?', [oldYearId]);
  if (!oldYear) throw new Error(`Academic year ${oldYearId} not found`);

  // 2. Check new year label doesn't already exist
  const existing = await dbGet(db, 'SELECT id FROM academic_years WHERE label = ?', [newYearLabel]);
  if (existing) throw new Error(`Academic year "${newYearLabel}" already exists`);

  // 3. Determine final grade (highest sort_order)
  const maxGrade = await dbGet(db, 'SELECT * FROM grades ORDER BY sort_order DESC LIMIT 1');
  const finalGradeId = options.finalGradeOverride || maxGrade?.id;
  const finalGrade = await dbGet(db, 'SELECT * FROM grades WHERE id = ?', [finalGradeId]);
  const maxSortOrder = finalGrade?.sort_order || maxGrade?.sort_order;

  // 4. Get all active enrollments in current year with student info
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

  // 5. Get fee structure count (for preview)
  const feeCount = await dbGet(db, `
    SELECT COUNT(*) as c FROM fee_structure WHERE year_id = ?
  `, [oldYearId]);

  // 6. Get class sections count (for preview — only for grades below final)
  const sectionCount = await dbGet(db, `
    SELECT COUNT(*) as c FROM class_sections cs
    JOIN grades g ON cs.grade_id = g.id
    WHERE g.sort_order < ?
  `, [maxSortOrder]);

  // 7. Get terms count
  const termCount = await dbGet(db, `SELECT COUNT(*) as c FROM terms WHERE year_id = ?`, [oldYearId]);

  // 8. Build student actions
  const actions: StudentAction[] = [];
  let promotedCount = 0;
  let graduatedCount = 0;
  let repeaterCount = 0;
  let inactiveCount = 0;
  let studentsWithDebt = 0;

  for (const enr of enrollments) {
    // Check outstanding balance in old year
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

    let action: StudentAction['action'];
    let targetGradeId: number | null = null;
    let targetGradeLabel: string | null = null;
    let targetSection: string | null = null;

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
      // Find next grade
      const nextGrade = await dbGet(db, 'SELECT * FROM grades WHERE sort_order = ?', [enr.sort_order + 1]);
      targetGradeId = nextGrade?.id || null;
      targetGradeLabel = nextGrade?.label || null;
      // Find matching section in next grade
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
      studentId: enr.student_id,
      studentNumber: enr.student_number,
      fullName: enr.full_name,
      currentGradeId: enr.grade_id,
      currentGradeLabel: enr.grade_label,
      currentSection: enr.section_label || '',
      action,
      targetGradeId,
      targetGradeLabel,
      targetSection,
      hasOutstandingBalance: balance > 0,
      outstandingBalanceCents: balance,
    });
  }

  // Count inactive (not enrolled this year)
  inactiveCount = (await dbGet(db, `
    SELECT COUNT(*) as c FROM students s
    WHERE s.is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM student_year_enrollment sye 
        WHERE sye.student_id = s.id AND sye.year_id = ? AND sye.is_active = 1
      )
  `, [oldYearId]))?.c || 0;

  return {
    oldYearId,
    oldYearLabel: oldYear.label,
    newYearLabel,
    finalGradeId: finalGrade?.id || maxGrade?.id,
    finalGradeLabel: finalGrade?.label || maxGrade?.label,
    actions,
    feeStructureRowsToCopy: feeCount?.c || 0,
    classSectionsToCopy: sectionCount?.c || 0,
    termsToCopy: termCount?.c || 0,
    promotedCount,
    graduatedCount,
    repeaterCount,
    inactiveCount,
    studentsWithDebt,
  };
}

// ── Execute (commits the transaction) ──

export async function executeRollover(
  db: any,
  options: RolloverOptions,
): Promise<RolloverResult> {
  const { oldYearId, newYearLabel, copyFeeStructure, copyClassSections, promoteAutomatically, repeaterStudentIds } = options;

  // Pre-flight checks
  const oldYear = await dbGet(db, 'SELECT * FROM academic_years WHERE id = ?', [oldYearId]);
  if (!oldYear) return { success: false, newYearId: 0, promotedCount: 0, graduatedCount: 0, repeaterCount: 0, feeStructureRowsCopied: 0, classSectionsCopied: 0, termsCopied: 0, error: 'Old year not found' };

  const existing = await dbGet(db, 'SELECT id FROM academic_years WHERE label = ?', [newYearLabel]);
  if (existing) return { success: false, newYearId: 0, promotedCount: 0, graduatedCount: 0, repeaterCount: 0, feeStructureRowsCopied: 0, classSectionsCopied: 0, termsCopied: 0, error: `Year "${newYearLabel}" already exists` };

  const maxGrade = await dbGet(db, 'SELECT * FROM grades ORDER BY sort_order DESC LIMIT 1');
  const finalGradeId = options.finalGradeOverride || maxGrade?.id;
  const finalGrade = await dbGet(db, 'SELECT * FROM grades WHERE id = ?', [finalGradeId]);
  const maxSortOrder = finalGrade?.sort_order || maxGrade?.sort_order;

  let newYearId = 0;
  let termsCopied = 0;
  let classSectionsCopied = 0;
  let feeStructureRowsCopied = 0;
  let promotedCount = 0;
  let graduatedCount = 0;
  let repeaterCount = 0;

  // Execute inside transaction
  await dbRun(db, 'BEGIN TRANSACTION');

  try {
    // 1. Create new year
    const yearResult = await dbRun(
      db,
      'INSERT INTO academic_years (label, is_current, opened_by, created_at) VALUES (?, 1, ?, datetime("now"))',
      [newYearLabel, options.userId]
    );
    newYearId = yearResult.lastID;

    // 2. Deactivate old year
    await dbRun(db, 'UPDATE academic_years SET is_current = 0 WHERE id = ?', [oldYearId]);

    // 3. Copy terms (dates = NULL)
    const oldTerms = await dbAll(db, 'SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [oldYearId]);
    for (const term of oldTerms) {
      await dbRun(
        db,
        'INSERT INTO terms (year_id, term_number, label, start_date, end_date, created_at) VALUES (?, ?, ?, NULL, NULL, datetime("now"))',
        [newYearId, term.term_number, term.label]
      );
      termsCopied++;
    }

    // 4. Build old→new grade mapping (sort_order + 1)
    const newTerms = await dbAll(db, 'SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [newYearId]);
    const termMap = new Map<number, number>();
    for (let i = 0; i < oldTerms.length && i < newTerms.length; i++) {
      termMap.set(oldTerms[i].id, newTerms[i].id);
    }

    // 5. Copy class sections for grades below final
    if (copyClassSections) {
      const oldSections = await dbAll(db, `
        SELECT cs.*, g.sort_order FROM class_sections cs
        JOIN grades g ON cs.grade_id = g.id
        WHERE g.sort_order < ?
      `, [maxSortOrder]);

      for (const section of oldSections) {
        // Find the grade with sort_order + 1
        const nextGrade = await dbGet(db, 'SELECT id FROM grades WHERE sort_order = ?', [section.sort_order + 1]);
        if (nextGrade) {
          await dbRun(
            db,
            'INSERT INTO class_sections (grade_id, label, created_at) VALUES (?, ?, datetime("now"))',
            [nextGrade.id, section.label]
          );
          classSectionsCopied++;
        }
      }
    }

    // 6. Copy fee structure (skip final grade)
    if (copyFeeStructure) {
      const oldFees = await dbAll(db, `
        SELECT fs.*, g.sort_order FROM fee_structure fs
        JOIN grades g ON fs.grade_id = g.id
        WHERE fs.year_id = ? AND g.sort_order < ?
      `, [oldYearId, maxSortOrder]);

      for (const fee of oldFees) {
        const nextGrade = await dbGet(db, 'SELECT id FROM grades WHERE sort_order = ?', [fee.sort_order + 1]);
        if (nextGrade) {
          const newTermId = termMap.get(fee.term_id);
          if (newTermId) {
            await dbRun(
              db,
              'INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
              [newYearId, newTermId, nextGrade.id, fee.fee_type, fee.amount_cents, fee.description]
            );
            feeStructureRowsCopied++;
          }
        }
      }
    }

    // 7. Get active enrollments
    const enrollments = await dbAll(db, `
      SELECT sye.*, g.sort_order
      FROM student_year_enrollment sye
      JOIN grades g ON sye.grade_id = g.id
      WHERE sye.year_id = ? AND sye.is_active = 1
    `, [oldYearId]);

    // 8. Process each student
    for (const enr of enrollments) {
      const isRepeater = repeaterStudentIds.includes(enr.student_id);

      if (isRepeater) {
        // Repeater: re-enroll in same grade
        const section = await dbGet(db, 'SELECT id FROM class_sections WHERE grade_id = ? AND label = ? LIMIT 1', [enr.grade_id, enr.class_section_id]);
        await dbRun(
          db,
          'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime("now"))',
          [enr.student_id, newYearId, enr.grade_id, enr.class_section_id]
        );
        repeaterCount++;
      } else if (enr.sort_order >= maxSortOrder) {
        // Graduate: set inactive
        await dbRun(db, 'UPDATE students SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [enr.student_id]);
        graduatedCount++;
      } else if (promoteAutomatically) {
        // Promote: enroll in next grade
        const nextGrade = await dbGet(db, 'SELECT id FROM grades WHERE sort_order = ?', [enr.sort_order + 1]);
        if (nextGrade) {
          // Try to find matching section
          let newSectionId = enr.class_section_id;
          if (enr.class_section_id) {
            const oldSection = await dbGet(db, 'SELECT label FROM class_sections WHERE id = ?', [enr.class_section_id]);
            if (oldSection) {
              const newSection = await dbGet(db, 'SELECT id FROM class_sections WHERE grade_id = ? AND label = ? LIMIT 1', [nextGrade.id, oldSection.label]);
              if (newSection) newSectionId = newSection.id;
            }
          }

          await dbRun(
            db,
            'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, datetime("now"))',
            [enr.student_id, newYearId, nextGrade.id, newSectionId]
          );
          promotedCount++;
        }
      } else {
        // Not promoting: set inactive (admin must enroll manually)
        await dbRun(db, 'UPDATE students SET is_active = 0, updated_at = datetime("now") WHERE id = ?', [enr.student_id]);
        graduatedCount++;
      }
    }

    // 9. Log the rollover
    await dbRun(
      db,
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [options.userId, 'admin', 'year_rollover', 'academic_years', newYearId,
       `Rolled over from ${oldYear.label} to ${newYearLabel}: ${promotedCount} promoted, ${graduatedCount} graduated, ${repeaterCount} repeating`]
    );

    // 10. Commit
    await dbRun(db, 'COMMIT');

    return {
      success: true,
      newYearId,
      promotedCount,
      graduatedCount,
      repeaterCount,
      feeStructureRowsCopied,
      classSectionsCopied,
      termsCopied,
    };
  } catch (err: any) {
    // Rollback on any error
    await dbRun(db, 'ROLLBACK');
    return {
      success: false,
      newYearId: 0,
      promotedCount: 0,
      graduatedCount: 0,
      repeaterCount: 0,
      feeStructureRowsCopied: 0,
      classSectionsCopied: 0,
      termsCopied: 0,
      error: err.message || 'Rollover failed',
    };
  }
}

// ── Brought-forward debt query ──

export interface BroughtForwardDebt {
  fromYear: string;
  amountCents: number;
}

/**
 * Check if a student has outstanding debt from any previous year.
 * Used by the statement view to show "Brought forward" entries.
 */
export async function getBroughtForwardDebts(
  db: any,
  studentId: number,
  currentYearId: number,
): Promise<BroughtForwardDebt[]> {
  const rows = await dbAll(db, `
    SELECT ay.label as from_year,
           COALESCE((
             SELECT SUM(sf.amount_cents) FROM student_fees sf
             JOIN fee_structure fs ON sf.fee_structure_id = fs.id
             WHERE sf.student_id = ? AND fs.year_id = ay.id
           ), 0) -
           COALESCE((
             SELECT SUM(p.amount_paid_cents) FROM payments p
             WHERE p.student_id = ? AND p.year_id = ay.id AND p.is_voided = 0
           ), 0) as balance
    FROM academic_years ay
    WHERE ay.id != ?
    GROUP BY ay.id
    HAVING balance > 0
    ORDER BY ay.label
  `, [studentId, studentId, currentYearId]);

  return rows.map((r: any) => ({
    fromYear: r.from_year,
    amountCents: r.balance,
  }));
}
