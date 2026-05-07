import React, { useState, useEffect, useRef } from 'react';
import bcryptjs from 'bcryptjs';
import { db } from '../lib/db-client';
import HelpTooltip from './HelpTooltip';

interface SettingsModalProps {
  user: { id: number; username: string; role: string };
  schoolName: string;
  onSchoolNameUpdate: (name: string) => void;
  onClose: () => void;
  onLogoUpdate?: (logo: string | null) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  schoolName,
  onSchoolNameUpdate,
  onClose,
  onLogoUpdate,
}) => {
  const [localSchoolName, setLocalSchoolName] = useState(schoolName);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', username: '', password: '', role: 'bursar' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'school' | 'users' | 'print'>('school');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    loadSettings();
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const loadSettings = async () => {
    const logoSetting = await db.get("SELECT value FROM app_settings WHERE key = 'school_logo'");
    if (logoSetting?.value) {
      setSchoolLogo(logoSetting.value);
    }
  };

  const loadUsers = async () => {
    const result = await db.all(
      'SELECT id, full_name, username, role, is_active, last_login_at FROM users WHERE is_active = 1 ORDER BY id'
    );
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setSchoolLogo(base64);
      
      await db.run(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_logo', ?)",
        [base64]
      );
      
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
        [user.id, user.username, 'settings_update', 'Updated school logo']
      );

      onLogoUpdate?.(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setSchoolLogo(null);
    await db.run("DELETE FROM app_settings WHERE key = 'school_logo'");
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
      [user.id, user.username, 'settings_update', 'Removed school logo']
    );
    onLogoUpdate?.(null);
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.full_name) return;

    const passwordHash = await bcryptjs.hash(newUser.password, 10);
    const result = await db.run(
      'INSERT INTO users (full_name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
      [newUser.full_name, newUser.username, passwordHash, newUser.role, user.id]
    );

    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.username, 'user_created', 'users', result.lastID, `Created user: ${newUser.full_name} (${newUser.role})`]
    );

    setNewUser({ full_name: '', username: '', password: '', role: 'bursar' });
    setShowAddUser(false);
    loadUsers();
  };

  const handleDeactivateUser = async (userId: number, username: string) => {
    if (userId === user.id) return;
    if (!confirm(`Are you sure you want to deactivate user "${username}"?`)) return;

    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.username, 'user_deactivated', 'users', userId, `Deactivated user: ${username}`]
    );
    loadUsers();
  };

  const tabs = [
    { id: 'school' as const, label: 'School Info', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { id: 'print' as const, label: 'Print Settings', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    )},
    ...(isAdmin ? [{ id: 'users' as const, label: 'Users', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )}] : []),
  ];

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
        
        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          padding: '0 20px', 
          borderBottom: '1px solid var(--color-sage-border)',
          backgroundColor: 'var(--color-sage-cream)'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.id ? 600 : 500,
                color: activeTab === tab.id ? 'var(--color-accent-teal)' : 'var(--color-olive-ink)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-teal)' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {/* School Information Tab */}
          {activeTab === 'school' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="flex-row gap-2 mb-2" style={{ alignItems: 'flex-start' }}>
                  <label className="settings-label" style={{ margin: 0 }}>School Name</label>
                  <HelpTooltip text="This name appears on all reports, statements, and printed documents." />
                </div>
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
              </div>
            </div>
          )}

          {/* Print Settings Tab */}
          {activeTab === 'print' && (
            <div className="settings-section">
              <div className="settings-card">
                <div className="flex-row gap-2 mb-2" style={{ alignItems: 'flex-start' }}>
                  <label className="settings-label" style={{ margin: 0 }}>School Logo</label>
                  <HelpTooltip text="Upload your school logo to display on printed statements and reports. Recommended size: 200x200 pixels." />
                </div>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                <div 
                  className={`logo-upload-area ${schoolLogo ? 'has-logo' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {schoolLogo ? (
                    <>
                      <img src={schoolLogo} alt="School Logo" className="logo-preview" />
                      <p className="logo-upload-text">Click to change logo</p>
                    </>
                  ) : (
                    <>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-sage-placeholder)" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p className="logo-upload-text">Click to upload your school logo</p>
                      <p className="logo-upload-hint">PNG, JPG or GIF (max 2MB)</p>
                    </>
                  )}
                </div>

                {schoolLogo && (
                  <button 
                    className="btn btn-danger" 
                    onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                    style={{ marginTop: 12 }}
                  >
                    Remove Logo
                  </button>
                )}

                <div style={{ marginTop: 24 }}>
                  <h4 style={{ marginBottom: 12 }}>Print Preview</h4>
                  <div style={{ 
                    border: '1px solid var(--color-sage-border)', 
                    borderRadius: 'var(--border-radius-md)',
                    padding: 20,
                    backgroundColor: 'white'
                  }}>
                    <div className="print-header">
                      {schoolLogo && (
                        <img src={schoolLogo} alt="Logo" className="print-logo" />
                      )}
                      <div className="print-school-info">
                        <h3 style={{ margin: 0, fontSize: 18 }}>{localSchoolName || 'School Name'}</h3>
                        <p style={{ margin: '4px 0 0', color: 'var(--color-sage-placeholder)', fontSize: 12 }}>
                          Financial Statement
                        </p>
                      </div>
                    </div>
                    <div style={{ 
                      borderTop: '2px solid var(--primary)',
 
                      paddingTop: 12,
                      fontSize: 13,
                      color: 'var(--color-sage-placeholder)',
                      textAlign: 'center'
                    }}>
                      This is how your statements will appear when printed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Management Tab - Admin Only */}
          {activeTab === 'users' && isAdmin && (
            <div className="settings-section">
              <div className="flex-between mb-2">
                <div className="flex-row gap-2" style={{ alignItems: 'center' }}>
                  <h3 className="settings-section-title" style={{ margin: 0 }}>User Management</h3>
                  <HelpTooltip text="Manage who can access the system. Admins have full access, Bursars can record payments and manage students, Viewers can only view reports." />
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddUser(!showAddUser)}>
                  {showAddUser ? 'Cancel' : '+ Add User'}
                </button>
              </div>
              
              {showAddUser && (
                <div className="settings-card mb-2" style={{ backgroundColor: 'var(--color-accent-teal-light)', borderColor: 'var(--color-accent-teal)' }}>
                  <h4 style={{ marginBottom: 16, color: 'var(--color-accent-teal)' }}>New User</h4>
                  <div className="flex-col gap-4">
                    <div className="flex-row gap-4" style={{ flexWrap: 'wrap' }}>
                      <div className="flex-col flex-1" style={{ minWidth: 150 }}>
                        <label className="settings-label">Full Name</label>
                        <input
                          type="text"
                          className="input-default"
                          placeholder="Enter full name"
                          value={newUser.full_name}
                          onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                        />
                      </div>
                      <div className="flex-col flex-1" style={{ minWidth: 150 }}>
                        <label className="settings-label">Username</label>
                        <input
                          type="text"
                          className="input-default"
                          placeholder="Enter username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        />
                      </div>
                      <div className="flex-col flex-1" style={{ minWidth: 150 }}>
                        <label className="settings-label">Password</label>
                        <input
                          type="password"
                          className="input-default"
                          placeholder="Enter password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                      </div>
                      <div className="flex-col" style={{ minWidth: 140 }}>
                        <label className="settings-label">Role</label>
                        <select
                          className="input-default"
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="bursar">Bursar</option>
                          <option value="viewer">Viewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn btn-success" onClick={handleAddUser}>
                        Create User
                      </button>
                    </div>
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
                        <td className="td-bold">{u.full_name || u.username}</td>
                        <td>
                          <span className={`status-badge ${u.role === 'admin' ? 'status-active' : u.role === 'bursar' ? 'status-paid' : 'status-pending'}`}>
                            {u.role === 'admin' ? 'Admin' : u.role === 'bursar' ? 'Bursar' : 'Viewer'}
                          </span>
                        </td>
                        <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                        <td>
                          {u.id !== user.id ? (
                            <button
                              className="btn btn-danger"
                              onClick={() => handleDeactivateUser(u.id, u.full_name || u.username)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-sage-placeholder)', fontSize: '13px' }}>You</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
