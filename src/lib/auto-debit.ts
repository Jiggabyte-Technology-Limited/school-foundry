import db from '../db/init';

export async function autoDebitFees(): Promise<{ applied: number; message: string }> {
  const today = new Date().toISOString().split('T')[0];
  console.log('[AutoDebit] Running for date:', today);

  // Find all fee_structure records where the term has started but not yet debited
  const pendingFees = await new Promise<any[]>((resolve, reject) => {
    db.all(
      `
    SELECT 
      fs.id as fee_structure_id,
      fs.year_id,
      fs.term_id,
      fs.grade_id,
      fs.amount_cents,
      t.label as term_label,
      t.start_date,
      t.end_date,
      sye.created_at as enrolled_at,
      sye.student_id
    FROM fee_structure fs
    JOIN terms t ON fs.term_id = t.id
    JOIN student_year_enrollment sye ON fs.grade_id = sye.grade_id AND fs.year_id = sye.year_id
    LEFT JOIN student_fees sf ON sf.fee_structure_id = fs.id AND sf.student_id = sye.student_id
    WHERE t.start_date IS NOT NULL 
      AND t.start_date <= ?
      AND (t.end_date IS NULL OR date(t.end_date) >= date(sye.created_at))
      AND sf.id IS NULL
    ORDER BY t.start_date, fs.grade_id
    `,
      [today],
      (err, rows) => {
        if (err) {
          console.error('[AutoDebit] Query error:', err);
          reject(err);
        } else {
          console.log('[AutoDebit] Found pending fees:', rows?.length || 0);
          resolve(rows || []);
        }
      }
    );
  });

  if (pendingFees.length === 0) {
    console.log('[AutoDebit] No pending fees found. Checking data...');

    // Debug: check what data exists
    const debugInfo = await new Promise<any>((resolve, reject) => {
      db.get(
        `
        SELECT 
          (SELECT COUNT(*) FROM fee_structure) as fee_count,
          (SELECT COUNT(*) FROM terms WHERE start_date IS NOT NULL AND start_date <= ?) as term_count,
          (SELECT COUNT(*) FROM student_year_enrollment) as enrollment_count,
          (SELECT COUNT(*) FROM student_fees) as student_fees_count
      `,
        [today],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    console.log('[AutoDebit] Debug info:', debugInfo);

    return { applied: 0, message: 'No fees to debit' };
  }

  console.log(
    '[AutoDebit] Processing fees:',
    pendingFees.map(f => ({ student: f.student_id, term: f.term_label, amount: f.amount_cents }))
  );

  // Insert all pending fees
  let appliedCount = 0;
  for (const fee of pendingFees) {
    try {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO student_fees (student_id, fee_structure_id, debit_date, amount_cents) VALUES (?, ?, ?, ?)`,
          [fee.student_id, fee.fee_structure_id, fee.start_date, fee.amount_cents],
          err => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      appliedCount++;
    } catch (e) {
      console.log('[AutoDebit] Skip duplicate:', e);
      // Skip duplicates - they already exist
    }
  }

  console.log('[AutoDebit] Applied count:', appliedCount);
  return {
    applied: appliedCount,
    message: `Applied ${appliedCount} fee${appliedCount !== 1 ? 's' : ''}`,
  };
}

export async function checkAndDebitFees(): Promise<void> {
  try {
    const result = await autoDebitFees();
    if (result.applied > 0) {
      console.log(`[AutoDebit] ${result.message}`);
    }
  } catch (err) {
    console.error('[AutoDebit] Error:', err);
  }
}
