/**
 * Pure helpers for the School Structure admin panel (inside
 * FeeStructureManager.tsx).
 *
 * Companion to src/components/setup-wizard/grade-selectors.ts — that
 * one is for the wizard's add-only "select a starting palette" flow;
 * this one is for the post-setup "manage the grades list" flow, which
 * includes rename, archive, restore, and reorder.
 *
 * These are exercised in scratch/verify-task6.mjs so the logic can
 * be checked without booting Electron. The palette is duplicated here
 * (rather than re-imported) so each pure module is self-contained for
 * the esbuild bundling path used by the verifier.
 */

export interface GradeRow {
  id: number;
  label: string;
  sort_order: number;
  is_active: number; // 0 or 1
}

export type GradeActivityAction =
  | 'GRADE_CREATED'
  | 'GRADE_RENAMED'
  | 'GRADE_ARCHIVED'
  | 'GRADE_RESTORED'
  | 'GRADE_REORDERED';

export interface GradeActivityEntry {
  action: GradeActivityAction;
  details: string;
}

/**
 * Trim, reject empty, and check for collisions against the existing
 * labels. Returns the validated label, or an error.
 */
export function validateGradeName(
  existing: GradeRow[],
  raw: string,
  ignoreId?: number
): { ok: true; label: string } | { ok: false; reason: string } {
  const label = raw.trim();
  if (!label) {
    return { ok: false, reason: 'Please enter a grade name.' };
  }
  const dup = existing.find(g => g.id !== ignoreId && g.label.trim() === label);
  if (dup) {
    return { ok: false, reason: `A grade named "${dup.label}" already exists.` };
  }
  return { ok: true, label };
}

/**
 * Return the next FREE sort_order value (max + 1) so new rows always
 * land at the end of the order.
 */
export function nextSortOrder(grades: GradeRow[]): number {
  if (grades.length === 0) return 0;
  return Math.max(...grades.map(g => g.sort_order)) + 1;
}

/**
 * Compute the new sort_order when "Move up" is pressed on the row at
 * `index`. Returns null if the row is already at the top. Swaps the
 * values with the previous row so reorder is stable.
 */
export function computeMoveUp(
  ordered: GradeRow[],
  index: number
): GradeRow[] | null {
  if (index <= 0 || index >= ordered.length) return null;
  const next = ordered.slice();
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  // Re-number sort_order to mirror the new ordering.
  return next.map((g, i) => ({ ...g, sort_order: i }));
}

export function computeMoveDown(
  ordered: GradeRow[],
  index: number
): GradeRow[] | null {
  if (index < 0 || index >= ordered.length - 1) return null;
  const next = ordered.slice();
  [next[index + 1], next[index]] = [next[index], next[index + 1]];
  return next.map((g, i) => ({ ...g, sort_order: i }));
}

/**
 * Build an activity_log payload for a single grade mutation.
 * `details` is a short human-readable string; never includes DOB or
 * POPIA-sensitive data.
 */
export function buildGradeActivityEntry(
  action: GradeActivityAction,
  grade: GradeRow,
  extra?: Record<string, unknown>
): GradeActivityEntry {
  const parts: string[] = [];
  parts.push(`grade_id=${grade.id}`);
  parts.push(`label=${JSON.stringify(grade.label)}`);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      parts.push(`${k}=${JSON.stringify(v)}`);
    }
  }
  return { action, details: parts.join(' ') };
}

/**
 * Single source of truth for the palette, kept duplicated here so
 * this module is self-contained for the verifier. Update both
 * grade-selectors.ts and this file when adding to the palette.
 */
export const SUGGESTED_GRADES = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Form 1',
  'Form 2',
  'Form 3',
  'Form 4',
];

/**
 * Resolves the user-friendly label for a missing-name case (the
 * School Structure panel surfaces this when the only suggestion is
 * empty after a name collision round-trip).
 */
