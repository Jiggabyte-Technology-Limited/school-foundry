import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase } from './db/init';
import { setupIpcHandlers } from './db/ipc';
import { checkAndDebitFees } from './lib/auto-debit';
import { setupLicenseIpcHandlers } from './license/ipc';

const GUIDE_SECTION_IDS = [
  'app-tour',
  'add-learner',
  'edit-learner',
  'activate-deactivate',
  'open-account',
  'record-payment',
  'void-payment',
  'statements-export',
  'class-list',
  'school-fees',
  'backup-restore',
  'settings-admin',
  'first-run',
] as const;

function ensureGuideMediaFolders() {
  const root = path.join(app.getPath('userData'), 'guide-media');

  for (const sectionId of GUIDE_SECTION_IDS) {
    fs.mkdirSync(path.join(root, sectionId, 'screenshots'), { recursive: true });
    fs.mkdirSync(path.join(root, sectionId, 'videos'), { recursive: true });
  }
}

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(__dirname, 'img', 'schoolfoundry-icon.ico');
  }

  return path.join(process.cwd(), 'public', 'img', 'schoolfoundry-icon.ico');
}

function createWindow() {
  const isDev = !app.isPackaged;
  const preloadPath = path.join(__dirname, 'preload.js');

  console.log('[Main] Preload Path:', preloadPath);
  console.log('[Main] Dev Mode:', isDev);

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getAppIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      plugins: true,
    },
  });

  win.maximize();

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'index.html'));
  }
}

async function startApp() {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.schoolfoundry.app');
  }
  await initializeDatabase();
  ensureGuideMediaFolders();
  setupIpcHandlers();
  setupLicenseIpcHandlers();
  createWindow();

  // Check for and apply fees for periods that have started (run on startup)
  setTimeout(() => checkAndDebitFees(), 3000);

  // Check every hour for new periods to debit
  setInterval(() => checkAndDebitFees(), 60 * 60 * 1000);
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
