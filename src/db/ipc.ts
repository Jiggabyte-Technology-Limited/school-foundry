import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron';
import db from './init';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { checkAndDebitFees } from '../lib/auto-debit';
import {
  getClearDatabaseTargets,
  getResetAppTargets,
} from '../lib/app-maintenance.mjs';
import { buildWorkbookBytes } from '../lib/xlsx-export.mjs';
import { pathToFileURL } from 'url';

let userGuideWindow: BrowserWindow | null = null;

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

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg']);

function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function removeTarget(targetPath: string) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

async function wipeUserData(targetPaths: string[]) {
  await closeDatabase();
  targetPaths.forEach(removeTarget);
}

function scheduleAppRestart() {
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 250);
}

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(__dirname, 'img', 'schoolfoundry-icon.ico');
  }

  return path.join(process.cwd(), 'public', 'img', 'schoolfoundry-icon.ico');
}

function openUserGuideWindow() {
  const isDev = !app.isPackaged;
  const preloadPath = path.join(__dirname, 'preload.js');
  ensureGuideMediaFolders(app.getPath('userData'));

  if (userGuideWindow && !userGuideWindow.isDestroyed()) {
    userGuideWindow.show();
    userGuideWindow.focus();
    return;
  }

  userGuideWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    title: 'SchoolFoundry User Guide',
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      plugins: true,
    },
  });

  userGuideWindow.on('closed', () => {
    userGuideWindow = null;
  });

  if (isDev) {
    userGuideWindow.loadURL('http://localhost:5173/?window=user-guide');
  } else {
    userGuideWindow.loadFile(path.join(__dirname, 'index.html'), {
      search: '?window=user-guide',
    });
  }
}

async function saveWorkbookToDisk(options: {
  suggestedFileName: string;
  workbook: {
    sheetName: string;
    topRows?: Array<{ value: string; styleId?: number; mergeAcross?: number }>;
    columns: Array<{ key: string; header: string; width?: number; type?: string }>;
    rows: Array<Record<string, any>>;
    summaryRows?: Array<{
      label: string;
      value: string | number;
      valueType?: string;
      valueStyleId?: number;
    }>;
    freezeRows?: number;
    autoFilter?: boolean;
  };
}) {
  const result = await dialog.showSaveDialog({
    defaultPath: options.suggestedFileName.endsWith('.xlsx')
      ? options.suggestedFileName
      : `${options.suggestedFileName}.xlsx`,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  const bytes = await buildWorkbookBytes({
    sheetName: options.workbook.sheetName,
    topRows: options.workbook.topRows,
    columns: options.workbook.columns,
    rows: options.workbook.rows,
    summaryRows: options.workbook.summaryRows,
    freezeRows: options.workbook.freezeRows,
    autoFilter: options.workbook.autoFilter,
  });

  fs.writeFileSync(result.filePath, Buffer.from(bytes));
  return { success: true, filePath: result.filePath };
}

async function saveWorkbookZipToDisk(options: {
  suggestedFileName: string;
  statements: Array<{
    filename: string;
    workbook: {
      sheetName: string;
      topRows?: Array<{ value: string; styleId?: number; mergeAcross?: number }>;
      columns: Array<{ key: string; header: string; width?: number; type?: string }>;
      rows: Array<Record<string, any>>;
      summaryRows?: Array<{
        label: string;
        value: string | number;
        valueType?: string;
        valueStyleId?: number;
      }>;
      freezeRows?: number;
      autoFilter?: boolean;
    };
  }>;
}) {
  const result = await dialog.showSaveDialog({
    defaultPath: options.suggestedFileName.endsWith('.zip')
      ? options.suggestedFileName
      : `${options.suggestedFileName}.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  const zip = new JSZip();
  for (const statement of options.statements) {
    const bytes = await buildWorkbookBytes({
      sheetName: statement.workbook.sheetName,
      topRows: statement.workbook.topRows,
      columns: statement.workbook.columns,
      rows: statement.workbook.rows,
      summaryRows: statement.workbook.summaryRows,
      freezeRows: statement.workbook.freezeRows,
      autoFilter: statement.workbook.autoFilter,
    });
    zip.file(
      statement.filename.endsWith('.xlsx') ? statement.filename : `${statement.filename}.xlsx`,
      Buffer.from(bytes)
    );
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(result.filePath, zipBuffer);
  return { success: true, filePath: result.filePath };
}

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'data.db');
}

function getGuideMediaRoot(userDataPath: string) {
  return path.join(userDataPath, 'guide-media');
}

function ensureGuideMediaFolders(userDataPath: string) {
  const root = getGuideMediaRoot(userDataPath);

  for (const sectionId of GUIDE_SECTION_IDS) {
    fs.mkdirSync(path.join(root, sectionId, 'screenshots'), { recursive: true });
    fs.mkdirSync(path.join(root, sectionId, 'videos'), { recursive: true });
  }

  return root;
}

function listMediaFiles(directory: string, extensions: Set<string>) {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .map(fileName => {
      const fullPath = path.join(directory, fileName);
      const extension = path.extname(fileName).toLowerCase();
      const stats = fs.statSync(fullPath);

      if (!stats.isFile() || !extensions.has(extension)) {
        return null;
      }

      return {
        fileName,
        fileUrl: pathToFileURL(fullPath).toString(),
      };
    })
    .filter((item): item is { fileName: string; fileUrl: string } => item !== null)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function getGuideMediaLibrary(userDataPath: string) {
  const rootPath = ensureGuideMediaFolders(userDataPath);

  return {
    rootPath,
    sections: GUIDE_SECTION_IDS.map(sectionId => {
      const sectionRoot = path.join(rootPath, sectionId);
      return {
        id: sectionId,
        screenshots: listMediaFiles(path.join(sectionRoot, 'screenshots'), IMAGE_EXTENSIONS),
        videos: listMediaFiles(path.join(sectionRoot, 'videos'), VIDEO_EXTENSIONS),
      };
    }),
  };
}

export function setupIpcHandlers() {
  // DB Handlers
  ipcMain.handle('db-query', (_event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('[IPC] db-query error:', err.message, '\nSQL:', sql, '\nParams:', params);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  });

  ipcMain.handle('db-run', (_event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          console.error('[IPC] db-run error:', err.message, '\nSQL:', sql, '\nParams:', params);
          reject(err);
        } else {
          // Return both lastID (sqlite3) and lastInsertRowid (better-sqlite3 compat) so
          // callers using either property name will work during transition.
          resolve({
            lastID: this.lastID,
            lastInsertRowid: this.lastID,
            changes: this.changes,
          });
        }
      });
    });
  });

  ipcMain.handle('db-get', (_event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          console.error('[IPC] db-get error:', err.message, '\nSQL:', sql, '\nParams:', params);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  });

  // File System Handlers
  ipcMain.handle('fs-backup', async () => {
    const dbPath = getDbPath();
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const result = await dialog.showSaveDialog({
      defaultPath: `SchoolFees_Backup_${timestamp}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(dbPath, result.filePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('fs-restore', async () => {
    const dbPath = getDbPath();
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      fs.copyFileSync(result.filePaths[0], dbPath);
      return true;
    }
    return false;
  });

  // PDF Print Handlers
  ipcMain.handle(
    'print-to-pdf',
    async (_event, options: { html: string; filename: string; title: string }) => {
      let pdfWindow = null;
      try {
        console.log('[IPC] print-to-pdf called with:', {
          filename: options.filename,
          title: options.title,
        });

        const printDir = path.join(app.getPath('userData'), 'print-output');

        // Create print-output directory if it doesn't exist
        if (!fs.existsSync(printDir)) {
          fs.mkdirSync(printDir, { recursive: true });
        }

        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const safeFilename = `${timestamp}_${options.filename.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const filePath = path.join(printDir, safeFilename);
        console.log('[IPC] Output path:', filePath);

        // Create a hidden browser window to render HTML and generate PDF
        pdfWindow = new BrowserWindow({
          width: 800,
          height: 600,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // Load HTML content
        const htmlLength = options.html.length;
        console.log('[IPC] HTML content length:', htmlLength);
        await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);

        // Generate PDF
        const pdfData = await pdfWindow.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4',
          margins: {
            marginType: 'custom',
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4,
          },
        });

        console.log('[IPC] PDF generated, size:', pdfData.length);

        // Write PDF to file
        fs.writeFileSync(filePath, pdfData);
        console.log('[IPC] PDF written to file');

        // Close the hidden window
        pdfWindow.close();
        pdfWindow = null;

        return { success: true, filePath };
      } catch (err) {
        console.error('[IPC] print-to-pdf error:', err);
        if (pdfWindow) {
          try {
            pdfWindow.close();
          } catch (e) {
            /* ignore */
          }
        }
        return { success: false, error: String(err) };
      }
    }
  );

  ipcMain.handle('open-file-for-print', async (_event, filePath: string) => {
    try {
      // Open file with default application (PDF viewer typically has print option)
      await shell.openPath(filePath);
      return { success: true };
    } catch (err) {
      console.error('[IPC] open-file-for-print error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('get-print-output-dir', () => {
    return path.join(app.getPath('userData'), 'print-output');
  });

  ipcMain.handle(
    'print-statements-to-zip',
    async (_event, options: { statements: { html: string; filename: string }[] }) => {
      let pdfWindow = null;
      try {
        const printDir = path.join(app.getPath('userData'), 'print-output');
        if (!fs.existsSync(printDir)) {
          fs.mkdirSync(printDir, { recursive: true });
        }

        const pdfFiles: { name: string; data: Buffer }[] = [];

        for (const stmt of options.statements) {
          pdfWindow = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
            },
          });

          await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(stmt.html)}`);

          const pdfData = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
              marginType: 'custom',
              top: 0.4,
              bottom: 0.4,
              left: 0.4,
              right: 0.4,
            },
          });

          pdfFiles.push({
            name: `${stmt.filename}.pdf`,
            data: Buffer.from(pdfData),
          });

          pdfWindow.close();
          pdfWindow = null;
        }

        const zip = new JSZip();
        for (const file of pdfFiles) {
          zip.file(file.name, file.data);
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const result = await dialog.showSaveDialog({
          defaultPath: `Student_Statements_${timestamp}.zip`,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
        });

        if (!result.canceled && result.filePath) {
          fs.writeFileSync(result.filePath, zipBuffer);
          return { success: true, filePath: result.filePath };
        }

        return { success: false, canceled: true };
      } catch (err) {
        console.error('[IPC] print-statements-to-zip error:', err);
        if (pdfWindow) {
          try {
            pdfWindow.close();
          } catch (e) {
            /* ignore */
          }
        }
        return { success: false, error: String(err) };
      }
    }
  );

  ipcMain.handle(
    'export-xlsx-statements-to-zip',
    async (
      _event,
      options: {
        suggestedFileName: string;
        statements: Array<{
          filename: string;
          workbook: {
            sheetName: string;
            topRows?: Array<{ value: string; styleId?: number; mergeAcross?: number }>;
            columns: Array<{ key: string; header: string; width?: number; type?: string }>;
            rows: Array<Record<string, any>>;
            summaryRows?: Array<{
              label: string;
              value: string | number;
              valueType?: string;
              valueStyleId?: number;
            }>;
            freezeRows?: number;
            autoFilter?: boolean;
          };
        }>;
      }
    ) => {
      try {
        return await saveWorkbookZipToDisk(options);
      } catch (err) {
        console.error('[IPC] export-xlsx-statements-to-zip error:', err);
        return { success: false, error: String(err) };
      }
    }
  );

  ipcMain.handle('open-user-guide-window', async () => {
    try {
      openUserGuideWindow();
      return { success: true };
    } catch (err) {
      console.error('[IPC] open-user-guide-window error:', err);
      return { success: false, error: String(err) };
    }
  });

  // Auto-debit fees handler
  ipcMain.handle('auto-debit-fees', async () => {
    try {
      await checkAndDebitFees();
      return { success: true };
    } catch (err) {
      console.error('[IPC] auto-debit-fees error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('clear-database', async () => {
    try {
      await wipeUserData(getClearDatabaseTargets(app.getPath('userData')));
      scheduleAppRestart();
      return { success: true };
    } catch (err) {
      console.error('[IPC] clear-database error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('reset-app', async () => {
    try {
      await wipeUserData(getResetAppTargets(app.getPath('userData')));
      scheduleAppRestart();
      return { success: true };
    } catch (err) {
      console.error('[IPC] reset-app error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('export-xlsx-report', async (_event, options) => {
    try {
      return await saveWorkbookToDisk(options);
    } catch (err) {
      console.error('[IPC] export-xlsx-report error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('get-guide-media-library', async () => {
    try {
      return { success: true, ...getGuideMediaLibrary(app.getPath('userData')) };
    } catch (err) {
      console.error('[IPC] get-guide-media-library error:', err);
      return { success: false, error: String(err) };
    }
  });
}
