/**
 * Task 5 — Step 1 verification harness.
 *
 * Exercises the PURE part of the new "School Structure" wizard step:
 * the toggle, the custom-grade submit, and the wizard-step validator.
 *
 * Run via:  node scratch/verify-task5.mjs
 *
 * Exit 0 = all assertions pass, non-zero = first failed assertion exits.
 *
 * What this script DOES NOT cover (these need Electron + UI):
 *   - Visual layout of the wizard (palette of 11 checkboxes, chip
 *     styling, "Change grades" button on the fees step).
 *   - Step transitions (welcome -> school -> admin -> periods ->
 *     grades -> fees -> complete) and Back/Next button gating.
 *   - Persisting selectedGrades into the `grades` SQLite table on
 *     wizard completion.
 *
 * Those need a manual run of `npm run dev` and a fresh install path.
 * The pure helpers here cover the *decisions* the wizard makes; their
 * UI surfaces ride on a tested foundation.
 */

import { strict as assert } from 'node:assert';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY = path.join(PROJECT_ROOT, 'src/components/setup-wizard/grade-selectors.ts');
const OUT = path.join(PROJECT_ROOT, 'scratch/.verify-task5.bundle.mjs');

await build({
  entryPoints: [ENTRY],
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: OUT,
  logLevel: 'silent',
});

const gs = await import(pathToFileURL(OUT).href + '?v=' + Date.now());
const { SUGGESTED_GRADES, toggleGrade, applyCustomGrade, validateGradesStep } = gs;

const testName = (label) => console.log(`  - ${label}`);
const section = (label) => console.log(`\n-> ${label}\n`);

// ---------------------------------------------------------------------------
section('1. SUGGESTED_GRADES palette is exactly the 11-option cut');
{
  const expected = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7',
    'Form 1', 'Form 2', 'Form 3', 'Form 4',
  ];
  testName('palette has 11 entries');
  assert.equal(SUGGESTED_GRADES.length, 11, `expected 11, got ${SUGGESTED_GRADES.length}`);
  testName('palette matches the Zimbabwean primary+secondary cut exactly');
  assert.deepEqual(SUGGESTED_GRADES, expected);
  testName('palette contains no Grade 8+ (we excluded them)');
  assert.ok(!SUGGESTED_GRADES.some(g => /^Grade [89]|Grade 1[0-9]/i.test(g)));
  testName('palette contains no Form 5/6 (we excluded them)');
  assert.ok(!SUGGESTED_GRADES.includes('Form 5'));
  assert.ok(!SUGGESTED_GRADES.includes('Form 6'));
}

// ---------------------------------------------------------------------------
section('2. toggleGrade adds when on, removes when off');
{
  testName('toggle on a label not in the list -> appended');
  assert.deepEqual(toggleGrade([], 'Grade 1', true), ['Grade 1']);

  testName('toggle on a label already in the list -> idempotent');
  assert.deepEqual(toggleGrade(['Grade 1', 'Form 2'], 'Grade 1', true), ['Grade 1', 'Form 2']);

  testName('toggle off a label in the list -> removed, preserves order');
  assert.deepEqual(toggleGrade(['Grade 1', 'Form 2', 'Form 3'], 'Form 2', false), ['Grade 1', 'Form 3']);

  testName('toggle off a label NOT in the list -> idempotent');
  assert.deepEqual(toggleGrade(['Grade 1'], 'Form 4', false), ['Grade 1']);

  testName('trim(): toggle ignores surrounding whitespace on input');
  assert.deepEqual(toggleGrade([], '   Form 1   ', true), ['Form 1']);

  testName('trim(): empty / whitespace-only label is a no-op');
  assert.deepEqual(toggleGrade(['Form 1'], '', true), ['Form 1']);
  assert.deepEqual(toggleGrade(['Form 1'], '   ', true), ['Form 1']);
  assert.deepEqual(toggleGrade(['Form 1'], '', false), ['Form 1']);
}

// ---------------------------------------------------------------------------
section('3. applyCustomGrade validates and appends');
{
  testName('valid non-empty, not-yet-present name -> ok with appended list');
  const r1 = applyCustomGrade(['Grade 1'], '  Senior Infants  ');
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.next, ['Grade 1', 'Senior Infants']);

  testName('empty / whitespace-only input -> !ok with reason');
  assert.equal(applyCustomGrade(['Grade 1'], '').ok, false);
  assert.equal(applyCustomGrade(['Grade 1'], '   ').ok, false);

  testName('already-selected name -> !ok with reason mentioning the name');
  const dup = applyCustomGrade(['Grade 1', 'Form 1'], 'Form 1');
  assert.equal(dup.ok, false);
  assert.match(dup.reason, /Form 1/);
}

// ---------------------------------------------------------------------------
section('4. validateGradesStep enforces min 1 + no blanks');
{
  testName('empty list -> error string mentioning "Pick at least one"');
  const e1 = validateGradesStep([]);
  assert.ok(e1, 'expected error for empty list');
  assert.match(e1, /Pick at least one grade/);

  testName('non-empty list of trimmed names -> null (valid)');
  assert.equal(validateGradesStep(['Grade 1', 'Form 1']), null);

  testName('list with a blank string -> error mentioning "blank"');
  const e2 = validateGradesStep(['Grade 1', '   ']);
  assert.ok(e2, 'expected error for blank entry');
  assert.match(e2, /blank/);

  testName('list with a truly empty string -> error mentioning "blank"');
  const e3 = validateGradesStep(['']);
  assert.ok(e3, 'expected error for empty-string entry');
  assert.match(e3, /blank/);
}

// ---------------------------------------------------------------------------
section('5. Realistic flow — wizard-replay scenario');
{
  // Simulates a school owner's first-run: tick Form 1..4 + add "ECD A",
  // then deselect Form 3, then add "Senior Infants", then try to re-add
  // "Form 1" (should be rejected).
  let sel = [];

  for (const g of ['Form 1', 'Form 2', 'Form 3', 'Form 4']) {
    sel = toggleGrade(sel, g, true);
  }
  testName('after ticking Form 1..4 -> list has those 4');
  assert.deepEqual(sel, ['Form 1', 'Form 2', 'Form 3', 'Form 4']);

  sel = toggleGrade(sel, 'Form 3', false);
  testName('after toggling Form 3 off -> only 3 remain, in order');
  assert.deepEqual(sel, ['Form 1', 'Form 2', 'Form 4']);

  const a1 = applyCustomGrade(sel, 'ECD A');
  sel = a1.ok ? a1.next : sel;
  testName('adding custom "ECD A" -> appended at the end');
  assert.deepEqual(sel, ['Form 1', 'Form 2', 'Form 4', 'ECD A']);

  const a2 = applyCustomGrade(sel, 'Senior Infants');
  sel = a2.ok ? a2.next : sel;
  testName('adding custom "Senior Infants" -> appended at the end');
  assert.deepEqual(sel, ['Form 1', 'Form 2', 'Form 4', 'ECD A', 'Senior Infants']);

  const dup = applyCustomGrade(sel, 'Form 1');
  testName('re-adding "Form 1" -> rejected with reason');
  assert.equal(dup.ok, false);
  assert.match(dup.reason, /Form 1/);

  testName('validateGradesStep on the final list passes (returns null)');
  assert.equal(validateGradesStep(sel), null);
}

// ---------------------------------------------------------------------------
section('6. Backwards-compat: app_settings.setup_complete unaffected');
{
  // Pure helpers do not read the DB; the wizard only runs when
  // setup_complete is falsy (audit check, not a runtime assertion).
  testName('nothing in this module touches the DB; safe to import anywhere');
  // If we got here, every helper above survived import and assert.
  assert.ok(typeof toggleGrade === 'function');
  assert.ok(typeof applyCustomGrade === 'function');
  assert.ok(typeof validateGradesStep === 'function');
}

console.log('\n[Manual / Electron-only checks still required]');
console.log('  [ ] Run npm run dev; on a fresh app: wizard now shows "School Structure" as Step 04.');
console.log('  [ ] No pre-selected checkboxes; clicking Next with 0 selected surfaces the validation error.');
console.log('  [ ] Picking suppressions cross-cuts works: tick "Grade 1" + "Form 4", click Next, then the Fees step');
console.log('      shows the read-only summary chip + a "Change grades" button that goes back.');
console.log('  [ ] Persistence: after completing the wizard, SELECT label FROM grades; returns the 2 picked.');
console.log('  [ ] Existing installs with setup_complete=true are not affected (the wizard never runs for them).');
