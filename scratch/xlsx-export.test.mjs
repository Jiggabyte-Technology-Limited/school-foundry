import assert from 'node:assert/strict';
import JSZip from 'jszip';

import { buildWorkbookBytes } from '../src/lib/xlsx-export.mjs';

const workbookBytes = await buildWorkbookBytes({
  sheetName: 'Demo Report',
  freezeRows: 1,
  autoFilter: true,
  topRows: [{ value: 'Demo Report', styleId: 1, mergeAcross: 2 }],
  columns: [
    { key: 'name', header: 'Name', width: 24, type: 'text' },
    { key: 'amount', header: 'Amount', width: 14, type: 'currency' },
  ],
  rows: [
    { name: 'Alice', amount: 120.5 },
    { name: 'Bob', amount: 75 },
  ],
  summaryRows: [{ label: 'Total', value: '195.50', valueType: 'string' }],
});

const zip = await JSZip.loadAsync(workbookBytes);
assert.ok(zip.file('[Content_Types].xml'));
assert.ok(zip.file('xl/workbook.xml'));
assert.ok(zip.file('xl/worksheets/sheet1.xml'));

const workbookXml = await zip.file('xl/workbook.xml').async('string');
assert.ok(workbookXml.includes('Demo Report'));

const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
assert.ok(sheetXml.includes('Alice'));
assert.ok(sheetXml.includes('Bob'));
assert.ok(sheetXml.includes('autoFilter'));

console.log('xlsx export helper checks passed');
