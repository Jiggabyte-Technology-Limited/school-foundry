import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

interface SettingsModalProps {
  user: { id: number; username: string; role: string };
  schoolName: string;
  onSchoolNameUpdate: (name: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  schoolName,
  onSchoolNameUpdate,
  onClose,
}) => {
  const [localSchoolName, setLocalSchoolName] = useState(schoolName);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'bursar' });
  const [showAddUser, setShowAddUser] = useState(false);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    const result = await db.all('SELECT id, username, role, last_login_at FROM users ORDER BY id');
    setUsers(result);
  };

  const handleSaveSchoolName = async () => {
    setSaving(true);
    try {
      await db.run(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_name', ?)",
        [localSchoolName]
      );
      onSchoolNameUpdate(localSchoolName);
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
        [user.id, user.username, 'settings_update', `Updated school name to: ${localSchoolName}`]
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    
    // Simple hash for demo - in production use proper hashing
    const passwordHash = btoa(newUser.password);
    
    await db.run(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [newUser.username, passwordHash, newUser.role]
    );
    
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.username, 'user_created', `Created user: ${newUser.username} (${newUser.role})`]
    );
    
    setNewUser({ username: '', password: '', role: 'bursar' });
    setShowAddUser(false);
    loadUsers();
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (userId === user.id) return;
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    
    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.username, 'user_deleted', `Deleted user: ${username}`]
    );
    loadUsers();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div className="modal-body">
          {/* School Information */}
          <div className="settings-section">
            <h3 className="settings-section-title">School Information</h3>
            <div className="settings-card">
              <label className="settings-label">School Name</label>
              <div className="flex-row gap-2">
                <input
                  type="text"
                  className="input-default flex-1"
                  value={localSchoolName}
                  onChange={(e) => setLocalSchoolName(e.target.value)}
                  placeholder="Enter school name"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSchoolName}
                  disabled={saving || localSchoolName === schoolName}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <p className="settings-hint">This name will appear on all printed statements and reports.</p>
            </div>
          </div>

          {/* User Management - Admin Only */}
          {isAdmin && (
            <div className="settings-section">
              <div className="flex-between mb-2">
                <h3 className="settings-section-title" style={{ margin: 0 }}>User Management</h3>
                <button className="btn btn-sage" onClick={() => setShowAddUser(!showAddUser)}>
                  {showAddUser ? 'Cancel' : '+ Add User'}
                </button>
              </div>
              
              {showAddUser && (
                <div className="settings-card mb-2">
                  <div className="flex-row gap-2 mb-2">
                    <input
                      type="text"
                      className="input-default"
                      placeholder="Username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    />
                    <input
                      type="password"
                      className="input-default"
                      placeholder="Password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                    <select
                      className="input-default"
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    >
                      <option value="bursar">Bursar</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleAddUser}>Add</button>
                  </div>
                </div>
              )}
              
              <div className="settings-card">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Last Login</th>
                      <th style={{ width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="td-bold">{u.username}</td>
                        <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                        <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                        <td>
                          {u.id !== user.id ? (
                            <button
                              className="btn btn-danger"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                            >
                              Delete
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-sage-placeholder)', fontSize: '13px' }}>Current</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="settings-section">
            <h3 className="settings-section-title" style={{ color: '#dc2626' }}>Danger Zone</h3>
            <div className="settings-card" style={{ borderColor: '#fecaca' }}>
              <p className="settings-hint" style={{ marginBottom: '1rem' }}>
                Resetting settings will restore default application settings. This cannot be undone.
              </p>
              <button className="btn btn-danger">Reset All Settings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
