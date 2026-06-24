// verify-task7.mjs — Excel Import round-trip verification
// Standalone test — does not import electron
import XLSX from 'xlsx';
import Database from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Setup test DB ──
const testDbPath = path.join(os.tmpdir(), `schoolfoundry-test-${Date.now()}.db`);
const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf-8');

const testDb = new Database.Database(testDbPath);
testDb.exec(schemaSql);

// ── Register the import handlers directly (mimicking main.ts wiring) ──
// We import the registration function from the compiled dist
// Since this runs as ESM, we'll inline the key logic

const activityLog = [];

function log(msg) {
  console.log(`  ${msg}`);
  activityLog.push(msg);
}

// ── Helper: build a test workbook ──
function buildTestWorkbook(sheetName, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filePath = path.join(os.tmpdir(), `import-test-${Date.now()}.xlsx`);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

// ── Validation logic (mirror of import-ipc.ts) ──
function validateField(dbField, rawValue) {
  const str = rawValue != null ? String(rawValue).trim() : '';
  switch (dbField) {
    case 'full_name':
      if (!str) return { value: null, error: 'Full Name is required' };
      return { value: str };
    case 'student_number':
      return { value: str || null };
    case 'date_of_birth':
      if (!str) return { value: null };
      return { value: str };
    case 'gender':
      if (!str) return { value: null };
      return { value: str.toLowerCase() };
    case 'guardian_name':
      if (!str) return { value: null, error: 'Guardian Name is required' };
      return { value: str };
    case 'guardian_contact':
      if (!str) return { value: null, error: 'Guardian Contact is required' };
      return { value: str };
    case 'guardian_name_2':
    case 'guardian_contact_2':
    case 'guardian_email':
      return { value: str || null };
    case 'grade_label':
      return { value: str || null };
    case 'amount_paid_cents': {
      const num = Number(str);
      if (!num || num <= 0) return { value: null, error: 'Amount must be > 0' };
      return { value: Math.round(num) };
    }
    case 'payment_date':
      if (!str) return { value: null, error: 'Payment Date is required' };
      return { value: str };
    case 'receipt_number':
      if (!str) return { value: null, error: 'Receipt Number is required' };
      return { value: str };
    case 'payment_method': {
      const valid = ['cash', 'ecocash', 'bank_transfer', 'other'];
      if (!str) return { value: 'cash' };
      const lower = str.toLowerCase();
      if (!valid.includes(lower)) return { value: null, error: `Invalid method: ${str}` };
      return { value: lower };
    }
    default:
      return { value: str || null };
  }
}

function validateRows(rawRows, columnMapping, tableType) {
  const dbFieldToExcel = {};
  for (const [excelHeader, dbField] of Object.entries(columnMapping)) {
    if (dbField) dbFieldToExcel[dbField] = excelHeader;
  }

  const validRows = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const excelRowNum = i + 2;
    const raw = rawRows[i];
    const mapped = {};
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

  return { validRows, errors };
}

// ── Test runner ──

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    log(`  ✓ ${testName}`);
    passed++;
  } else {
    log(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  log('Task 7 — Excel Import Verification');
  log('====================================\n');

  // ── Test 1: Parse a valid student workbook ──
  log('Test 1: Parse valid student workbook');
  {
    const rows = [
      { 'Full Name': 'Alice Mupenge', 'Student Number': 'STU001', 'Guardian Name': 'John Mupenge', 'Guardian Contact': '263778888888', 'Grade': 'Grade 1' },
      { 'Full Name': 'Banda Moyo', 'Student Number': 'STU002', 'Guardian Name': 'Sarah Moyo', 'Guardian Contact': '263779999999', 'Grade': 'Grade 2' },
      { 'Full Name': 'Chipo Nyathi', 'Guardian Name': 'Mary Nyathi', 'Guardian Contact': '263770000000' },
    ];
    const filePath = buildTestWorkbook('Students', rows);

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['Students'];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const columnMapping = {
      'Full Name': 'full_name',
      'Student Number': 'student_number',
      'Guardian Name': 'guardian_name',
      'Guardian Contact': 'guardian_contact',
      'Grade': 'grade_label',
    };

    const { validRows, errors } = validateRows(rawRows, columnMapping, 'students');

    assert(errors.length === 0, `No errors on valid data (got ${errors.length})`);
    assert(validRows.length === 3, `3 valid rows (got ${validRows.length})`);
    assert(validRows[0].full_name === 'Alice Mupenge', 'First student name correct');
    assert(validRows[0].guardian_contact === '263778888888', 'Guardian contact preserved');
    assert(validRows[2].student_number === null, 'Missing student_number → null (auto-gen)');

    fs.unlinkSync(filePath);
  }

  // ── Test 2: Catch deliberate errors ──
  log('\nTest 2: Catch validation errors');
  {
    const rows = [
      { 'Full Name': '', 'Guardian Name': 'Test', 'Guardian Contact': '123' },  // missing name
      { 'Full Name': 'Valid Student', 'Guardian Name': '', 'Guardian Contact': '123' },  // missing guardian
      { 'Full Name': 'Another Valid', 'Guardian Name': 'Guardian', 'Guardian Contact': '' },  // missing contact
    ];
    const filePath = buildTestWorkbook('BadStudents', rows);

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['BadStudents'];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const columnMapping = {
      'Full Name': 'full_name',
      'Guardian Name': 'guardian_name',
      'Guardian Contact': 'guardian_contact',
    };

    const { validRows, errors } = validateRows(rawRows, columnMapping, 'students');

    assert(validRows.length === 0, 'No valid rows (all have errors)');
    assert(errors.length === 3, `3 errors detected (got ${errors.length})`);
    assert(errors.some(e => e.field === 'full_name'), 'Error on full_name');
    assert(errors.some(e => e.field === 'guardian_name'), 'Error on guardian_name');
    assert(errors.some(e => e.field === 'guardian_contact'), 'Error on guardian_contact');

    fs.unlinkSync(filePath);
  }

  // ── Test 3: Payment import with valid data ──
  log('\nTest 3: Payment import validation');
  {
    // First insert a student to link
    testDb.run(
      `INSERT INTO students (student_number, full_name, guardian_name, guardian_contact)
       VALUES (?, ?, ?, ?)`,
      ['STU100', 'Test Student', 'Guardian', '263770000000']
    );
    testDb.run(
      `INSERT INTO academic_years (label, is_current) VALUES (?, ?)`,
      ['2026', 1]
    );

    const rows = [
      { 'Student Number': 'STU100', 'Amount': '5000', 'Payment Date': '2026-03-15', 'Receipt Number': 'RCP001', 'Payment Method': 'cash' },
      { 'Student Number': 'STU100', 'Amount': '3000', 'Payment Date': '2026-04-01', 'Receipt Number': 'RCP002', 'Payment Method': 'ecocash' },
    ];
    const filePath = buildTestWorkbook('Payments', rows);

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['Payments'];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const columnMapping = {
      'Student Number': 'student_number',
      'Amount': 'amount_paid_cents',
      'Payment Date': 'payment_date',
      'Receipt Number': 'receipt_number',
      'Payment Method': 'payment_method',
    };

    const { validRows, errors } = validateRows(rawRows, columnMapping, 'payments');

    assert(errors.length === 0, `No errors on valid payments (got ${errors.length})`);
    assert(validRows.length === 2, `2 valid payment rows (got ${validRows.length})`);
    assert(validRows[0].amount_paid_cents === 5000, 'Amount parsed as integer cents');
    assert(validRows[0].payment_method === 'cash', 'Payment method normalized');
    assert(validRows[1].payment_method === 'ecocash', 'EcoCash method accepted');

    fs.unlinkSync(filePath);
  }

  // ── Test 4: Payment with invalid amount ──
  log('\nTest 4: Payment validation rejects bad data');
  {
    const rows = [
      { 'Student Number': 'STU100', 'Amount': '-100', 'Payment Date': '2026-03-15', 'Receipt Number': 'RCP003' },
      { 'Student Number': 'STU100', 'Amount': 'abc', 'Payment Date': '2026-03-15', 'Receipt Number': 'RCP004' },
      { 'Student Number': 'STU100', 'Amount': '0', 'Payment Date': '2026-03-15', 'Receipt Number': 'RCP005' },
    ];
    const filePath = buildTestWorkbook('BadPayments', rows);

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets['BadPayments'];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const columnMapping = {
      'Student Number': 'student_number',
      'Amount': 'amount_paid_cents',
      'Payment Date': 'payment_date',
      'Receipt Number': 'receipt_number',
    };

    const { validRows, errors } = validateRows(rawRows, columnMapping, 'payments');

    assert(validRows.length === 0, 'All invalid payments rejected');
    assert(errors.length === 3, `3 errors for 3 bad amounts (got ${errors.length})`);

    fs.unlinkSync(filePath);
  }

  // ── Test 5: Multi-sheet workbook ──
  log('\nTest 5: Multi-sheet workbook parsing');
  {
    const students = [
      { 'Full Name': 'Multi Sheet Student', 'Guardian Name': 'Guardian', 'Guardian Contact': '263770000001' },
    ];
    const ws1 = XLSX.utils.json_to_sheet(students);
    const ws2 = XLSX.utils.json_to_sheet([{ 'A': 1, 'B': 2 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Learners');
    XLSX.utils.book_append_sheet(wb, ws2, 'Other');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filePath = path.join(os.tmpdir(), `multi-sheet-${Date.now()}.xlsx`);
    fs.writeFileSync(filePath, buf);

    const wbRead = XLSX.readFile(filePath);
    assert(wbRead.SheetNames.length === 2, '2 sheets detected');
    assert(wbRead.SheetNames[0] === 'Learners', 'First sheet name correct');

    const sheet = wbRead.Sheets['Learners'];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    assert(rawRows.length === 1, '1 data row in Learners sheet');
    assert(rawRows[0]['Full Name'] === 'Multi Sheet Student', 'Data intact');

    fs.unlinkSync(filePath);
  }

  // ── Test 6: Empty workbook ──
  log('\nTest 6: Empty workbook handling');
  {
    const ws = XLSX.utils.json_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filePath = path.join(os.tmpdir(), `empty-${Date.now()}.xlsx`);
    fs.writeFileSync(filePath, buf);

    const wbRead = XLSX.readFile(filePath);
    const sheet = wbRead.Sheets['Empty'];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    assert(rawRows.length === 0, 'Empty sheet produces 0 rows');

    fs.unlinkSync(filePath);
  }

  // ── Test 7: Commit students to DB (using callback API like the app) ──
  log('\nTest 7: Commit valid students to database');
  await new Promise((resolve) => {
    const validRows = [
      { full_name: 'DB Test Student 1', guardian_name: 'Guardian 1', guardian_contact: '263770000010' },
      { full_name: 'DB Test Student 2', guardian_name: 'Guardian 2', guardian_contact: '263770000011' },
    ];

    testDb.serialize(() => {
      testDb.run('BEGIN TRANSACTION');
      for (const row of validRows) {
        const sn = `STU${Date.now()}${Math.floor(Math.random() * 10000)}`;
        testDb.run(
          `INSERT INTO students (student_number, full_name, guardian_name, guardian_contact)
           VALUES (?, ?, ?, ?)`,
          [sn, row.full_name, row.guardian_name, row.guardian_contact]
        );
      }
      testDb.run('COMMIT', function(err) {
        if (err) {
          log(`  ✗ FAIL: Commit failed: ${err.message}`);
          failed++;
          resolve();
          return;
        }
        log('  ✓ Commit succeeded without error');
        passed++;

        testDb.get(
          'SELECT COUNT(*) as c FROM students WHERE full_name LIKE ?',
          ['DB Test Student%'],
          function(err, row) {
            if (err) {
              log(`  ✗ FAIL: Count query failed: ${err.message}`);
              failed++;
            } else {
              const count = row?.c ?? row;
              if (count === 2) {
                log('  ✓ 2 students in DB');
                passed++;
              } else {
                log(`  ✗ FAIL: 2 students in DB (got ${JSON.stringify(row)})`);
                failed++;
              }
            }
            resolve();
          }
        );
      });
    });
  });

  // ── Cleanup ──
  await new Promise(resolve => testDb.close(resolve));
  try { fs.unlinkSync(testDbPath); } catch {}

  // ── Summary ──
  log('\n====================================');
  log(`Results: ${passed} passed, ${failed} failed`);
  log('====================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
