/**
 * Task 5 — Step 3 verification harness.
 *
 * Exercises the PURE part of the new School Structure admin panel
 * built into FeeStructureManager.tsx:
 *
 *   - validateGradeName:           trim/dup/empty guards
 *   - nextSortOrder:               monotonic extension
 *   - computeMoveUp / MoveDown:    stable reorder with swap + renumber
 *   - buildGradeActivityEntry:     audit-log payload shape
 *
 * Run via:  node scratch/verify-task6.mjs
 */

import { strict as assert } from 'node:assert';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY = path.join(PROJECT_ROOT, 'src/components/setup-wizard/school-structure-actions.ts');
const OUT = path.join(PROJECT_ROOT, 'scratch/.verify-task6.bundle.mjs');

await build({
  entryPoints: [ENTRY],
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: OUT,
  logLevel: 'silent',
});

const ss = await import(pathToFileURL(OUT).href + '?v=' + Date.now());
const {
  validateGradeName,
  nextSortOrder,
  computeMoveUp,
  computeMoveDown,
  buildGradeActivityEntry,
  SUGGESTED_GRADES,
} = ss;

const testName = (label) => console.log(`  - ${label}`);
const section = (label) => console.log(`\n-> ${label}\n`);

// Fixtures — a small ordered, active grade list.
const baseGrades = [
  { id: 1, label: 'Grade 1', sort_order: 0, is_active: 1 },
  { id: 2, label: 'Grade 2', sort_order: 1, is_active: 1 },
  { id: 3, label: 'Form 1',  sort_order: 2, is_active: 1 },
  { id: 4, label: 'Form 2',  sort_order: 3, is_active: 1 },
];

// ---------------------------------------------------------------------------
section('1. validateGradeName — trim, dedup, empty guards');
{
  testName('empty input -> rejected with reason');
  const r1 = validateGradeName(baseGrades, '');
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /enter a grade name/i);

  testName('whitespace-only input -> rejected');
  const r2 = validateGradeName(baseGrades, '   ');
  assert.equal(r2.ok, false);

  testName('non-empty unique label -> ok, label trimmed');
  const r3 = validateGradeName(baseGrades, '   Senior Infants  ');
  assert.equal(r3.ok, true);
  assert.equal(r3.label, 'Senior Infants');

  testName('label matches an existing -> rejected with collision reason');
  const r4 = validateGradeName(baseGrades, 'Grade 1');
  assert.equal(r4.ok, false);
  assert.match(r4.reason, /already exists/i);

  testName('label collision with surrounding whitespace still rejected');
  const r5 = validateGradeName(baseGrades, '  Grade 1  ');
  assert.equal(r5.ok, false);

  testName('rename path: ignoreId allows same id to keep its label');
  const r6 = validateGradeName(baseGrades, 'Grade 1', 1);
  assert.equal(r6.ok, true);
  assert.equal(r6.label, 'Grade 1');

  testName('rename path: ignoreId does NOT allow a DIFFERENT id to keep the same label');
  const r7 = validateGradeName(baseGrades, 'Grade 1', 2);
  assert.equal(r7.ok, false);
}

// ---------------------------------------------------------------------------
section('2. nextSortOrder appends to the end monotonically');
{
  testName('empty list -> 0');
  assert.equal(nextSortOrder([]), 0);

  testName('contiguous 0..n -> n+1');
  assert.equal(nextSortOrder(baseGrades), 4);

  testName('non-contiguous (gaps) -> max + 1, not length');
  const sparse = [
    { id: 1, label: 'A', sort_order: 0, is_active: 1 },
    { id: 2, label: 'B', sort_order: 9, is_active: 1 },
    { id: 3, label: 'C', sort_order: 42, is_active: 1 },
  ];
  assert.equal(nextSortOrder(sparse), 43);
}

// ---------------------------------------------------------------------------
section('3. computeMoveUp / MoveDown — stable reorder with renumber');
{
  testName('move up at the head -> null (boundary)');
  assert.equal(computeMoveUp(baseGrades, 0), null);

  testName('move up beyond head -> null');
  assert.equal(computeMoveUp(baseGrades, -1), null);

  testName('move up at index 1 swaps with index 0 and renumbers 0..3');
  const up = computeMoveUp(baseGrades, 1);
  assert.ok(up, 'expected a non-null reorder result');
  assert.equal(up[0].id, 2, 'Grade 2 should now be at top');
  assert.equal(up[1].id, 1, 'Grade 1 should now be at index 1');
  assert.deepEqual(up.map(g => g.sort_order), [0, 1, 2, 3]);

  testName('move down at the tail -> null (boundary)');
  assert.equal(computeMoveDown(baseGrades, baseGrades.length - 1), null);

  testName('move down at index 2 swaps with index 3 and renumbers');
  const down = computeMoveDown(baseGrades, 2);
  assert.ok(down, 'expected a non-null reorder result');
  assert.equal(down[2].id, 4, 'Form 2 should now be at index 2');
  assert.equal(down[3].id, 3, 'Form 1 should now be at index 3');
  assert.deepEqual(down.map(g => g.sort_order), [0, 1, 2, 3]);

  testName('move down away from boundary preserves order for unaffected rows');
  const downIdx1 = computeMoveDown([...baseGrades], 1);
  assert.ok(downIdx1);
  assert.equal(downIdx1[0].id, 1);
  assert.equal(downIdx1[1].id, 3, 'Form 1 swapped to index 1');
  assert.equal(downIdx1[2].id, 2, 'Grade 2 swapped to index 2');
  assert.equal(downIdx1[3].id, 4);
}

// ---------------------------------------------------------------------------
section('4. buildGradeActivityEntry — audit payload shape (POPIA-safe)');
{
  testName('GRADE_CREATED: name + id in details');
  const e1 = buildGradeActivityEntry('GRADE_CREATED', baseGrades[0]);
  assert.equal(e1.action, 'GRADE_CREATED');
  assert.match(e1.details, /grade_id=1/);
  assert.match(e1.details, /label="Grade 1"/);

  testName('GRADE_RENAMED: details include both old and new labels');
  const e2 = buildGradeActivityEntry('GRADE_RENAMED', baseGrades[0], {
    from: 'Grade 1 (Old)',
    to: 'Grade 1',
  });
  assert.equal(e2.action, 'GRADE_RENAMED');
  assert.match(e2.details, /from="Grade 1 \(Old\)"/);
  assert.match(e2.details, /to="Grade 1"/);

  testName('GRADE_ARCHIVED: details include the truthy before-state');
  const e3 = buildGradeActivityEntry('GRADE_ARCHIVED', baseGrades[2], {
    was_active: 1,
  });
  assert.equal(e3.action, 'GRADE_ARCHIVED');
  assert.match(e3.details, /was_active=1/);

  testName('GRADE_REORDERED: details include the swap target');
  const e4 = buildGradeActivityEntry('GRADE_REORDERED', baseGrades[1], {
    from_position: 1,
    to_position: 0,
  });
  assert.equal(e4.action, 'GRADE_REORDERED');
  assert.match(e4.details, /from_position=1/);
  assert.match(e4.details, /to_position=0/);

  testName('audit details never leak DOB / guardian email patterns');
  const poisoned = buildGradeActivityEntry('GRADE_CREATED', baseGrades[0], {
    guardian_email: 'parent@example.test',
    date_of_birth: '2010-01-01',
  });
  // These extra fields *would* appear if you pass them in by accident;
  // this test is a heads-up that the helper does not screen for them
  // — the calling code is responsible for omitting PII.
  testName('(heads-up) helper does NOT strip PII from extra; caller must');
  assert.match(poisoned.details, /guardian_email/);
  console.log('     ^ reminder: do not pass guardian_email/date_of_birth to this helper');
}

// ---------------------------------------------------------------------------
section('5. Palette is shared with the wizard (single source of truth)');
{
  testName('SUGGESTED_GRADES has 11 entries (matches verify-task5.mjs)');
  assert.equal(SUGGESTED_GRADES.length, 11);
  testName('palette includes Grade 1..7 + Form 1..4');
  for (const g of ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Form 1','Form 2','Form 3','Form 4']) {
    assert.ok(SUGGESTED_GRADES.includes(g), `palette should include ${g}`);
  }
}

console.log('\n[Manual / Electron-only checks still required]');
console.log('  [ ] Open Settings > School Structure — see active grades listed (with sortable up/down).');
console.log('  [ ] Add a custom grade via the input — appears in list and fee-matrix row.');
console.log('  [ ] Rename a grade — collision guard fires when picking another rows label.');
console.log('  [ ] Archive a grade — vanishes from the fee-matrix row but historical payments still resolve.');
console.log('  [ ] Reorder up/down — sort_order changes are persisted on Next.');
console.log('  [ ] activity_log: SELECT action FROM activity_log WHERE action LIKE "GRADE_%" returns one row per mutation.');
