import { ipcMain, dialog, app, shell, BrowserWindow } from 'electron';
import db from './init';
import * as fs from 'fs';
import * as path from 'path';

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'data.db');
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
  ipcMain.handle('print-to-pdf', async (_event, options: { html: string; filename: string; title: string }) => {
    try {
      const printDir = path.join(app.getPath('userData'), 'print-output');
      
      // Create print-output directory if it doesn't exist
      if (!fs.existsSync(printDir)) {
        fs.mkdirSync(printDir, { recursive: true });
      }

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const safeFilename = `${timestamp}_${options.filename.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      const filePath = path.join(printDir, safeFilename);

      // Create a hidden browser window to render HTML and generate PDF
      const pdfWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // Load HTML content
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

      // Write PDF to file
      fs.writeFileSync(filePath, pdfData);

      // Close the hidden window
      pdfWindow.close();

      return { success: true, filePath };
    } catch (err) {
      console.error('[IPC] print-to-pdf error:', err);
      return { success: false, error: String(err) };
    }
  });

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
}
