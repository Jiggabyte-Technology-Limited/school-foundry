import { app, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { initializeDatabase } from './db/init';
import { setupIpcHandlers } from './db/ipc';
import { checkAndDebitFees } from './lib/auto-debit';
import { setupSyncIpcHandlers } from './sync/sync-ipc';

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

let isQuitting = false;

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

  win.on('close', async e => {
    if (isQuitting) return;

    e.preventDefault();

    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['💾 Save USB Backup & Exit', 'Exit Without Backup', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'School Foundry — Data Protection Backup',
      message: 'Protect Your School Database Before Exiting',
      detail:
        'Keeping regular offline backups on a USB flash drive ensures your school records are safe against hardware theft or drive failure.\n\nWould you like to save a backup to a USB drive now?',
    });

    if (choice === 2) {
      // User cancelled exit
      return;
    }

    if (choice === 0) {
      // Save USB backup
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const defaultFilename = `SchoolFoundry_USB_Backup_${timestamp}.db`;
      const saveResult = await dialog.showSaveDialog(win, {
        title: 'Save School Foundry Backup to USB / External Storage',
        defaultPath: defaultFilename,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });

      if (!saveResult.canceled && saveResult.filePath) {
        try {
          const dbPath = path.join(app.getPath('userData'), 'feesfoundry.db');
          if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, saveResult.filePath);
            dialog.showMessageBoxSync(win, {
              type: 'info',
              buttons: ['OK'],
              title: 'Backup Successful',
              message: 'Backup Saved Successfully!',
              detail: `Your database has been safely saved to:\n${saveResult.filePath}`,
            });
          }
        } catch (err) {
          console.error('[Main] USB Backup error on exit:', err);
        }
      }
    }

    isQuitting = true;
    win.destroy();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

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
  setupSyncIpcHandlers();
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

