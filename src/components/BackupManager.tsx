import React, { useState } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

import { MonthlyReconciliationLedger } from './MonthlyReconciliationLedger';

const BackupManager: React.FC = () => {
  const { user, canBackup } = useAuth();
  const [loading, setLoading] = useState<'backup' | 'restore' | 'usb' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeView, setActiveView] = useState<'backups' | 'monthly_ledger'>('backups');

  const handleBackup = async () => {
    setLoading('backup');
    setMessage(null);
    try {
      const success = await db.backup();
      if (success) {
        setMessage({
          type: 'success',
          text: 'Backup created successfully! The file has been saved to your selected folder.',
        });
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, details) VALUES (?, ?, ?, ?, ?)',
          [
            user?.id ?? null,
            user?.username ?? 'System',
            'database_backup',
            'app_settings',
            'Database backup created',
          ]
        );
      } else {
        setMessage({ type: 'error', text: 'Backup failed. Please try again.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred during backup.' });
    } finally {
      setLoading(null);
    }
  };

  const handleRestore = async () => {
    if (
      !confirm(
        'Are you sure you want to restore from a backup? This will replace all current data.'
      )
    ) {
      return;
    }

    setLoading('restore');
    setMessage(null);
    try {
      const success = await db.restore();
      if (success) {
        setMessage({
          type: 'success',
          text: 'Database restored successfully! Please restart the application for changes to take effect.',
        });
      } else {
        setMessage({ type: 'error', text: 'Restore failed or was cancelled.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred during restore.' });
    } finally {
      setLoading(null);
    }
  };

  if (!canBackup) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to access backup and restore tools.</p>
      </div>
    );
  }

  if (activeView === 'monthly_ledger') {
    return <MonthlyReconciliationLedger onClose={() => setActiveView('backups')} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Data Protection & Disaster Recovery</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Ensure your school records are safeguarded against drive failure, theft, and power loss.
          </p>
        </div>

        <button
          onClick={() => setActiveView('monthly_ledger')}
          style={{
            padding: '10px 18px',
            backgroundColor: '#dc2626',
            color: 'white',
            borderRadius: '8px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
          }}
        >
          🖨️ View & Print Monthly Paper Ledger
        </button>
      </div>

      {message && (
        <div
          className={`message-box mb-4 ${message.type === 'success' ? 'message-success' : 'message-error'}`}
        >
          {message.text}
        </div>
      )}

      {/* Disaster Recovery Warning Banner */}
      <div
        style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: '28px' }}>🛡️</div>
        <div>
          <div style={{ fontWeight: 800, color: '#d97706', fontSize: '15px' }}>
            Recommended Offline Disaster Recovery Protocol
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            1. <strong>Weekly USB Backup:</strong> Save a copy of your database to an external flash drive kept in a safe place.
            <br />
            2. <strong>Monthly Hard-Copy Print:</strong> Print the Monthly Disaster Recovery Ledger and store it in your school strongbox.
          </div>
        </div>
      </div>

      <div className="backup-grid">
        {/* USB / Standard Backup Section */}
        <div className="card">
          <div className="backup-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3>Create Flash Drive Backup</h3>
          <p className="backup-description">
            Export your entire database to a USB flash drive or external disk. Contains all students, payments, fee structures, and audit logs.
          </p>
          <ul className="backup-list">
            <li>File format: SQLite database (.db)</li>
            <li>Prompts for USB drive location</li>
            <li>Safe against computer hardware crashes</li>
          </ul>
          <button
            className="btn btn-primary w-full"
            onClick={handleBackup}
            disabled={loading !== null}
          >
            {loading === 'backup' ? 'Exporting Backup...' : '💾 Export Backup to USB / Folder'}
          </button>
        </div>

        {/* Physical Paper Archive Section */}
        <div className="card">
          <div className="backup-icon" style={{ color: '#059669' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </div>
          <h3>Physical Paper Ledger</h3>
          <p className="backup-description">
            Generate an immutable, cryptographically checksummed monthly paper ledger for physical filing in the school safe.
          </p>
          <ul className="backup-list">
            <li>A4 & thermal printer ready</li>
            <li>Itemized payments with receipt IDs</li>
            <li>Bursar & Headteacher sign-off blocks</li>
          </ul>
          <button
            className="btn w-full"
            style={{ backgroundColor: '#059669', color: 'white' }}
            onClick={() => setActiveView('monthly_ledger')}
          >
            📄 Open Monthly Paper Ledger
          </button>
        </div>

        {/* Restore Section */}
        <div className="card">
          <div className="backup-icon" style={{ color: '#dc2626' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <h3>Restore from Backup</h3>
          <p className="backup-description">
            Import a previously created backup file (.db) to restore all school records.
          </p>
          <ul className="backup-list">
            <li>Select a .db backup file from USB</li>
            <li>Replaces existing database on this laptop</li>
            <li>Application restart required after restore</li>
          </ul>
          <button
            className="btn btn-danger w-full"
            onClick={handleRestore}
            disabled={loading !== null}
          >
            {loading === 'restore' ? 'Restoring...' : 'Restore Database from Backup'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="card mt-4">
        <h3 className="mb-2">How Backup Works</h3>
        <div className="instructions-grid">
          <div className="instruction-item">
            <span className="instruction-number">1</span>
            <div>
              <strong>Creating a Backup</strong>
              <p>
                Click &quot;Create Backup&quot; to export your database. A file dialog will appear
                allowing you to choose where to save the backup file. The file will be named with
                the current date and time.
              </p>
            </div>
          </div>
          <div className="instruction-item">
            <span className="instruction-number">2</span>
            <div>
              <strong>Storing Backups</strong>
              <p>
                Store your backup files in a safe location, preferably on an external drive or cloud
                storage. Keep multiple backups from different dates for added security.
              </p>
            </div>
          </div>
          <div className="instruction-item">
            <span className="instruction-number">3</span>
            <div>
              <strong>Restoring Data</strong>
              <p>
                To restore, click &quot;Restore from Backup&quot; and select your backup file. After
                the restore completes, restart the application to see the restored data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupManager;
