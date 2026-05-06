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
    <div style={{ padding: '2rem' }}>
      <h1>Backup & Restore</h1>
      <button onClick={handleBackup} style={{ marginRight: '1rem' }}>Backup Database</button>
      <button onClick={handleRestore}>Restore Database</button>
    </div>
  );
};

export default BackupManager;
