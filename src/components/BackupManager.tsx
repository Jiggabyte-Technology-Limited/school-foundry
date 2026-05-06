import React from 'react';
import { db } from '../lib/db-client';

const BackupManager = () => {
  const handleBackup = async () => {
    const success = await db.backup();
    if (success) alert('Backup successful!');
  };

  const handleRestore = async () => {
    const success = await db.restore();
    if (success) alert('Restore successful! Please restart the application.');
  };

  return (
    <div>
      <h1 className="mb-4">Backup & Restore</h1>
      <div className="card login-card" style={{ maxWidth: '500px' }}>
        <p className="mb-4">Create a secure backup of your school's database, or restore from a previous backup file.</p>
        <div className="flex-row gap-4">
          <button className="btn btn-primary flex-1" onClick={handleBackup}>Backup Database</button>
          <button className="btn btn-danger flex-1" onClick={handleRestore}>Restore Database</button>
        </div>
      </div>
    </div>
  );
};

export default BackupManager;
