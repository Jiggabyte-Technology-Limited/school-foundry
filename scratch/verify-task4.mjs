/**
 * Task 4 verification harness (executable).
 *
 * Exercises the PURE parts of the print pipeline - the buildPrintableGuideHtml
 * renderer shared by both the on-screen guide and the printed/saved PDF.
 *
 * Uses esbuild to transpile the TS source on the fly to ESM, so we don't need
 * a separate build step or ts-node config.
 *
 * Run via:  node scratch/verify-task4.mjs
 *
 * Exit code 0 on success, non-zero on first failed assertion.
 */

import { strict as assert } from 'node:assert';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY = path.join(PROJECT_ROOT, 'src/lib/print/user-guide.ts');
const OUT = path.join(PROJECT_ROOT, 'scratch/.verify-task4.bundle.mjs');

// Transpile user-guide.ts to ESM in scratch/. Isolates the bundled JS and
// avoids polluting src/ with generated files.
await build({
  entryPoints: [ENTRY],
  bundle: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: OUT,
  logLevel: 'silent',
});

const ug = await import(pathToFileURL(OUT).href + '?v=' + Date.now());
const { buildPrintableGuideHtml } = ug;

const testName = (label) => console.log(`  - ${label}`);
const section = (label) => console.log(`\n-> ${label}\n`);

// HTML entity helpers - because the editor/patch tool strips these characters.
const amp = String.fromCharCode(38);
const ampLt = amp + 'lt;';
const ampGt = amp + 'gt;';
const ampQuot = amp + 'quot;';
const ampApos = amp + '#39;';

const fixtures = [
  {
    id: 'getting-started',
    group: 'Getting Started',
    title: 'Set up your school',
    audience: 'Admin only',
    summary: 'Open Setup Wizard and fill in the school details.',
    before: ['Open the app'],
    steps: ['Click Settings', 'Enter the school name'],
    after: ['Settings persist locally'],
    tips: ['Use the Enter key to advance'],
    warnings: ['Pick a name you intend to keep'],
  },
  {
    id: 'learners',
    group: 'Learners',
    title: 'Add a new student',
    audience: 'All users',
    summary: 'Capture the learner demographics and link them to a grade.',
    before: ['Have a signed admission form ready'],
    steps: ['Open Learners', 'Click New'],
    after: ['Student appears in the active list'],
    tips: ['Date of birth is required to compute age'],
  },
];

const groupTitles = {
  'Getting Started': 'Getting Started',
  Learners: 'Learners',
  Payments: 'Payments',
  Reports: 'Reports',
  Admin: 'Admin',
};

// ---------------------------------------------------------------------------
section('1. School name in cover reflects the live DB value');
{
  const html = buildPrintableGuideHtml({
    schoolName: 'Northview Primary',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('cover <h2> contains the school name');
  // The school name we passed in appears inside an h2
  assert.match(html, new RegExp(`<h2>Northview Primary<\\/h2>`));
  testName('<title> reflects the school name');
  assert.match(html, new RegExp(`<title>SchoolFoundry User Guide &mdash; Northview Primary<\\/title>`));
  testName('NO hardcoded "SchoolFoundry" used as the school name in cover');
  assert.ok(!new RegExp(`<h2>SchoolFoundry<\\/h2>`).test(html));
}

// ---------------------------------------------------------------------------
section('2. School-name-change flow (settings update + DB restore)');
{
  const beforeHtml = buildPrintableGuideHtml({
    schoolName: 'Hillside Academy',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('first print shows Hillside Academy');
  assert.match(beforeHtml, new RegExp(`<h2>Hillside Academy<\\/h2>`));

  const afterRestoreHtml = buildPrintableGuideHtml({
    schoolName: 'Hillside Academy (Restored)',
    generatedAt: '2026-05-28',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('post-restore print reflects the imported school name');
  assert.match(afterRestoreHtml, new RegExp(`<h2>Hillside Academy \\(Restored\\)<\\/h2>`));
  testName('no lingering plain "Hillside Academy" remains in cover');
  // After restore the cover <h2> must contain the restored name; a plain old
  // Academy-only h2 should not exist.
  assert.ok(!new RegExp(`<h2>Hillside Academy<\\/h2>`).test(afterRestoreHtml));
}

// ---------------------------------------------------------------------------
section('3. Empty/whitespace school name falls back to "SchoolFoundry"');
{
  const emptyHtml = buildPrintableGuideHtml({
    schoolName: '',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('empty name -> cover renders "SchoolFoundry" as neutral default');
  assert.match(emptyHtml, new RegExp(`<h2>SchoolFoundry<\\/h2>`));
  testName('empty name -> <title> uses the default');
  assert.match(emptyHtml, new RegExp(`<title>SchoolFoundry User Guide &mdash; SchoolFoundry<\\/title>`));

  const whitespaceHtml = buildPrintableGuideHtml({
    schoolName: '   ',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('whitespace-only name also falls back to "SchoolFoundry"');
  assert.match(whitespaceHtml, new RegExp(`<h2>SchoolFoundry<\\/h2>`));
}

// ---------------------------------------------------------------------------
section('4. HTML escaping prevents school-name XSS');
{
  // Use a name containing < > " ' & to exercise every escaped char.
  const evilName =
    String.fromCharCode(60) + 'script>alert(1)' + String.fromCharCode(60) + '/script>Acme' +
    String.fromCharCode(60) + '/script>';
  const html = buildPrintableGuideHtml({
    schoolName: evilName,
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('no raw <script>alert(1)</script> reaches the output');
  assert.ok(!new RegExp(`<script>alert\\(1\\)<\\/script>`).test(html), 'malicious content should be escaped');

  testName('escaped form (<script>...) is present in the cover <h2>');
  const coverIdx = html.indexOf('<h1>SchoolFoundry User Guide</h1>');
  assert.ok(coverIdx > 0, 'cover <h1> should be present');
  const h2Idx = html.indexOf('<h2>', coverIdx);
  const h2End = html.indexOf('</h2>', h2Idx);
  assert.ok(h2Idx > 0 && h2End > h2Idx, 'cover <h2> should be present');
  const coverH2 = html.substring(h2Idx, h2End + 5);
  assert.match(
    coverH2,
    new RegExp(ampLt + 'script' + ampGt + 'alert\\(1\\)' + ampLt + '/script' + ampGt),
    'cover <h2> must contain HTML-escaped form'
  );
}

// ---------------------------------------------------------------------------
section('5. Sections render in group order with admin/normal badges');
{
  const html = buildPrintableGuideHtml({
    schoolName: 'Northview Primary',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  const gsIdx = html.indexOf('<h2>Getting Started</h2>');
  const learnersIdx = html.indexOf('<h2>Learners</h2>');
  testName('Getting Started group appears before Learners group');
  assert.ok(gsIdx >= 0 && learnersIdx >= 0 && gsIdx < learnersIdx);

  testName('Admin only badge renders for admin sections');
  assert.match(html, /Admin only/);
  testName('All users badge renders for non-admin sections');
  assert.match(html, /All users/);

  testName('warnings block renders when provided');
  assert.match(html, /Important warnings/);
  assert.match(html, /Pick a name you intend to keep/);
}

// ---------------------------------------------------------------------------
section('6. printOnly flag suppresses the on-screen helper blocks');
{
  const onScreenHtml = buildPrintableGuideHtml({
    schoolName: 'Northview Primary',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: false,
  });
  const printHtml = buildPrintableGuideHtml({
    schoolName: 'Northview Primary',
    generatedAt: '2026-05-27',
    sections: fixtures,
    groupTitles,
    printOnly: true,
  });
  testName('on-screen variant includes "Screenshots and video" hint');
  assert.match(onScreenHtml, /Screenshots and video/);
  testName('print variant strips the hint');
  assert.ok(!/Screenshots and video/.test(printHtml));
}

// ---------------------------------------------------------------------------
section('All Task 4 pure-pipeline assertions passed');

console.log('\n[Manual / Electron-only checks still required]');
console.log('  [ ] Click "Print / Save PDF" in the User Guide -> PDF appears in print output dir');
console.log('  [ ] Settings -> School Details -> change name -> click print again -> new name in PDF');
console.log('  [ ] fsRestore (DB import) -> click print -> imported school name appears in next PDF');
console.log('  [ ] Set school_name to NULL -> click print -> fallback toast fires AND guide still prints');
console.log('  [ ] Filename uses slug derived from school name (lowercase, dashes)');
