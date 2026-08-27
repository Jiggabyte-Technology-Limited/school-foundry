/**
 * fees/subsidies.ts — Digital Public Good (DPG) & Child Safeguarding Subsidy Engine
 *
 * Handles government Free Education grants, CDF bursaries, NGO sponsorships (UNICEF, CAMFED),
 * and school internal scholarships.
 *
 * Core Principles:
 * 1. Anti-Exclusion Protection: Students on active 100% subsidies or protected grants
 *    are NEVER flagged for academic exclusion, barred from classes, or sent to debt collectors.
 * 2. Transparent Ledger Attribution: Gross tuition is debited as standard, with a verified
 *    "Subsidy / Grant Credit" deduction line item applied so audit trails remain intact.
 */

import { db } from '../db-client';
import type { FeeEntry, DiscountBreakdown } from './balance';

export interface SubsidyProvider {
  id: number;
  name: string;
  provider_type: 'government' | 'ngo' | 'bursary' | 'internal_scholarship' | 'private_donor';
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
}

export interface StudentSubsidy {
  id: number;
  student_id: number;
  provider_id: number;
  provider_name: string;
  provider_type: string;
  year_id: number;
  term_id: number | null;
  term_label?: string | null;
  coverage_type: 'full_100' | 'percentage' | 'fixed_amount';
  coverage_value: number; // 100 for full, % (1-99), or cents for fixed_amount
  application_reason?: string;
  grant_reference_number?: string;
  is_active: boolean;
  prevent_academic_exclusion: boolean;
  created_at: string;
}

/**
 * Fetch all available subsidy / scholarship providers.
 */
export async function getSubsidyProviders(): Promise<SubsidyProvider[]> {
  try {
    const rows = await db.all(
      `SELECT * FROM subsidy_providers ORDER BY provider_type ASC, name ASC`
    );
    return rows as SubsidyProvider[];
  } catch (err) {
    console.error('[Subsidies] Failed to fetch subsidy providers:', err);
    return [];
  }
}

/**
 * Fetch active subsidies for a specific student in a given academic year.
 */
export async function getStudentSubsidies(
  studentId: number,
  yearId: number
): Promise<StudentSubsidy[]> {
  try {
    const rows = await db.all(
      `SELECT ss.*, sp.name as provider_name, sp.provider_type, t.label as term_label
       FROM student_subsidies ss
       JOIN subsidy_providers sp ON ss.provider_id = sp.id
       LEFT JOIN terms t ON ss.term_id = t.id
       WHERE ss.student_id = ? AND ss.year_id = ? AND ss.is_active = 1
       ORDER BY ss.id ASC`,
      [studentId, yearId]
    );

    return rows.map((r: any) => ({
      ...r,
      is_active: Boolean(r.is_active),
      prevent_academic_exclusion: Boolean(r.prevent_academic_exclusion),
    }));
  } catch (err) {
    console.error(`[Subsidies] Error fetching subsidies for student ${studentId}:`, err);
    return [];
  }
}

/**
 * Check if a student is protected from academic exclusion / fee lockouts
 * (e.g. Free Education recipient, OVC bursary, or approved grant recipient).
 */
export async function isStudentProtectedFromExclusion(
  studentId: number,
  yearId: number
): Promise<{ isProtected: boolean; reason?: string; providerName?: string }> {
  try {
    const subsidies = await getStudentSubsidies(studentId, yearId);
    const activeProtection = subsidies.find(
      s => s.prevent_academic_exclusion && (s.coverage_type === 'full_100' || s.coverage_value > 0)
    );

    if (activeProtection) {
      return {
        isProtected: true,
        reason: activeProtection.application_reason || 'Sponsored under Educational Grant / Bursary',
        providerName: activeProtection.provider_name,
      };
    }

    // Also check student table for OVC vulnerability flag
    const student = await db.get(
      `SELECT is_vulnerable_child, ovc_category FROM students WHERE id = ?`,
      [studentId]
    );

    if (student?.is_vulnerable_child) {
      return {
        isProtected: true,
        reason: `Vulnerable Child (OVC ${student.ovc_category || 'Safeguarded'})`,
        providerName: 'Child Safeguarding Protocol',
      };
    }

    return { isProtected: false };
  } catch {
    return { isProtected: false };
  }
}

/**
 * Computes exact subsidy deductions for a student given their debited fee entries.
 * Returns a list of DiscountBreakdown items to seamlessly feed into balance calculations.
 */
export function computeSubsidiesForFees(
  subsidies: StudentSubsidy[],
  fees: FeeEntry[]
): DiscountBreakdown[] {
  const deductions: DiscountBreakdown[] = [];

  for (const sub of subsidies) {
    if (!sub.is_active) continue;

    // Filter fees that apply to this subsidy's term (or all terms if term_id is null)
    const applicableFees = sub.term_id
      ? fees.filter(f => f.term_id === sub.term_id)
      : fees;

    if (applicableFees.length === 0) continue;

    const applicableFeeIds = applicableFees.map(f => f.fee_structure_id);
    const applicableTotalCents = applicableFees.reduce((sum, f) => sum + f.amount_cents, 0);

    let amountCents = 0;
    if (sub.coverage_type === 'full_100') {
      amountCents = applicableTotalCents;
    } else if (sub.coverage_type === 'percentage') {
      amountCents = Math.round((applicableTotalCents * sub.coverage_value) / 100);
    } else if (sub.coverage_type === 'fixed_amount') {
      amountCents = Math.min(applicableTotalCents, sub.coverage_value);
    }

    if (amountCents > 0) {
      deductions.push({
        type: 'subsidy',
        amount_cents: amountCents,
        description: `Sponsored: ${sub.provider_name}${sub.grant_reference_number ? ` (Ref: ${sub.grant_reference_number})` : ''}`,
        applies_to: applicableFeeIds,
      });
    }
  }

  return deductions;
}

/**
 * Assign a new subsidy / grant to a student.
 */
export async function assignStudentSubsidy(subsidy: {
  student_id: number;
  provider_id: number;
  year_id: number;
  term_id?: number | null;
  coverage_type: 'full_100' | 'percentage' | 'fixed_amount';
  coverage_value: number;
  application_reason?: string;
  grant_reference_number?: string;
  prevent_academic_exclusion?: boolean;
  created_by?: number;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const result = await db.run(
      `INSERT OR REPLACE INTO student_subsidies (
        student_id, provider_id, year_id, term_id, coverage_type,
        coverage_value, application_reason, grant_reference_number,
        is_active, prevent_academic_exclusion, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        subsidy.student_id,
        subsidy.provider_id,
        subsidy.year_id,
        subsidy.term_id || null,
        subsidy.coverage_type,
        subsidy.coverage_value,
        subsidy.application_reason || '',
        subsidy.grant_reference_number || '',
        subsidy.prevent_academic_exclusion !== false ? 1 : 0,
        subsidy.created_by || null,
      ]
    );

    return { success: true, id: result.lastID };
  } catch (err: any) {
    console.error('[Subsidies] Failed to assign subsidy:', err);
    return { success: false, error: err.message };
  }
}
