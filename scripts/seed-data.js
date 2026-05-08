const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- CONFIGURATION ---
const APP_NAME = 'feesfoundry';
let dbDir;

if (process.platform === 'win32') {
  dbDir = path.join(process.env.APPDATA, APP_NAME);
} else if (process.platform === 'darwin') {
  dbDir = path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
} else {
  dbDir = path.join(os.homedir(), '.config', APP_NAME);
}

const dbPath = path.join(dbDir, 'data.db');

console.log('--- Database Seeding Script (Final Version) ---');
console.log('Targeting database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Error: Database file not found. Run the app once first.');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

// --- EXPANDED NAME POOLS ---
const SHONA_FIRST_NAMES = [
  'Munashe', 'Tadiwa', 'Nyasha', 'Farai', 'Tendai', 'Ruvimbo', 'Tafadzwa', 'Rutendo', 'Kupakwashe', 'Anesu',
  'Kudzai', 'Sekai', 'Tapiwa', 'Chipo', 'Danai', 'Fadzai', 'Gugulethu', 'Hazvinei', 'Isheanesu', 'Jabulani',
  'Kumbirai', 'Loveness', 'Mufaro', 'Natsai', 'Onai', 'Panashe', 'Ropa', 'Simbarashe', 'Tatenda', 'Unathi',
  'Vimbai', 'Winston', 'Xolani', 'Yananai', 'Zivai', 'Chengetai', 'Dambudzo', 'Euvunice', 'Fungai', 'Garikai',
  'Hamadziripi', 'Itai', 'Jairos', 'Kundai', 'Leeroy', 'Mazvita', 'Ngonidzashe', 'Obert', 'Praise', 'Rufaro',
  'Shingirai', 'Tinotenda', 'Upenyu', 'Vongai', 'Wellness', 'Zandile', 'Batanai', 'Chiedza', 'Dandaro', 'Gamba',
  'Hama', 'Ishe', 'Jinda', 'Kupakwashe', 'Lucky', 'Mambo', 'Njere', 'Onyai', 'Penyu', 'Qhubani', 'Rudo', 'Simba'
];

const ENGLISH_FIRST_NAMES = [
  'Blessing', 'Gift', 'Joy', 'Patience', 'Hope', 'Justice', 'Knowledge', 'Mercy', 'Wisdom', 'Grace',
  'Prosper', 'Faith', 'Precious', 'Promise', 'Goodness', 'Bright', 'Marvelous', 'Prudence', 'Trust', 'Unity',
  'Liberty', 'Miracle', 'Peace', 'Charity', 'Victor', 'Comfort', 'Delight', 'Emanuel', 'Fortune', 'Glory',
  'Honour', 'Innocence', 'Junior', 'Kindness', 'Love', 'Memory', 'Noble', 'Ocean', 'Prince', 'Queen',
  'Rejoice', 'Saviour', 'Treasure', 'Unique', 'Value', 'Wealth', 'Xavier', 'Young', 'Zion', 'Alpha',
  'Beauty', 'Covenant', 'Divine', 'Everlasting', 'Favor', 'Genesis', 'Harmony', 'Infinity', 'Jewel', 'King',
  'Bright', 'Clear', 'Dawn', 'Eagle', 'Forest', 'Gem', 'Haven', 'Island', 'Justice', 'Kindred', 'Lyric'
];

const SHONA_SURNAMES = [
  'Moyo', 'Sibanda', 'Musoni', 'Mutsago', 'Zhou', 'Gumbo', 'Ndlovu', 'Maposa', 'Shumba', 'Nyoni',
  'Chauke', 'Dube', 'Mutsvene', 'Marufu', 'Chigumba', 'Zizhou', 'Muzorewa', 'Mutasa', 'Tsvangirai', 'Mugabe',
  'Mnangagwa', 'Chamisa', 'Ncube', 'Khumalo', 'Mhlanga', 'Sithole', 'Chirau', 'Gandiwa', 'Machingura', 'Chitate',
  'Mudariki', 'Zanamwe', 'Murerwa', 'Chikore', 'Mawere', 'Gono', 'Chombo', 'Kasukuwere', 'Mzembi', 'Parirenyatwa',
  'Nkomo', 'Msika', 'Mujuru', 'Chiwenga', 'Shiri', 'Biti', 'Madhuku', 'Mliswa', 'Mahere', 'Chinamasai',
  'Mangoma', 'Mangudya', 'Mushayavanhu', 'Guvamatanga', 'Zhuwao', 'Malaba', 'Hlatshwayo', 'Matutu', 'Nekati',
  'Pari', 'Sekeramayi', 'Mumbengegwi', 'Mumbere', 'Zhuwao', 'Mandizvidza', 'Kereke', 'Bvudzijena', 'Chiweshe'
];

function popRandom(array) {
  if (array.length === 0) return "Unknown";
  const index = Math.floor(Math.random() * array.length);
  return array.splice(index, 1)[0];
}

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];
const YEAR = '2026';
const TERMS = [
  { number: 1, label: 'Term 1', start: '2026-01-12', end: '2026-04-10' },
  { number: 2, label: 'Term 2', start: '2026-05-11', end: '2026-08-07' },
  { number: 3, label: 'Term 3', start: '2026-09-07', end: '2026-12-04' }
];

const FEE_AMOUNT = 50000; // $500.00

async function run() {
  try {
    console.log('- Step 1: Cleaning up database...');
    await cleanup();

    // 1. Academic Year
    const yearId = await insertAcademicYear(YEAR);
    
    // 2. Terms
    const termIds = [];
    for (const term of TERMS) {
      termIds.push(await insertTerm(yearId, term));
    }
    console.log(`- Step 2: Set up Year ${YEAR} with 3 Terms.`);

    // 3. Grades
    const gradeIds = [];
    for (let i = 0; i < GRADES.length; i++) {
      gradeIds.push(await insertGrade(GRADES[i], i + 1));
    }

    // 4. Fee Structure
    for (const tid of termIds) {
      for (const gid of gradeIds) {
        await insertFeeStructure(yearId, tid, gid, FEE_AMOUNT);
      }
    }
    console.log(`- Step 3: Initialized fee structure ($500 per term).`);

    // 5. User
    const admin = await getAdminUser();
    if (!admin) throw new Error('No admin user found. Run Setup Wizard in app first.');

    // 6. Students & Payments
    let firstNames = [...SHONA_FIRST_NAMES, ...ENGLISH_FIRST_NAMES];
    let guardianFirstNames = [...SHONA_FIRST_NAMES, ...ENGLISH_FIRST_NAMES];
    let surnames = [...SHONA_SURNAMES];
    
    let totalStudents = 0;
    let t1Payments = 0;
    let t2Payments = 0;

    for (const gid of gradeIds) {
      for (let i = 0; i < 10; i++) {
        const fName = popRandom(firstNames);
        const sName = popRandom(surnames);
        const gFName = popRandom(guardianFirstNames);
        
        const fullName = `${fName} ${sName}`;
        const guardianName = `${gFName} ${sName}`;
        const studentNumber = `FF${YEAR}${(totalStudents + 1).toString().padStart(4, '0')}`;

        const studentId = await insertStudent(studentNumber, fullName, guardianName, admin.id);
        await enrollStudent(studentId, yearId, gid, admin.id);

        // --- PAYMENTS ---
        
        // Term 1: All paid in full
        const p1Id = await insertPayment(studentId, yearId, termIds[0], gid, 50000, '2026-01-15', admin.id);
        await insertReceipt(p1Id, 50000, 50000, 0, admin.id);
        t1Payments++;

        // Term 2: 5 unpaid, 3 partial, 2 full
        let amountT2 = 0;
        if (i >= 5 && i < 8) amountT2 = 20000; // Partial $200
        else if (i >= 8) amountT2 = 50000; // Full $500

        if (amountT2 > 0) {
          const p2Id = await insertPayment(studentId, yearId, termIds[1], gid, amountT2, '2026-05-15', admin.id);
          await insertReceipt(p2Id, 50000, amountT2, 50000 - amountT2, admin.id);
          t2Payments++;
        }

        // Term 3: Not debited (No payments)

        totalStudents++;
      }
    }

    console.log(`- Step 4: Seeded ${totalStudents} unique students.`);
    console.log(`- Step 5: Created ${t1Payments} T1 payments and ${t2Payments} T2 payments.`);
    console.log('\nSuccess: Database populated with clean mock data!');

  } catch (err) {
    console.error('\nError:', err.message);
  } finally {
    db.close();
  }
}

// --- HELPERS ---

function cleanup() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM payment_receipts');
      db.run('DELETE FROM payments');
      db.run('DELETE FROM student_year_enrollment');
      db.run('DELETE FROM fee_structure');
      db.run('DELETE FROM students');
      db.run('DELETE FROM terms');
      db.run('DELETE FROM academic_years');
      db.run('DELETE FROM sqlite_sequence WHERE name IN ("payment_receipts", "payments", "students", "academic_years", "terms", "student_year_enrollment", "fee_structure")', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function insertAcademicYear(label) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO academic_years (label, is_current) VALUES (?, 1)', [label], function(err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

function insertTerm(yearId, term) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO terms (year_id, term_number, label, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [yearId, term.number, term.label, term.start, term.end],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function insertGrade(label, sortOrder) {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO grades (label, sort_order) VALUES (?, ?)', [label, sortOrder], function(err) {
      if (err) return reject(err);
      db.get('SELECT id FROM grades WHERE label = ?', [label], (err, row) => {
        if (err) reject(err);
        else resolve(row.id);
      });
    });
  });
}

function insertFeeStructure(yearId, termId, gradeId, amount) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents) VALUES (?, ?, ?, ?, ?)',
      [yearId, termId, gradeId, 'tuition', amount],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getAdminUser() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE role = "admin" LIMIT 1', (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function insertStudent(studentNumber, fullName, guardianName, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO students (student_number, full_name, guardian_name, guardian_contact, created_by) VALUES (?, ?, ?, ?, ?)',
      [studentNumber, fullName, guardianName, '+263 77 ' + Math.floor(1000000 + Math.random() * 9000000), userId],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function enrollStudent(studentId, yearId, gradeId, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, enrolled_by) VALUES (?, ?, ?, ?)',
      [studentId, yearId, gradeId, userId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function insertPayment(studentId, yearId, termId, gradeId, amount, date, userId) {
  const receiptNumber = 'R' + Date.now() + Math.floor(Math.random() * 10000);
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO payments (student_id, year_id, term_id, grade_id, amount_paid_cents, payment_date, receipt_number, payment_method, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [studentId, yearId, termId, gradeId, amount, date, receiptNumber, 'cash', userId],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function insertReceipt(paymentId, owed, paid, outstanding, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO payment_receipts (payment_id, fee_owed_cents, amount_paid_cents, outstanding_cents, generated_by) VALUES (?, ?, ?, ?, ?)',
      [paymentId, owed, paid, outstanding, userId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

run();
