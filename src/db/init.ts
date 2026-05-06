import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'school_fees.db');
const db = new sqlite3.Database(dbPath);

export function initializeDatabase() {
  const pathsToTry = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'src', 'db', 'schema.sql'),
    path.join(process.cwd(), 'dist', 'db', 'schema.sql'),
  ];
  
  let actualSchemaPath = '';
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      actualSchemaPath = p;
      break;
    }
  }

  if (!actualSchemaPath) {
    console.error('Could not find schema.sql in any of:', pathsToTry);
    return;
  }
  
  const schema = fs.readFileSync(actualSchemaPath, 'utf8');
  db.serialize(() => {
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error initializing database:', err);
      } else {
        console.log('Database initialized successfully.');
      }
    });
  });
}

export default db;
