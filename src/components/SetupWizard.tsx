import React, { useState } from 'react';
import { db } from '../lib/db-client';

const SetupWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [schoolName, setSchoolName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    if (!schoolName || !adminUsername || !adminPassword) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Save school info
      await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['school_name', schoolName]);

      // 2. Create admin
      await db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [adminUsername, adminPassword, 'admin']);

      onComplete();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card login-card">
      <h1>Initial Setup</h1>
      {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '14px' }}>{error}</p>}
      <div className="flex-col gap-4 mb-4">
        <input className="input-default" placeholder="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} disabled={isLoading} />
        <input className="input-default" placeholder="Admin Username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} disabled={isLoading} />
        <input className="input-default" type="password" placeholder="Admin Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} disabled={isLoading} />
      </div>
      <button 
        className="btn btn-primary w-full" 
        onClick={handleSetup} 
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Complete Setup'}
      </button>
    </div>
  );
};

export default SetupWizard;
