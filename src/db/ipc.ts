import { ipcMain, dialog, app } from 'electron';
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
}
