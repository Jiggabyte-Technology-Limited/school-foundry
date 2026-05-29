/**
 * clear-prod-db.js
 * Deletes the production SchoolFoundry database from AppData before a build
 * so the packaged installer ships clean (no dev/test data).
 *
 * Safe: only removes the schoolfoundry userData folder contents,
 * never touches the Electron dev userData path.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROD_APPDATA_NAME = 'schoolfoundry';

// Resolve the correct AppData path per platform
function getProdUserDataPath() {
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), PROD_APPDATA_NAME);
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', PROD_APPDATA_NAME);
    default:
      return path.join(os.homedir(), '.config', PROD_APPDATA_NAME);
  }
}

const dbPath = path.join(getProdUserDataPath(), 'data.db');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';
const licensePath = path.join(getProdUserDataPath(), 'license.lic');

let cleared = false;

for (const file of [dbPath, walPath, shmPath, licensePath]) {
  if (fs.existsSync(file)) {
    try {
      fs.rmSync(file, { force: true });
      console.log(`[prebuild] Removed: ${file}`);
      cleared = true;
    } catch (err) {
      if (err.code === 'EPERM' || err.code === 'EBUSY') {
        console.error(`\n[prebuild] ❌ Cannot delete: ${file}`);
        console.error('[prebuild]    The database is locked — SchoolFoundry is still running.');
        console.error('[prebuild]    Close the app and try again.\n');
        process.exit(1);
      }
      throw err;
    }
  }
}

if (!cleared) {
  console.log('[prebuild] No production database found — nothing to clear.');
} else {
  console.log('[prebuild] ✅ Production database cleared. Build will produce a clean installer.');
}
