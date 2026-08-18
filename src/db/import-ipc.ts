import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import db from './init';

/**
 * Excel import IPC bridge — wires the renderer to the import engine.
 *
 * Three-step protocol:
 *   1. open-import-file-dialog  → user picks a file, we parse + validate, return preview
 *   2. get-import-preview       → (re)validate with user-tweaked column mapping
 *   3. commit-import            → run the validated import inside a single transaction
 */

export function registerImportHandlers() {

  // ── Step 1: open file dialog → parse → validate → return preview ──
  ipcMain.handle('open-import-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Excel file to import',
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      });

      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }

      const filePath = result.filePaths[0];
      const parsed = parseWorkbook(filePath);

      return { success: true, filePath, parsed };
    } catch (err) {
      console.error('[IPC] open-import-file-dialog error:', err);
      return { success: false, error: String(err) };
    }
  });

  // ── Step 2: re-validate with a custom column mapping ──
  ipcMain.handle('get-import-preview', async (_event, options: {
    filePath: string;
    sheetName: string;
    columnMapping: Record<string, string>;  // excelHeader → dbField
    tableType: 'students' | 'payments';
  }) => {
    try {
      const { filePath, sheetName, columnMapping, tableType } = options;
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return { success: false, error: `Sheet "${sheetName}" not found` };
      }

      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const { validRows, errors } = await validateRows(rawRows, columnMapping, tableType);

      return {
        success: true,
        totalRows: rawRows.length,
        validRows: validRows.length,
        errors,
        sampleRows: validRows.slice(0, 10),
      };
    } catch (err) {
      console.error('[IPC] get-import-preview error:', err);
      return { success: false, error: String(err) };
    }
  });

  // ── Step 3: commit the import (single transaction) ──
  ipcMain.handle('commit-import', async (_event, options: {
    filePath: string;
    sheetName: string;
    columnMapping: Record<string, string>;
    tableType: 'students' | 'payments';
    dryRun?: boolean;
  }) => {
    try {
      const { filePath, sheetName, columnMapping, tableType } = options;
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return { success: false, tableType, totalRows: 0, importedRows: 0, skippedRows: 0, errors: [], warnings: [], error: `Sheet "${sheetName}" not found` };
      }
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (rawRows.length === 0) {
        return { success: false, tableType, totalRows: 0, importedRows: 0, skippedRows: 0, errors: [], warnings: [], error: 'Sheet is empty' };
      }

      // Reverse map
      const dbFieldToExcel: Record<string, string> = {};
      for (const [excelHeader, dbField] of Object.entries(columnMapping)) {
        if (dbField) dbFieldToExcel[dbField] = excelHeader;
      }

      // Validate
      const validRows: Record<string, any>[] = [];
      const errors: { row: number; field: string; message: string }[] = [];
      for (let i = 0; i < rawRows.length; i++) {
        const excelRowNum = i + 2;
        const raw = rawRows[i] as Record<string, any>;
        const mapped: Record<string, any> = {};
        let rowHasError = false;
        for (const [dbField, excelHeader] of Object.entries(dbFieldToExcel)) {
          const rawValue = raw[excelHeader];
          const parsed = validateField(dbField, rawValue);
          if (parsed.error) {
            errors.push({ row: excelRowNum, field: dbField, message: parsed.error });
            rowHasError = true;
          } else {
            mapped[dbField] = parsed.value;
          }
        }
        if (!rowHasError) validRows.push(mapped);
      }

      if (validRows.length === 0) {
        return { success: false, tableType, totalRows: rawRows.length, importedRows: 0, skippedRows: 0, errors, warnings: [], error: 'No valid rows found' };
      }

      // Commit inside transaction
      const result = await new Promise<any>((resolve) => {
        const warnings: string[] = [];
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          let importedCount = 0;
          try {
            for (const row of validRows) {
              if (tableType === 'students') {
                // Insert student
                const studentNumber = row.student_number || `STU${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;
                db.run(
                  `INSERT INTO students (student_number, full_name, first_name, surname, date_of_birth, gender,
                    guardian_name, guardian_first_name, guardian_surname, guardian_contact,
                    guardian_name_2, guardian_first_name_2, guardian_surname_2, guardian_contact_2, guardian_email)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    studentNumber,
                    row.full_name,
                    row.first_name || row.full_name?.split(' ')[0] || '',
                    row.surname || row.full_name?.split(' ').slice(1).join(' ') || '',
                    row.date_of_birth || null,
                    row.gender || null,
                    row.guardian_name,
                    row.guardian_first_name || row.guardian_name?.split(' ')[0] || '',
                    row.guardian_surname || row.guardian_name?.split(' ').slice(1).join(' ') || '',
                    row.guardian_contact,
                    row.guardian_name_2 || null,
                    row.guardian_first_name_2 || row.guardian_name_2?.split(' ')[0] || null,
                    row.guardian_surname_2 || row.guardian_name_2?.split(' ').slice(1).join(' ') || null,
                    row.guardian_contact_2 || null,
                    row.guardian_email || null,
                  ],
                  function(this: any, err: Error | null) {
                    if (err) throw new Error(`Student insert failed: ${err.message}`);
                    const studentId = this.lastID;
                    // Enrollment if grade_label provided
                    if (row.grade_label) {
                      const grade = db.prepare('SELECT id FROM grades WHERE label = ?').get(row.grade_label) as any;
                      if (grade) {
                        const currentYear = db.prepare('SELECT id FROM academic_years WHERE is_current = 1').get() as any;
                        if (currentYear) {
                          db.run('INSERT OR IGNORE INTO student_year_enrollment (student_id, year_id, grade_id) VALUES (?, ?, ?)', [studentId, currentYear.id, grade.id]);
                        }
                      }
                    }
                  }
                );
              } else {
                // Payment
                let student: any = null;
                if (row.student_number) student = db.prepare('SELECT id FROM students WHERE student_number = ?').get(row.student_number);
                if (!student && row.full_name) student = db.prepare('SELECT id FROM students WHERE full_name COLLATE NOCASE = ?').get(row.full_name);
                if (!student) {
                  warnings.push(`Could not find student "${row.full_name || row.student_number}" — skipping`);
                  continue;
                }
                const currentYear = db.prepare('SELECT id FROM academic_years WHERE is_current = 1').get() as any;
                if (!currentYear) warnings.push('No current academic year — payment recorded without year link');
                db.run(
                  `INSERT INTO payments (student_id, year_id, amount_paid_cents, payment_date, receipt_number, payment_method, recorded_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [student.id, currentYear?.id || null, row.amount_paid_cents, row.payment_date, row.receipt_number, row.payment_method || 'cash', null]
                );
              }
              importedCount++;
            }

            db.run('COMMIT', function(err: Error | null) {
              if (err) {
                db.run('ROLLBACK');
                resolve({ success: false, tableType, totalRows: rawRows.length, importedRows: 0, skippedRows: importedCount, errors, warnings, error: `Transaction failed: ${err.message}` });
                return;
              }
              // Audit log
              db.run(
                'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
                [null, 'System', 'import_completed', tableType, null, `Imported ${importedCount} ${tableType} rows from Excel`],
                function(this: any, auditErr: Error | null) {
                  resolve({
                    success: true,
                    tableType,
                    totalRows: rawRows.length,
                    importedRows: importedCount,
                    skippedRows: rawRows.length - importedCount,
                    errors,
                    warnings,
                    auditLogId: auditErr ? undefined : this.lastID,
                  });
                }
              );
            });
          } catch (e: any) {
            db.run('ROLLBACK');
            resolve({ success: false, tableType, totalRows: rawRows.length, importedRows: 0, skippedRows: validRows.length, errors, warnings, error: `Import failed: ${e.message}` });
          }
        });
      });

      return result;
    } catch (err) {
      console.error('[IPC] commit-import error:', err);
      return { success: false, error: String(err) };
    }
  });
}

// ── parse workbook → structured preview per sheet ──

interface SheetPreview {
  sheetName: string;
  headers: string[];
  rowCount: number;
  sample: Record<string, any>[];
}

interface ParsedWorkbook {
  fileName: string;
  sheets: SheetPreview[];
}

function parseWorkbook(filePath: string): ParsedWorkbook {
  const workbook = XLSX.readFile(filePath);
  const stats = fs.statSync(filePath);

  const sheets: SheetPreview[] = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const headers = json.length > 0 ? Object.keys(json[0] as object) : [];

    return {
      sheetName: name,
      headers,
      rowCount: json.length,
      sample: json.slice(0, 5) as Record<string, any>[],
    };
  });

  return {
    fileName: path.basename(filePath),
    sheets,
  };
}

// ── validate rows ──

interface ValidRow {
  [key: string]: any;
}

interface RowError {
  row: number;       // 1-based row number (as seen in Excel, header = row 1)
  field: string;
  message: string;
}

interface ValidationResult {
  validRows: ValidRow[];
  errors: RowError[];
}

async function validateRows(
  rawRows: Record<string, any>[],
  columnMapping: Record<string, string>,
  tableType: 'students' | 'payments',
): Promise<ValidationResult> {
  const validRows: ValidRow[] = [];
  const errors: RowError[] = [];

  // Reverse map: dbField → excelHeader
  const dbFieldToExcel: Record<string, string> = {};
  for (const [excelHeader, dbField] of Object.entries(columnMapping)) {
    if (dbField) dbFieldToExcel[dbField] = excelHeader;
  }

  for (let i = 0; i < rawRows.length; i++) {
    const excelRowNum = i + 2; // header is row 1, data starts at row 2
    const raw = rawRows[i];
    const mapped: Record<string, any> = {};
    let rowHasError = false;

    for (const [dbField, excelHeader] of Object.entries(dbFieldToExcel)) {
      const rawValue = raw[excelHeader];
      const parsed = validateField(dbField, rawValue);
      if (parsed.error) {
        errors.push({ row: excelRowNum, field: dbField, message: parsed.error });
        rowHasError = true;
      } else {
        mapped[dbField] = parsed.value;
      }
    }

    if (!rowHasError) {
      validRows.push(mapped);
    }
  }

  return { validRows, errors };
}

function validateField(dbField: string, rawValue: any): { value: any; error?: string } {
  const str = rawValue != null ? String(rawValue).trim() : '';

  switch (dbField) {
    // ── student fields ──
    case 'full_name': {
      if (!str) return { value: null, error: 'Full Name is required' };
      return { value: str };
    }
    case 'student_number': {
      if (!str) return { value: null }; // auto-generate later
      return { value: str };
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

    // ── payment fields ──
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

// ── Template download (main process saves to disk) ──
ipcMain.handle('save-import-template', async (_event, options: {
  fileName: string;
  headers: string[];
  sheetName: string;
}) => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog({
      defaultPath: options.fileName,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet([options.headers]);
    ws['!cols'] = options.headers.map((h: string) => ({ wch: Math.max(h.length + 2, 14) }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options.sheetName);
    XLSX.writeFile(wb, result.filePath);

    return { success: true, filePath: result.filePath };
  } catch (err) {
    console.error('[IPC] save-import-template error:', err);
    return { success: false, error: String(err) };
  }
});
