import { ipcMain, dialog } from 'electron';
import db from './init';
import * as fs from 'fs';
import * as path from 'path';

export function setupIpcHandlers() {
  // DB Handlers
  ipcMain.handle('db-query', (_event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error(err);
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
          console.error(err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  });

  ipcMain.handle('db-get', (_event, sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  });

  // File System Handlers
  ipcMain.handle('fs-backup', async () => {
    const dbPath = path.join(process.cwd(), 'school_fees.db');
    const result = await dialog.showSaveDialog({ defaultPath: 'school_fees_backup.db' });
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(dbPath, result.filePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('fs-restore', async () => {
    const dbPath = path.join(process.cwd(), 'school_fees.db');
    const result = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (!result.canceled && result.filePaths.length > 0) {
      fs.copyFileSync(result.filePaths[0], dbPath);
      return true;
    }
    return false;
  });
}
