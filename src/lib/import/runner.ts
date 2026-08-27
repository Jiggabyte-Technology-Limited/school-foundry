/**
 * Excel import engine — validates and commits rows into the SQLite database.
 * 
 * runner.ts orchestrates the full import pipeline:
 *   1. Parse workbook → raw rows
 *   2. Map columns per user's columnMapping
 *   3. Validate all rows (collect errors, reject bad ones)
 *   4. Commit valid rows inside a single transaction (rollback on any failure)
 *   5. Audit-log the import
 */

import * as XLSX from 'xlsx';
import db from '../../db/init';

export interface ImportOptions {
  filePath: string;
  sheetName: string;
  columnMapping: Record<string, string>;  // excelHeader → dbField
  tableType: 'students' | 'payments';
  dryRun?: boolean;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  tableType: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: ImportError[];
  warnings: string[];
  auditLogId?: number;
  error?: string;
}

// ── Main entry point ──

export async function runImport(options: ImportOptions): Promise<ImportResult> {
  const { filePath, sheetName, columnMapping, tableType, dryRun = false } = options;

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      success: false,
      tableType,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: [],
      warnings: [],
      error: `Sheet "${sheetName}" not found in workbook`,
    };
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    return {
      success: false,
      tableType,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: [],
      warnings: [],
      error: 'Sheet is empty — no data rows to import.',
    };
  }

  // Reverse map: dbField → excelHeader
  const dbFieldToExcel: Record<string, string> = {};
  for (const [excelHeader, dbField] of Object.entries(columnMapping)) {
    if (dbField) dbFieldToExcel[dbField] = excelHeader;
  }

  // Validate all rows
  const validRows: Record<string, any>[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const excelRowNum = i + 2;
    const raw = rawRows[i] as Record<string, any>;
    const mapped: Record<string, any> = {};
    let rowHasError = false;

    for (const [dbField, excelHeader] of Object.entries(dbFieldToExcel)) {
      const rawValue = raw[excelHeader];
      const result = validateField(dbField, rawValue);
      if (result.error) {
        errors.push({ row: excelRowNum, field: dbField, message: result.error });
        rowHasError = true;
      } else {
        mapped[dbField] = result.value;
      }
    }

    if (!rowHasError) {
      validRows.push(mapped);
    }
  }

  if (dryRun) {
    return {
      success: true,
      tableType,
      totalRows: rawRows.length,
      importedRows: 0,
      skippedRows: validRows.length,
      errors,
      warnings: [],
    };
  }

  if (validRows.length === 0) {
    return {
      success: false,
      tableType,
      totalRows: rawRows.length,
      importedRows: 0,
      skippedRows: 0,
      errors,
      warnings: [],
      error: 'No valid rows found. Fix the errors and try again.',
    };
  }

  // Commit inside a transaction
  const result = await commitRows(validRows, tableType, errors, rawRows.length);
  return result;
}

// ── Transaction commit ──

async function commitRows(
  rows: Record<string, any>[],
  tableType: 'students' | 'payments',
  errors: ImportError[],
  totalRawRows: number,
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const warnings: string[] = [];

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      let importedCount = 0;

      try {
        for (const row of rows) {
          if (tableType === 'students') {
            importStudentRow(row);
          } else {
            importPaymentRow(row, warnings);
          }
          importedCount++;
        }

        db.run('COMMIT', function(this: any, err: Error | null) {
          if (err) {
            db.run('ROLLBACK');
            resolve({
              success: false,
              tableType,
              totalRows: totalRawRows,
              importedRows: 0,
              skippedRows: importedCount,
              errors,
              warnings,
              error: `Transaction failed: ${err.message}`,
            });
            return;
          }

          // Audit log
          db.run(
            'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
            [
              null,
              'System',
              'import_completed',
              tableType,
              null,
              `Imported ${importedCount} ${tableType} rows from Excel`,
            ],
            function(this: any, auditErr: Error | null) {
              const auditLogId = auditErr ? undefined : this.lastID;
              resolve({
                success: true,
                tableType,
                totalRows: totalRawRows,
                importedRows: importedCount,
                skippedRows: totalRawRows - importedCount,
                errors,
                warnings,
                auditLogId,
              });
            }
          );
        });
      } catch (e: any) {
        db.run('ROLLBACK');
        resolve({
          success: false,
          tableType,
          totalRows: totalRawRows,
          importedRows: 0,
          skippedRows: rows.length,
          errors,
          warnings,
          error: `Import failed: ${e.message}`,
        });
      }
    });
  });
}

// ── Row import helpers ──

function importStudentRow(row: Record<string, any>) {
  // Generate student_number if not provided
  const studentNumber = row.student_number || `STU${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;

  // Insert student
  db.run(
    `INSERT INTO students (student_number, full_name, date_of_birth, gender, guardian_name, guardian_contact, guardian_name_2, guardian_contact_2, guardian_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      studentNumber,
      row.full_name,
      row.date_of_birth || null,
      row.gender || null,
      row.guardian_name,
      row.guardian_contact,
      row.guardian_name_2 || null,
      row.guardian_contact_2 || null,
      row.guardian_email || null,
    ],
    function(this: any, err: Error | null) {
      if (err) {
        throw new Error(`Failed to insert student "${row.full_name}": ${err.message}`);
      }

      const studentId = this.lastID;

      // If grade_label is provided, look up grade and create enrollment
      if (row.grade_label) {
        const grade = db.prepare('SELECT id FROM grades WHERE label = ?').get(row.grade_label) as any;
        if (grade) {
          const currentYear = db.prepare('SELECT id FROM academic_years WHERE is_current = 1').get() as any;
          if (currentYear) {
            db.run(
              'INSERT OR IGNORE INTO student_year_enrollment (student_id, year_id, grade_id) VALUES (?, ?, ?)',
              [studentId, currentYear.id, grade.id]
            );
          }
        }
      }
    }
  );
}

function importPaymentRow(row: Record<string, any>, warnings: string[]) {
  // Look up student by student_number or full_name
  let student: any = null;
  if (row.student_number) {
    student = db.prepare('SELECT id FROM students WHERE student_number = ?').get(row.student_number);
  }
  if (!student && row.full_name) {
    student = db.prepare('SELECT id FROM students WHERE full_name COLLATE NOCASE = ?').get(row.full_name);
  }
  if (!student) {
    warnings.push(`Could not find student "${row.full_name || row.student_number}" — skipping payment`);
    return;
  }

  // Resolve current year + term
  const currentYear = db.prepare('SELECT id FROM academic_years WHERE is_current = 1').get() as any;
  if (!currentYear) {
    warnings.push('No current academic year — payment recorded without year link');
  }

  db.run(
    `INSERT INTO payments (student_id, year_id, amount_paid_cents, payment_date, receipt_number, payment_method, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      student.id,
      currentYear?.id || null,
      row.amount_paid_cents,
      row.payment_date,
      row.receipt_number,
      row.payment_method || 'cash',
      null,
    ]
  );
}

// ── Field validation (mirror of import-ipc.ts for standalone use) ──

function validateField(dbField: string, rawValue: any): { value: any; error?: string } {
  const str = rawValue != null ? String(rawValue).trim() : '';

  switch (dbField) {
    case 'full_name': {
      if (!str) return { value: null, error: 'Full Name is required' };
      return { value: str };
    }
    case 'student_number': {
      return { value: str || null };
    }
    case 'date_of_birth': {
      if (!str) return { value: null };
      const d = new Date(str);
      if (isNaN(d.getTime())) return { value: null, error: `Invalid date: "${str}"` };
      return { value: d.toISOString().split('T')[0] };
    }
    case 'gender': {
      if (!str) return { value: null };
      const lower = str.toLowerCase();
      if (!['male', 'female', 'other'].includes(lower)) {
        return { value: null, error: `Gender must be male/female/other, got "${str}"` };
      }
      return { value: lower };
    }
    case 'guardian_name': {
      if (!str) return { value: null, error: 'Guardian Name is required' };
      return { value: str };
    }
    case 'guardian_contact': {
      if (!str) return { value: null, error: 'Guardian Contact is required' };
      return { value: str };
    }
    case 'guardian_name_2':
    case 'guardian_contact_2':
    case 'guardian_email':
    case 'notes': {
      return { value: str || null };
    }
    case 'grade_label': {
      if (!str) return { value: null, error: 'Grade is required' };
      return { value: str };
    }
    case 'amount_paid_cents': {
      const num = Number(str);
      if (!num || num <= 0) return { value: null, error: `Amount must be > 0, got "${str}"` };
      return { value: Math.round(num) };
    }
    case 'payment_date': {
      if (!str) return { value: null, error: 'Payment Date is required' };
      const d = new Date(str);
      if (isNaN(d.getTime())) return { value: null, error: `Invalid date: "${str}"` };
      return { value: d.toISOString().split('T')[0] };
    }
    case 'receipt_number': {
      if (!str) return { value: null, error: 'Receipt Number is required' };
      return { value: str };
    }
    case 'payment_method': {
      const valid = ['cash', 'ecocash', 'bank_transfer', 'other'];
      if (!str) return { value: 'cash' };
      const lower = str.toLowerCase();
      if (!valid.includes(lower)) {
        return { value: null, error: `Payment method must be one of ${valid.join(', ')}, got "${str}"` };
      }
      return { value: lower };
    }
    default:
      return { value: str || null };
  }
}
