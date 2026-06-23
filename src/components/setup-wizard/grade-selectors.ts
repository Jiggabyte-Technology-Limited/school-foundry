/**
 * Pure helpers for the SetupWizard's grade-selection step and the
 * future School Structure admin page.
 *
 * These were pulled out of `src/components/SetupWizard.tsx` so we can
 * exercise them with `node scratch/verify-task5.mjs` without booting
 * Electron + React.
 */

const SUGGESTED_GRADES = [
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
 * Add a label to the selection if `isOn`, otherwise remove it.
 * Always trims the label; rejects empty strings.
 * Idempotent: turning on an already-on label is a no-op, and turning
 * off a label that is not present is a no-op.
 */
export function toggleGrade(selected: string[], label: string, isOn: boolean): string[] {
  const trimmed = label.trim();
  if (!trimmed) return selected;
  if (isOn) {
    return selected.includes(trimmed) ? selected : [...selected, trimmed];
  }
  return selected.includes(trimmed) ? selected.filter(g => g !== trimmed) : selected;
}

/**
 * Validate a candidate custom grade. Returns `{ ok: true }` if the
 * label is acceptable, `{ ok: false, reason }` otherwise.
 */
export function validateCustomGrade(
  selected: string[],
  raw: string
): { ok: true } | { ok: false; reason: string } {
  const v = raw.trim();
  if (!v) {
    return { ok: false, reason: 'Please enter a grade name.' };
  }
  if (selected.includes(v)) {
    return { ok: false, reason: `"${v}" is already selected.` };
  }
  return { ok: true };
}

/**
 * Apply a custom-grade submission: validate, append, return new list.
 * Returns either the new list or null along with a reason.
 */
export function applyCustomGrade(
  selected: string[],
  raw: string
): { ok: true; next: string[] } | { ok: false; reason: string } {
  const v = validateCustomGrade(selected, raw);
  if (!v.ok) return v;
  const trimmed = raw.trim();
  return { ok: true, next: [...selected, trimmed] };
}

/**
 * Wizard-level validation for the entire "grades" step. The wizard's
 * "next" button calls this; if it returns a string, that's the error
 * shown to the user.
 */
export function validateGradesStep(selected: string[]): string | null {
  if (selected.length === 0) {
    return 'Pick at least one grade. You can change this later in Settings > School Structure.';
  }
  for (const grade of selected) {
    if (!grade.trim()) {
      return 'One of the selected grades is blank. Remove it or pick a real grade name.';
    }
  }
  return null;
}

export { SUGGESTED_GRADES };
