#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('========================================');
console.log('  SchoolFoundry App Reset Script');
console.log('========================================\n');

console.log('This will delete ALL data including:\n');
console.log('  - School name, logo, address, phone, email');
console.log('  - All students & guardians');
console.log('  - All payment records & receipts');
console.log('  - All fee structures & academic years');
console.log('  - All user accounts');
console.log('  - All activity logs\n');

// Show where app data is stored
console.log('System info:');
console.log(`  OS: ${os.platform()}`);
console.log(`  APPDATA: ${process.env.APPDATA || 'not set'}`);
console.log(`  LOCALAPPDATA: ${process.env.LOCALAPPDATA || 'not set'}`);
console.log('');

// App data directories (contains data.db + all settings)
const appDataPaths = [
  process.env.APPDATA,
  process.env.LOCALAPPDATA,
  path.join(os.homedir(), 'AppData', 'Roaming'), // Additional common location
].filter(Boolean);

const appFolderNames = ['schoolfoundry', 'FeesFoundry', 'school-fees-manager'];

let deletedAny = false;

console.log('Searching for app data folders...\n');

appDataPaths.forEach(basePath => {
  if (!basePath || !fs.existsSync(basePath)) return;

  appFolderNames.forEach(folderName => {
    const appPath = path.join(basePath, folderName);
    if (fs.existsSync(appPath)) {
      console.log(`Found: ${appPath}`);
      fs.rmSync(appPath, { recursive: true, force: true });
      console.log(`✓ Deleted: ${appPath}\n`);
      deletedAny = true;
    }
  });
});

// Also check for any app folder in common locations
const commonPaths = [
  path.join(os.homedir(), 'AppData', 'Roaming', 'schoolfoundry'),
  path.join(os.homedir(), 'AppData', 'Local', 'schoolfoundry'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'FeesFoundry'),
  path.join(os.homedir(), 'AppData', 'Local', 'FeesFoundry'),
];

commonPaths.forEach(appPath => {
  if (fs.existsSync(appPath)) {
    console.log(`Found: ${appPath}`);
    fs.rmSync(appPath, { recursive: true, force: true });
    console.log(`✓ Deleted: ${appPath}\n`);
    deletedAny = true;
  }
});

if (!deletedAny) {
  console.log('○ No app data folder found');
  console.log('\nTry manually deleting:');
  console.log(`  ${process.env.APPDATA}\\schoolfoundry`);
  console.log(`  ${process.env.LOCALAPPDATA}\\schoolfoundry`);
}

console.log('\n========================================');
console.log('  Reset complete!');
console.log('========================================\n');
console.log('The app will now start fresh with the school setup wizard.\n');
