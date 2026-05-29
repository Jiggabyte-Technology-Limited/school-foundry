import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

import {
  getDangerZoneConfirmationPhrase,
  getClearDatabaseTargets,
  getResetAppTargets,
} from '../src/lib/app-maintenance.mjs';

const userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolfoundry-maintenance-'));
const dbPath = path.join(userDataRoot, 'data.db');
const licensePath = path.join(userDataRoot, 'license.lic');
const printDir = path.join(userDataRoot, 'print-output');
fs.mkdirSync(printDir, { recursive: true });
fs.writeFileSync(dbPath, 'db');
fs.writeFileSync(licensePath, 'license');
fs.writeFileSync(path.join(printDir, 'sample.txt'), 'print');

assert.equal(getDangerZoneConfirmationPhrase('clear-database'), 'CLEAR DATABASE');
assert.equal(getDangerZoneConfirmationPhrase('reset-app'), 'RESET APP');

const clearTargets = getClearDatabaseTargets(userDataRoot);
assert.deepEqual(clearTargets, [dbPath]);

const resetTargets = getResetAppTargets(userDataRoot);
assert.deepEqual(resetTargets.sort(), [dbPath, licensePath, printDir].sort());

console.log('app maintenance helper checks passed');
