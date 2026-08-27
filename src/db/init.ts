import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { runMigrations } from './migrations';
import schemaSql from './schema.sql?raw';

const dbPath = path.join(app.getPath('userData'), 'data.db');
const db = new sqlite3.Database(dbPath);

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure userData directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const schema = schemaSql;

    db.serialize(() => {
      db.exec(schema, async (err) => {
        if (err) {
          console.error('Error initializing database:', err);
          reject(err);
          return;
        }

        console.log('Database schema initialized successfully.');
        console.log('Database path:', dbPath);

        // Integrity checks
        db.get("PRAGMA integrity_check", (checkErr, row: any) => {
          if (checkErr || row?.integrity_check !== 'ok') {
            console.error('[DB] Integrity check FAILED:', row?.integrity_check || checkErr);
          } else {
            console.log('[DB] Integrity check passed.');
          }
        });

        db.get("PRAGMA foreign_key_check", (fkErr, row: any) => {
          if (fkErr || row) {
            console.error('[DB] Foreign key constraint violation:', row || fkErr);
          } else {
            console.log('[DB] Foreign key check passed.');
          }
        });

        try {
          await runMigrations(db);
          resolve();
        } catch (migrateErr) {
          console.error('Migration error:', migrateErr);
          reject(migrateErr);
        }
      });
    });
  });
}

export { db };
export default db;
