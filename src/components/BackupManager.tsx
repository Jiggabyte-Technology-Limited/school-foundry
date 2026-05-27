import React, { useState } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

const BackupManager: React.FC = () => {
  const { user, canBackup } = useAuth();
  const [loading, setLoading] = useState<'backup' | 'restore' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBackup = async () => {
    setLoading('backup');
    setMessage(null);
    try {
      const success = await db.backup();
      if (success) {
        setMessage({
          type: 'success',
          text: 'Backup created successfully! The file has been saved to your documents folder.',
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

  return (
    <div>
      <h2 className="mb-4">Backup & Restore</h2>

      {message && (
        <div
          className={`message-box mb-4 ${message.type === 'success' ? 'message-success' : 'message-error'}`}
        >
          {message.text}
        </div>
      )}

      <div className="backup-grid">
        {/* Backup Section */}
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
          <h3>Create Backup</h3>
          <p className="backup-description">
            Export your entire database to a secure backup file. This includes all learners,
            payments, fee structures, and settings.
          </p>
          <ul className="backup-list">
            <li>Backup file is saved to your documents folder</li>
            <li>File format: SQLite database (.db)</li>
            <li>Recommended: Create weekly backups</li>
          </ul>
          <button
            className="btn btn-primary w-full"
            onClick={handleBackup}
            disabled={loading !== null}
          >
            {loading === 'backup' ? 'Creating Backup...' : 'Create Backup'}
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
            Import a previously created backup file. This will replace all current data with the
            data from the backup.
          </p>
          <ul className="backup-list">
            <li>Select a .db backup file when prompted</li>
            <li>All current data will be overwritten</li>
            <li>Application restart required after restore</li>
          </ul>
          <button
            className="btn btn-danger w-full"
            onClick={handleRestore}
            disabled={loading !== null}
          >
            {loading === 'restore' ? 'Restoring...' : 'Restore from Backup'}
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
