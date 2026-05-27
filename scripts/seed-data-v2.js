const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');

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

console.log('--- Database Seeding Script (Primary School - Realistic Data v2) ---');
console.log('Targeting database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Error: Database file not found. Run the app once first.');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const SHONA_FIRST_NAMES = [
  'Munashe',
  'Tadiwa',
  'Nyasha',
  'Farai',
  'Tendai',
  'Ruvimbo',
  'Tafadzwa',
  'Rutendo',
  'Kupakwashe',
  'Anesu',
  'Kudzai',
  'Sekai',
  'Tapiwa',
  'Chipo',
  'Danai',
  'Fadzai',
  'Gugulethu',
  'Hazvinei',
  'Isheanesu',
  'Jabulani',
  'Kumbirai',
  'Loveness',
  'Mufaro',
  'Natsai',
  'Onai',
  'Panashe',
  'Ropa',
  'Simbarashe',
  'Tatenda',
  'Unathi',
  'Vimbai',
  'Winston',
  'Xolani',
  'Yananai',
  'Zivai',
  'Chengetai',
  'Dambudzo',
  'Euvunice',
  'Fungai',
  'Garikai',
  'Hamadziripi',
  'Itai',
  'Jairos',
  'Kundai',
  'Leeroy',
  'Mazvita',
  'Ngonidzashe',
  'Obert',
  'Praise',
  'Rufaro',
  'Shingirai',
  'Tinotenda',
  'Upenyu',
  'Vongai',
  'Wellness',
  'Zandile',
  'Batanai',
  'Chiedza',
  'Dandaro',
  'Gamba',
];

const ENGLISH_FIRST_NAMES = [
  'Blessing',
  'Gift',
  'Joy',
  'Patience',
  'Hope',
  'Justice',
  'Knowledge',
  'Mercy',
  'Wisdom',
  'Grace',
  'Prosper',
  'Faith',
  'Precious',
  'Promise',
  'Goodness',
  'Bright',
  'Marvelous',
  'Prudence',
  'Trust',
  'Unity',
  'Liberty',
  'Miracle',
  'Peace',
  'Charity',
  'Victor',
  'Comfort',
  'Delight',
  'Emanuel',
  'Fortune',
  'Glory',
  'Honour',
  'Innocence',
  'Junior',
  'Kindness',
  'Love',
  'Memory',
  'Noble',
  'Ocean',
  'Prince',
  'Queen',
  'Rejoice',
  'Saviour',
  'Treasure',
  'Unique',
  'Value',
  'Wealth',
  'Xavier',
  'Young',
  'Zion',
  'Alpha',
];

const SHONA_SURNAMES = [
  'Moyo',
  'Sibanda',
  'Musoni',
  'Mutsago',
  'Zhou',
  'Gumbo',
  'Ndlovu',
  'Maposa',
  'Shumba',
  'Nyoni',
  'Chauke',
  'Dube',
  'Mutsvene',
  'Marufu',
  'Chigumba',
  'Zizhou',
  'Muzorewa',
  'Mutasa',
  'Tsvangirai',
  'Mugabe',
  'Mnangagwa',
  'Chamisa',
  'Ncube',
  'Khumalo',
  'Mhlanga',
  'Sithole',
  'Chirau',
  'Gandiwa',
  'Machingura',
  'Chitate',
  'Mudariki',
  'Zanamwe',
  'Murerwa',
  'Chikore',
  'Mawere',
  'Gono',
  'Chombo',
  'Kasukuwere',
  'Mzembi',
  'Parirenyatwa',
  'Nkomo',
  'Msika',
  'Mujuru',
  'Chiwenga',
  'Shiri',
  'Biti',
  'Madhuku',
  'Mliswa',
  'Mahere',
  'Chinamasai',
];

function popRandom(array) {
  if (array.length === 0) return 'Unknown';
  const index = Math.floor(Math.random() * array.length);
  return array.splice(index, 1)[0];
}

function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
const YEAR = '2026';

const TERMS = [
  { number: 1, label: 'Term 1', start: '2026-01-12', end: '2026-04-10' },
  { number: 2, label: 'Term 2', start: '2026-04-11', end: '2026-07-18' },
  { number: 3, label: 'Term 3', start: '2026-07-19', end: '2026-10-15' },
];

const TODAY = '2026-05-09';

const FEE_AMOUNT = 50000;

async function run() {
  try {
    console.log('- Step 1: Cleaning up database...');
    await cleanup();

    const yearId = await insertAcademicYear(YEAR);

    const termIds = [];
    for (const term of TERMS) {
      termIds.push(await insertTerm(yearId, term));
    }
    console.log(`- Step 2: Set up Year ${YEAR} with 3 Terms (Term 2 is current).`);

    const gradeIds = [];
    for (let i = 0; i < GRADES.length; i++) {
      gradeIds.push(await insertGrade(GRADES[i], i + 1));
    }

    const feeStructureIds = [];
    for (const tid of termIds) {
      const gradeFeeIds = [];
      for (const gid of gradeIds) {
        const fsId = await insertFeeStructure(yearId, tid, gid, FEE_AMOUNT);
        gradeFeeIds.push({ termId: tid, gradeId: gid, feeStructureId: fsId });
      }
      feeStructureIds.push(gradeFeeIds);
    }
    console.log(`- Step 3: Initialized fee structure ($500 per term for grades 1-6).`);

    const demoUser = await getOrCreateDemoUser();
    console.log(`- Step 4: Using demo user: ${demoUser.username}`);

    let firstNames = [...SHONA_FIRST_NAMES, ...ENGLISH_FIRST_NAMES];
    let guardianFirstNames = [...SHONA_FIRST_NAMES, ...ENGLISH_FIRST_NAMES];
    let surnames = [...SHONA_SURNAMES];

    let totalStudents = 0;
    let t1FullPaid = 0,
      t1PartialPaid = 0,
      t1Unpaid = 0;
    let t2FullPaid = 0,
      t2PartialPaid = 0,
      t2Unpaid = 0;
    let t1Enrolled = 0,
      t2Enrolled = 0,
      t2MidEnrolled = 0;

    const t1Start = new Date(TERMS[0].start);
    const t1End = new Date(TERMS[0].end);
    const t2Start = new Date(TERMS[1].start);
    const t2End = new Date(TERMS[1].end);
    const today = new Date(TODAY);

    for (const gid of gradeIds) {
      for (let i = 0; i < 12; i++) {
        const fName = popRandom(firstNames);
        const sName = popRandom(surnames);
        const gFName = popRandom(guardianFirstNames);

        const fullName = `${fName} ${sName}`;
        const guardianName = `${gFName} ${sName}`;
        const studentNumber = `FF${YEAR}${(totalStudents + 1).toString().padStart(4, '0')}`;

        const studentId = await insertStudent(studentNumber, fullName, guardianName, demoUser.id);

        const gradeFeeStructures = feeStructureIds.flat().filter(f => f.gradeId === gid);

        let enrollmentDate;
        const enrollmentType = Math.random();

        if (enrollmentType < 0.5) {
          enrollmentDate = randomDate(
            t1Start,
            new Date(t1Start.getTime() + 5 * 24 * 60 * 60 * 1000)
          );
          t1Enrolled++;
        } else if (enrollmentType < 0.8) {
          enrollmentDate = randomDate(t1Start, t1End);
          t2MidEnrolled++;
        } else {
          enrollmentDate = randomDate(
            t2Start,
            new Date(t2Start.getTime() + 10 * 24 * 60 * 60 * 1000)
          );
          t2Enrolled++;
        }

        const enrollmentId = await enrollStudent(
          studentId,
          yearId,
          gid,
          demoUser.id,
          enrollmentDate
        );

        const enrolledDate = new Date(enrollmentDate);

        if (enrolledDate <= t1End) {
          const t1FeeStructure = gradeFeeStructures.find(f => f.termId === termIds[0]);
          if (t1FeeStructure) {
            const t1DebitDate = enrolledDate <= t1Start ? TERMS[0].start : enrollmentDate;
            await insertStudentFee(
              studentId,
              t1FeeStructure.feeStructureId,
              t1DebitDate,
              FEE_AMOUNT
            );

            const rand = Math.random();
            if (rand < 0.7) {
              const p1Id = await insertPayment(
                studentId,
                yearId,
                termIds[0],
                gid,
                50000,
                randomDate(t1Start, t1End),
                demoUser.id
              );
              await insertReceipt(p1Id, 50000, 50000, 0, demoUser.id);
              t1FullPaid++;
            } else if (rand < 0.9) {
              const partialAmount = 25000 + Math.floor(Math.random() * 2) * 15000;
              const p1Id = await insertPayment(
                studentId,
                yearId,
                termIds[0],
                gid,
                partialAmount,
                randomDate(t1Start, t1End),
                demoUser.id
              );
              await insertReceipt(p1Id, 50000, partialAmount, 50000 - partialAmount, demoUser.id);
              t1PartialPaid++;
            } else {
              t1Unpaid++;
            }
          }
        }

        if (enrolledDate <= today) {
          const t2FeeStructure = gradeFeeStructures.find(f => f.termId === termIds[1]);
          if (t2FeeStructure) {
            const t2DebitDate = enrolledDate <= t2Start ? TERMS[1].start : enrollmentDate;
            const t2MaxDate = t2End < today ? t2End : today;
            await insertStudentFee(
              studentId,
              t2FeeStructure.feeStructureId,
              t2DebitDate,
              FEE_AMOUNT
            );

            const rand2 = Math.random();
            if (rand2 < 0.5) {
              const p2Id = await insertPayment(
                studentId,
                yearId,
                termIds[1],
                gid,
                50000,
                randomDate(t2Start, t2MaxDate),
                demoUser.id
              );
              await insertReceipt(p2Id, 50000, 50000, 0, demoUser.id);
              t2FullPaid++;
            } else if (rand2 < 0.8) {
              const partialAmount = 15000 + Math.floor(Math.random() * 3) * 10000;
              const p2Id = await insertPayment(
                studentId,
                yearId,
                termIds[1],
                gid,
                partialAmount,
                randomDate(t2Start, t2MaxDate),
                demoUser.id
              );
              await insertReceipt(p2Id, 50000, partialAmount, 50000 - partialAmount, demoUser.id);
              t2PartialPaid++;
            } else {
              t2Unpaid++;
            }
          }
        }

        totalStudents++;
      }
    }

    console.log(`- Step 5: Seeded ${totalStudents} unique students across grades 1-6.`);
    console.log(
      `- Enrollment: ${t1Enrolled} from Term 1 start, ${t2MidEnrolled} mid-Term 1, ${t2Enrolled} from Term 2 start`
    );
    console.log(
      `- Term 1 payments: ${t1FullPaid} full, ${t1PartialPaid} partial, ${t1Unpaid} unpaid`
    );
    console.log(
      `- Term 2 payments (up to ${TODAY}): ${t2FullPaid} full, ${t2PartialPaid} partial, ${t2Unpaid} unpaid`
    );
    console.log('\nSuccess: Database populated with realistic mock data!');
  } catch (err) {
    console.error('\nError:', err.message);
    console.error(err.stack);
  } finally {
    db.close();
  }
}

function cleanup() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM student_fees');
      db.run('DELETE FROM payment_receipts');
      db.run('DELETE FROM payments');
      db.run('DELETE FROM student_year_enrollment');
      db.run('DELETE FROM fee_structure');
      db.run('DELETE FROM students');
      db.run('DELETE FROM terms');
      db.run('DELETE FROM academic_years');
      db.run(
        'DELETE FROM sqlite_sequence WHERE name IN ("payment_receipts", "payments", "students", "academic_years", "terms", "student_year_enrollment", "fee_structure", "student_fees")',
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
}

function insertAcademicYear(label) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO academic_years (label, is_current) VALUES (?, 1)', [label], function (err) {
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
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function insertGrade(label, sortOrder) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO grades (label, sort_order) VALUES (?, ?)',
      [label, sortOrder],
      function (err) {
        if (err) return reject(err);
        db.get('SELECT id FROM grades WHERE label = ?', [label], (err, row) => {
          if (err) reject(err);
          else resolve(row.id);
        });
      }
    );
  });
}

function insertFeeStructure(yearId, termId, gradeId, amount) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents) VALUES (?, ?, ?, ?, ?)',
      [yearId, termId, gradeId, 'tuition', amount],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getOrCreateDemoUser() {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id, full_name, username FROM users WHERE username = 'demo' LIMIT 1",
      (err, row) => {
        if (err) return reject(err);
        if (row) {
          resolve(row);
        } else {
          db.run(
            'INSERT INTO users (full_name, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
            ['Demo User', 'demo', 'demo', 'admin', 1],
            function (err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, username: 'demo', full_name: 'Demo User' });
            }
          );
        }
      }
    );
  });
}

function insertStudent(studentNumber, fullName, guardianName, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO students (student_number, full_name, guardian_name, guardian_contact, created_by) VALUES (?, ?, ?, ?, ?)',
      [
        studentNumber,
        fullName,
        guardianName,
        '+263 77 ' + Math.floor(1000000 + Math.random() * 9000000),
        userId,
      ],
      function (err) {
        if (err) return reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function enrollStudent(studentId, yearId, gradeId, userId, enrollmentDate) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, enrolled_by, created_at) VALUES (?, ?, ?, ?, ?)',
      [studentId, yearId, gradeId, userId, enrollmentDate],
      function (err) {
        if (err) return reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function insertStudentFee(studentId, feeStructureId, debitDate, amountCents) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO student_fees (student_id, fee_structure_id, debit_date, amount_cents) VALUES (?, ?, ?, ?)',
      [studentId, feeStructureId, debitDate, amountCents],
      function (err) {
        if (err) return reject(err);
        else resolve(this.lastID);
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
      function (err) {
        if (err) return reject(err);
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
      err => {
        if (err) return reject(err);
        else resolve();
      }
    );
  });
}

run();
