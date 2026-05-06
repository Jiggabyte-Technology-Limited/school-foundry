import React, { useState } from 'react';
import { db } from '../lib/db-client';

const SetupWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [schoolName, setSchoolName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleSetup = async () => {
    // 1. Save school info
    await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['school_name', schoolName]);

    // 2. Create admin
    await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [adminUsername, adminPassword, 'admin']);

    onComplete();
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Initial Setup</h1>
      <input placeholder="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
      <input placeholder="Admin Username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} />
      <input type="password" placeholder="Admin Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
      <button onClick={handleSetup}>Complete Setup</button>
    </div>
  );
};

export default SetupWizard;
