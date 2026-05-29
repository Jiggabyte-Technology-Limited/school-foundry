import assert from 'node:assert/strict';
import { buildClassListTitle, generateClassListHtml } from '../src/lib/print-service';

assert.equal(buildClassListTitle('Grade 4', null), 'Grade 4 - All Learners');
assert.equal(buildClassListTitle('Grade 4', 'A'), 'Grade 4 - A');

const html = generateClassListHtml({
  schoolName: 'Northview Primary',
  schoolLogo: 'data:image/png;base64,logo',
  schoolContact: '012 345 6789 | office@example.test',
  title: 'Grade 4 - A',
  academicYear: '2026',
  generatedAt: '2026/05/27',
  students: [
    {
      studentNumber: 'NV-001',
      fullName: 'Amina Dlamini',
      gender: 'Female',
    },
  ],
});

assert.match(html, /Northview Primary/);
assert.match(html, /School Logo/);
assert.match(html, /Class List: Grade 4 - A/);
assert.match(html, /Academic Year: 2026/);
assert.match(html, /Generated: 2026\/05\/27/);
assert.match(html, /012 345 6789 \| office@example.test/);
assert.match(html, /NV-001/);
assert.match(html, /Amina Dlamini/);
assert.match(html, /Total Learners: 1/);
assert.match(html, /<!DOCTYPE html>/);

console.log('class-list print template assertions passed');
