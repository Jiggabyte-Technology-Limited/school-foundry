/**
 * Task 6 — Step 1B verification harness.
 *
 * Exercises the PURE part of the Custom Lists feature:
 *
 *   - validateListName           trim, dedup, empty, length guards
 *   - addMember / removeMember   idempotent set ops
 *   - toggleMembership           flips in/out idempotently
 *   - computeEffectiveScope      three-input composition
 *                               (list, search, showInactive),
 *                               with stable sort
 *   - formatListChip             top-bar chip text shape
 *   - describeMembershipDiff     audit-log details payload
 *
 * Run via:  node scratch/verify-task7.mjs
 *
 * Real Oracle SQL for the migration (Step 1A) is also checked by
 * reading src/db/migrations.ts and asserting the v2.1 block contains
 * the required CREATE TABLE + CREATE INDEX statements, so we have
 * belt-and-braces coverage without booting SQLite.
 */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY = path.join(PROJECT_ROOT, 'src/components/student-accounts/custom-list-selectors.ts');
const OUT = path.join(PROJECT_ROOT, 'scratch/.verify-task7.bundle.mjs');

await build({
  entryPoints: [ENTRY],
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: OUT,
  logLevel: 'silent',
});

const m = await import(pathToFileURL(OUT).href + '?v=' + Date.now());
const {
  validateListName,
  addMember,
  removeMember,
  toggleMembership,
  memberCounts,
  computeEffectiveScope,
  formatListChip,
  describeMembershipDiff,
} = m;

const testName = (label) => console.log(`  - ${label}`);
const section = (label) => console.log(`\n-> ${label}\n`);

// ---------------------------------------------------------------------------
// Belt-and-braces migration assertion (no SQLite boot).
// ---------------------------------------------------------------------------
section('0. Migration v2.1 declares the required tables + index');
{
  const migPath = path.join(PROJECT_ROOT, 'src/db/migrations.ts');
  const mig = fs.readFileSync(migPath, 'utf8');

  testName('migration block exists with version 2.1');
  assert.match(mig, /version: '2\.1'/);
  testName('custom_lists table declared with name UNIQUE COLLATE NOCASE');
  assert.match(mig, /CREATE TABLE IF NOT EXISTS custom_lists/);
  assert.match(mig, /name\s+TEXT\s+NOT NULL UNIQUE COLLATE NOCASE/);
  testName('custom_lists has deleted_at column (soft delete)');
  assert.match(mig, /deleted_at\s+TEXT/);
  testName('custom_list_members table declared with composite PK');
  assert.match(mig, /CREATE TABLE IF NOT EXISTS custom_list_members/);
  assert.match(mig, /PRIMARY KEY \(list_id, student_id\)/);
  testName('CASCADE on both sides (list + student)');
  assert.match(mig, /REFERENCES custom_lists\(id\) ON DELETE CASCADE/);
  assert.match(mig, /REFERENCES students\(id\) ON DELETE CASCADE/);
  testName('reverse-lookup index declared');
  assert.match(mig, /CREATE INDEX IF NOT EXISTS idx_custom_list_members_student/);
  testName('schema_version bumped to 2.1');
  assert.match(mig, /'schema_version',\s*'2\.1'/);
}

// ---------------------------------------------------------------------------
// Fixtures.
const lists = [
  { id: 1, name: 'Term 3 owing',     description: null, created_at: '', updated_at: null, deleted_at: null },
  { id: 2, name: 'Class B owing',    description: null, created_at: '', updated_at: null, deleted_at: null },
  { id: 3, name: 'Scholarship list', description: null, created_at: '', updated_at: null, deleted_at: null },
];

const allStudents = [
  { id: 10, full_name: 'Ada Lovelace',    is_active: 1 },
  { id: 11, full_name: 'Alan Turing',     is_active: 1 },
  { id: 12, full_name: 'Grace Hopper',    is_active: 0 }, // inactive
  { id: 13, full_name: 'Linus Torvalds',  is_active: 1 },
  { id: 14, full_name: 'Margaret Hamilton', is_active: 1 },
];

// ---------------------------------------------------------------------------
section('1. validateListName — trim, dedup, empty, length guards');
{
  testName('empty input -> rejected');
  const r1 = validateListName(lists, '');
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /enter a list name/i);

  testName('whitespace-only input -> rejected');
  assert.equal(validateListName(lists, '   ').ok, false);

  testName('non-empty unique name -> ok, trimmed');
  const r2 = validateListName(lists, '   Bursary candidates  ');
  assert.equal(r2.ok, true);
  assert.equal(r2.name, 'Bursary candidates');

  testName('collision (case-insensitive) -> rejected with mention of the existing name');
  const r3 = validateListName(lists, 'class b owing');
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /Class B owing/);

  testName('collision (exact case) -> rejected');
  assert.equal(validateListName(lists, 'Term 3 owing').ok, false);

  testName('>80 chars -> rejected');
  const long = 'x'.repeat(81);
  const r4 = validateListName(lists, long);
  assert.equal(r4.ok, false);
  assert.match(r4.reason, /80 characters/);

  testName('rename path: ignoreId allows the same id to keep its label');
  const r5 = validateListName(lists, 'Term 3 owing', 1);
  assert.equal(r5.ok, true);

  testName('rename path: ignoreId does NOT allow a DIFFERENT id to keep the same label');
  assert.equal(validateListName(lists, 'Term 3 owing', 2).ok, false);
}

// ---------------------------------------------------------------------------
section('2. addMember / removeMember / toggleMembership — idempotent set ops');
{
  testName('addMember: not present -> appended');
  assert.deepEqual(addMember([], 42), [42]);

  testName('addMember: present -> idempotent, no duplicate');
  assert.deepEqual(addMember([42, 7], 42), [42, 7]);

  testName('removeMember: present -> filtered out');
  assert.deepEqual(removeMember([42, 7, 9], 7), [42, 9]);

  testName('removeMember: absent -> idempotent');
  assert.deepEqual(removeMember([42, 7], 99), [42, 7]);

  testName('toggleMembership: present -> remove');
  assert.deepEqual(toggleMembership([42, 7], 42), [7]);

  testName('toggleMembership: absent -> add');
  assert.deepEqual(toggleMembership([42, 7], 99), [42, 7, 99]);

  testName('toggleMembership: round-trip preserves content (sans the toggled id)');
  let m = [];
  for (const id of [1, 2, 3]) m = toggleMembership(m, id);
  assert.deepEqual(m, [1, 2, 3]);
  for (const id of [2, 3]) m = toggleMembership(m, id);
  assert.deepEqual(m, [1]);

  testName('memberCounts returns length');
  assert.equal(memberCounts([1, 2, 3]), 3);
  assert.equal(memberCounts([]), 0);
}

// ---------------------------------------------------------------------------
section('3. computeEffectiveScope — list × search × showInactive composition');
{
  testName('list=null (no list filter) + showInactive=true -> all students');
  const s1 = computeEffectiveScope(allStudents, {
    listMemberIds: null,
    searchQuery: '',
    showInactive: true,
  });
  assert.equal(s1.length, 5);
  testName('list=null + showInactive=false -> excludes is_active=0');
  const s2 = computeEffectiveScope(allStudents, {
    listMemberIds: null,
    searchQuery: '',
    showInactive: false,
  });
  assert.equal(s2.length, 4);
  assert.ok(s2.every(s => (s.is_active ?? 1) === 1));

  testName('list=[10, 14] + no other filter -> only those two');
  const s3 = computeEffectiveScope(allStudents, {
    listMemberIds: [10, 14],
    searchQuery: '',
    showInactive: true,
  });
  assert.deepEqual(s3.map(s => s.id), [10, 14]);

  testName('stable sort: even when list is [14, 10], scope is [10, 14]');
  const s4 = computeEffectiveScope(allStudents, {
    listMemberIds: [14, 10],
    searchQuery: '',
    showInactive: true,
  });
  assert.deepEqual(s4.map(s => s.id), [10, 14]);

  testName('search="ada" -> match by name (case-insensitive)');
  const s5 = computeEffectiveScope(allStudents, {
    listMemberIds: null,
    searchQuery: 'ada',
    showInactive: true,
  });
  assert.deepEqual(s5.map(s => s.id), [10]);

  testName('search="14" -> match by id string');
  const s6 = computeEffectiveScope(allStudents, {
    listMemberIds: null,
    searchQuery: '14',
    showInactive: true,
  });
  assert.deepEqual(s6.map(s => s.id), [14]);

  testName('list AND search AND showInactive compose in that order');
  const s7 = computeEffectiveScope(allStudents, {
    listMemberIds: [10, 11, 12],
    searchQuery: 'a',
    showInactive: false,
  });
  // List members:   10, 11, 12
  // Search "a":     10 (Ada), 11 (Alan)  -> drops 12 (Grace... wait, "Grace" lowercased -> "grace", contains "a")
  //                 Actually "grace" contains "a", so 12 also matches by name.
  // showInactive=false drops 12 anyway.
  // Final: 10 (Ada), 11 (Alan)
  assert.deepEqual(s7.map(s => s.id), [10, 11]);

  testName('all-empty input -> returns the input order, sorted ascending');
  const s8 = computeEffectiveScope(allStudents, {
    listMemberIds: null,
    searchQuery: '   ',
    showInactive: false,
  });
  assert.deepEqual(s8.map(s => s.id), [10, 11, 13, 14]);

  testName('scope is independent of input array order (none mutated)');
  const input = [...allStudents].reverse(); // [14, 13, 12, 11, 10]
  const s9 = computeEffectiveScope(input, {
    listMemberIds: null,
    searchQuery: '',
    showInactive: true,
  });
  assert.deepEqual(s9.map(s => s.id), [10, 11, 12, 13, 14]);
  // input is not mutated
  assert.deepEqual(input.map(s => s.id), [14, 13, 12, 11, 10]);
}

// ---------------------------------------------------------------------------
section('4. formatListChip — top-bar dropdown chip text shape');
{
  testName('short name renders as Name · N');
  assert.equal(formatListChip('Term 3 owing', 4), 'Term 3 owing · 4');

  testName('long name (>24 chars) is truncated with ellipsis');
  const chip = formatListChip('Class B owing reminders Q3 2026', 12);
  assert.ok(chip.length <= 30, `chip should be compact; got "${chip}"`);
  assert.match(chip, /…\s·\s\d+$/);

  testName('zero members renders Name · 0');
  assert.equal(formatListChip('Empty', 0), 'Empty · 0');
}

// ---------------------------------------------------------------------------
section('5. describeMembershipDiff — audit-log details payload');
{
  testName('empty before, two after -> 2 added, 0 removed');
  const d1 = describeMembershipDiff([], [10, 11]);
  assert.deepEqual(d1.added, [10, 11]);
  assert.deepEqual(d1.removed, []);

  testName('two before, empty after -> 0 added, 2 removed');
  const d2 = describeMembershipDiff([10, 11], []);
  assert.deepEqual(d2.added, []);
  assert.deepEqual(d2.removed, [10, 11]);

  testName('mixed before/after -> exact deltas');
  const d3 = describeMembershipDiff([10, 11, 12], [11, 13]);
  assert.deepEqual(d3.added, [13]);
  assert.deepEqual(d3.removed, [10, 12]);

  testName('identical before/after -> both empty');
  const d4 = describeMembershipDiff([1, 2], [1, 2]);
  assert.deepEqual(d4.added, []);
  assert.deepEqual(d4.removed, []);
}

console.log('\n[Manual / Electron-only checks still required]');
console.log('  [ ] Fresh install: app_settings.schema_version bumps to 2.1; custom_lists + custom_list_members tables exist; index is in place.');
console.log('  [ ] Existing install: schema_version WAS <2.1; run app; migration kicks in; existing data preserved.');
console.log('  [ ] UI Step 2: dropdown chip near filters; "Manage lists" opens the builder; create + populate + Save is round-trippable.');
console.log('  [ ] Scope flows through to bulk ZIP/Excel: pick "Term 3 owing" with 3 members -> Produce ZIP -> statements ZIP has exactly 3 PDFs.');
console.log('  [ ] activity_log: SELECT action FROM activity_log WHERE action LIKE "LIST_%" returns one row per mutation.');
