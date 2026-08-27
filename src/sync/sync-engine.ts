import * as crypto from 'crypto';
import db from '../db/init';
import { getOrCreateNodeIdentity } from './node-identity';

export interface SyncDelta {
  sync_uuid: string;
  entity_type: string;
  entity_uuid: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'VOID';
  payload_json: string;
  origin_node_id: string;
  created_at: string;
}

function runQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

function runGet<T>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

function runExec(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Record a local data mutation into the sync_deltas log.
 */
export async function recordSyncDelta(
  entityType: string,
  entityUuid: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'VOID',
  payload: Record<string, any>
): Promise<string> {
  const identity = await getOrCreateNodeIdentity();
  const syncUuid = `delta_${crypto.randomUUID()}`;
  const payloadJson = JSON.stringify(payload);
  const now = new Date().toISOString();

  await runExec(
    `INSERT OR REPLACE INTO sync_deltas (sync_uuid, entity_type, entity_uuid, operation, payload_json, origin_node_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [syncUuid, entityType, entityUuid, operation, payloadJson, identity.nodeId, now]
  );

  return syncUuid;
}

/**
 * Fetch all deltas recorded since a given timestamp or cursor.
 */
export async function getDeltasSince(sinceTimestamp: string = '1970-01-01T00:00:00.000Z'): Promise<SyncDelta[]> {
  return await runQuery<SyncDelta>(
    `SELECT sync_uuid, entity_type, entity_uuid, operation, payload_json, origin_node_id, created_at
     FROM sync_deltas
     WHERE created_at > ?
     ORDER BY created_at ASC`,
    [sinceTimestamp]
  );
}

/**
 * Apply remote deltas into local SQLite database inside an atomic transaction.
 */
export async function applyRemoteDeltas(
  deltas: SyncDelta[]
): Promise<{ applied: number; skipped: number; errors: string[] }> {
  let applied = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const delta of deltas) {
    try {
      // Check if we already have this delta
      const existingDelta = await runGet<any>(
        'SELECT id FROM sync_deltas WHERE sync_uuid = ?',
        [delta.sync_uuid]
      );

      if (existingDelta) {
        skipped++;
        continue;
      }

      const payload = JSON.parse(delta.payload_json);

      switch (delta.entity_type) {
        case 'students': {
          await applyStudentDelta(delta, payload);
          break;
        }
        case 'payments': {
          await applyPaymentDelta(delta, payload);
          break;
        }
        case 'fee_structure': {
          await applyFeeStructureDelta(delta, payload);
          break;
        }
        case 'academic_years': {
          await applyAcademicYearDelta(delta, payload);
          break;
        }
        case 'terms': {
          await applyTermDelta(delta, payload);
          break;
        }
        case 'grades': {
          await applyGradeDelta(delta, payload);
          break;
        }
        case 'class_sections': {
          await applyClassSectionDelta(delta, payload);
          break;
        }
        case 'student_year_enrollment': {
          await applyEnrollmentDelta(delta, payload);
          break;
        }
        case 'student_subsidies': {
          await applySubsidyDelta(delta, payload);
          break;
        }
        default: {
          // generic fallback log
          break;
        }
      }

      // Record this delta locally so we don't re-apply it and know we have it
      await runExec(
        `INSERT OR IGNORE INTO sync_deltas (sync_uuid, entity_type, entity_uuid, operation, payload_json, origin_node_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          delta.sync_uuid,
          delta.entity_type,
          delta.entity_uuid,
          delta.operation,
          delta.payload_json,
          delta.origin_node_id,
          delta.created_at,
        ]
      );

      applied++;
    } catch (err: any) {
      console.error(`[SyncEngine] Error applying delta ${delta.sync_uuid}:`, err);
      errors.push(`Delta ${delta.sync_uuid} (${delta.entity_type}): ${err.message}`);
    }
  }

  return { applied, skipped, errors };
}

async function applyStudentDelta(delta: SyncDelta, p: any) {
  const existing = await runGet<any>(
    'SELECT id FROM students WHERE sync_uuid = ? OR student_number = ?',
    [delta.entity_uuid, p.student_number]
  );

  if (existing) {
    await runExec(
      `UPDATE students SET
        student_number = COALESCE(?, student_number),
        full_name = COALESCE(?, full_name),
        first_name = COALESCE(?, first_name),
        surname = COALESCE(?, surname),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        guardian_name = COALESCE(?, guardian_name),
        guardian_first_name = COALESCE(?, guardian_first_name),
        guardian_surname = COALESCE(?, guardian_surname),
        guardian_contact = COALESCE(?, guardian_contact),
        guardian_name_2 = COALESCE(?, guardian_name_2),
        guardian_first_name_2 = COALESCE(?, guardian_first_name_2),
        guardian_surname_2 = COALESCE(?, guardian_surname_2),
        guardian_contact_2 = COALESCE(?, guardian_contact_2),
        guardian_email = COALESCE(?, guardian_email),
        is_active = COALESCE(?, is_active),
        is_vulnerable_child = COALESCE(?, is_vulnerable_child),
        ovc_category = COALESCE(?, ovc_category),
        notes = COALESCE(?, notes),
        sync_uuid = COALESCE(sync_uuid, ?),
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        p.student_number,
        p.full_name,
        p.first_name,
        p.surname,
        p.date_of_birth,
        p.gender,
        p.guardian_name,
        p.guardian_first_name,
        p.guardian_surname,
        p.guardian_contact,
        p.guardian_name_2,
        p.guardian_first_name_2,
        p.guardian_surname_2,
        p.guardian_contact_2,
        p.guardian_email,
        p.is_active,
        p.is_vulnerable_child,
        p.ovc_category,
        p.notes,
        delta.entity_uuid,
        existing.id,
      ]
    );
  } else {
    await runExec(
      `INSERT INTO students (
        student_number, full_name, first_name, surname, date_of_birth, gender,
        guardian_name, guardian_first_name, guardian_surname, guardian_contact,
        guardian_name_2, guardian_first_name_2, guardian_surname_2, guardian_contact_2,
        guardian_email, is_active, is_vulnerable_child, ovc_category, notes, sync_uuid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        p.student_number,
        p.full_name,
        p.first_name,
        p.surname,
        p.date_of_birth,
        p.gender,
        p.guardian_name || 'Guardian',
        p.guardian_first_name,
        p.guardian_surname,
        p.guardian_contact || 'N/A',
        p.guardian_name_2,
        p.guardian_first_name_2,
        p.guardian_surname_2,
        p.guardian_contact_2,
        p.guardian_email,
        p.is_active ?? 1,
        p.is_vulnerable_child ?? 0,
        p.ovc_category,
        p.notes,
        delta.entity_uuid,
      ]
    );
  }
}

async function applyPaymentDelta(delta: SyncDelta, p: any) {
  // Resolve local student_id by student sync_uuid or student_number
  let studentId = p.student_id;
  if (p.student_sync_uuid || p.student_number) {
    const student = await runGet<any>(
      'SELECT id FROM students WHERE sync_uuid = ? OR student_number = ?',
      [p.student_sync_uuid, p.student_number]
    );
    if (student) studentId = student.id;
  }

  // Resolve local year_id by label or sync_uuid
  let yearId = p.year_id;
  if (p.year_label) {
    const yr = await runGet<any>('SELECT id FROM academic_years WHERE label = ?', [p.year_label]);
    if (yr) yearId = yr.id;
  }

  // Resolve local term_id by term_number and year
  let termId = p.term_id;
  if (p.term_number && yearId) {
    const tm = await runGet<any>('SELECT id FROM terms WHERE year_id = ? AND term_number = ?', [
      yearId,
      p.term_number,
    ]);
    if (tm) termId = tm.id;
  }

  const existing = await runGet<any>(
    'SELECT id FROM payments WHERE sync_uuid = ? OR receipt_number = ?',
    [delta.entity_uuid, p.receipt_number]
  );

  if (existing) {
    if (delta.operation === 'VOID' || p.is_voided) {
      await runExec(
        `UPDATE payments SET
          is_voided = 1,
          voided_at = COALESCE(?, datetime('now')),
          void_reason = COALESCE(?, void_reason),
          sync_uuid = COALESCE(sync_uuid, ?)
        WHERE id = ?`,
        [p.voided_at, p.void_reason, delta.entity_uuid, existing.id]
      );
    }
  } else {
    await runExec(
      `INSERT INTO payments (
        student_id, year_id, term_id, grade_id, amount_paid_cents,
        payment_date, receipt_number, payment_method, notes,
        is_voided, voided_at, void_reason, recorded_by, sync_uuid, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
      [
        studentId,
        yearId,
        termId,
        p.grade_id,
        p.amount_paid_cents,
        p.payment_date,
        p.receipt_number,
        p.payment_method || 'cash',
        p.notes,
        p.is_voided ? 1 : 0,
        p.voided_at,
        p.void_reason,
        delta.entity_uuid,
      ]
    );
  }
}

async function applyFeeStructureDelta(delta: SyncDelta, p: any) {
  let yearId = p.year_id;
  if (p.year_label) {
    const yr = await runGet<any>('SELECT id FROM academic_years WHERE label = ?', [p.year_label]);
    if (yr) yearId = yr.id;
  }

  let termId = p.term_id;
  if (p.term_number && yearId) {
    const tm = await runGet<any>('SELECT id FROM terms WHERE year_id = ? AND term_number = ?', [
      yearId,
      p.term_number,
    ]);
    if (tm) termId = tm.id;
  }

  const existing = await runGet<any>(
    'SELECT id FROM fee_structure WHERE sync_uuid = ? OR (year_id = ? AND term_id = ? AND grade_id = ? AND fee_type = ?)',
    [delta.entity_uuid, yearId, termId, p.grade_id, p.fee_type || 'tuition']
  );

  if (existing) {
    await runExec(
      `UPDATE fee_structure SET
        amount_cents = ?,
        description = ?,
        sync_uuid = COALESCE(sync_uuid, ?),
        updated_at = datetime('now')
      WHERE id = ?`,
      [p.amount_cents, p.description, delta.entity_uuid, existing.id]
    );
  } else {
    await runExec(
      `INSERT INTO fee_structure (
        year_id, term_id, grade_id, fee_type, amount_cents, description, is_locked, sync_uuid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        yearId,
        termId,
        p.grade_id,
        p.fee_type || 'tuition',
        p.amount_cents,
        p.description,
        p.is_locked ?? 0,
        delta.entity_uuid,
      ]
    );
  }
}

async function applyAcademicYearDelta(delta: SyncDelta, p: any) {
  const existing = await runGet<any>(
    'SELECT id FROM academic_years WHERE sync_uuid = ? OR label = ?',
    [delta.entity_uuid, p.label]
  );
  if (!existing) {
    await runExec(
      `INSERT INTO academic_years (label, is_current, sync_uuid, created_at) VALUES (?, ?, ?, datetime('now'))`,
      [p.label, p.is_current ?? 0, delta.entity_uuid]
    );
  }
}

async function applyTermDelta(delta: SyncDelta, p: any) {
  let yearId = p.year_id;
  if (p.year_label) {
    const yr = await runGet<any>('SELECT id FROM academic_years WHERE label = ?', [p.year_label]);
    if (yr) yearId = yr.id;
  }
  if (!yearId) return;

  const existing = await runGet<any>(
    'SELECT id FROM terms WHERE year_id = ? AND term_number = ?',
    [yearId, p.term_number]
  );
  if (!existing) {
    await runExec(
      `INSERT INTO terms (year_id, term_number, label, start_date, end_date, sync_uuid, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [yearId, p.term_number, p.label, p.start_date, p.end_date, delta.entity_uuid]
    );
  }
}

async function applyGradeDelta(delta: SyncDelta, p: any) {
  const existing = await runGet<any>(
    'SELECT id FROM grades WHERE sync_uuid = ? OR label = ?',
    [delta.entity_uuid, p.label]
  );
  if (!existing) {
    await runExec(
      `INSERT INTO grades (label, sort_order, is_active, sync_uuid, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [p.label, p.sort_order ?? 0, p.is_active ?? 1, delta.entity_uuid]
    );
  }
}

async function applyClassSectionDelta(delta: SyncDelta, p: any) {
  const existing = await runGet<any>(
    'SELECT id FROM class_sections WHERE grade_id = ? AND label = ?',
    [p.grade_id, p.label]
  );
  if (!existing) {
    await runExec(
      `INSERT INTO class_sections (grade_id, label, sync_uuid, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [p.grade_id, p.label, delta.entity_uuid]
    );
  }
}

async function applyEnrollmentDelta(delta: SyncDelta, p: any) {
  let studentId = p.student_id;
  if (p.student_sync_uuid || p.student_number) {
    const s = await runGet<any>('SELECT id FROM students WHERE sync_uuid = ? OR student_number = ?', [
      p.student_sync_uuid,
      p.student_number,
    ]);
    if (s) studentId = s.id;
  }

  let yearId = p.year_id;
  if (p.year_label) {
    const yr = await runGet<any>('SELECT id FROM academic_years WHERE label = ?', [p.year_label]);
    if (yr) yearId = yr.id;
  }

  if (!studentId || !yearId) return;

  const existing = await runGet<any>(
    'SELECT id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
    [studentId, yearId]
  );

  if (existing) {
    await runExec(
      `UPDATE student_year_enrollment SET grade_id = ?, class_section_id = ?, is_active = ?, sync_uuid = COALESCE(sync_uuid, ?) WHERE id = ?`,
      [p.grade_id, p.class_section_id, p.is_active ?? 1, delta.entity_uuid, existing.id]
    );
  } else {
    await runExec(
      `INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id, is_active, sync_uuid, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [studentId, yearId, p.grade_id, p.class_section_id, p.is_active ?? 1, delta.entity_uuid]
    );
  }
}

async function applySubsidyDelta(delta: SyncDelta, p: any) {
  let studentId = p.student_id;
  if (p.student_sync_uuid) {
    const s = await runGet<any>('SELECT id FROM students WHERE sync_uuid = ?', [p.student_sync_uuid]);
    if (s) studentId = s.id;
  }
  if (!studentId) return;

  await runExec(
    `INSERT OR REPLACE INTO student_subsidies (
      student_id, provider_id, year_id, term_id, coverage_type, coverage_value,
      application_reason, grant_reference_number, is_active, prevent_academic_exclusion, sync_uuid, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      studentId,
      p.provider_id,
      p.year_id,
      p.term_id,
      p.coverage_type,
      p.coverage_value,
      p.application_reason,
      p.grant_reference_number,
      p.is_active ?? 1,
      p.prevent_academic_exclusion ?? 1,
      delta.entity_uuid,
    ]
  );
}
