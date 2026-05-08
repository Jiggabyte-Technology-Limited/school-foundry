import React, { useState, useEffect, useRef } from 'react';
import bcryptjs from 'bcryptjs';
import { db } from '../lib/db-client';

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

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

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
    if (!confirm(`Are you sure you want to revoke access for "${username}"?`)) return;

    await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.username, 'user_deactivated', 'users', userId, `Deactivated user: ${username}`]
    );
    loadUsers();
  };

  const tabs = [
    { id: 'school' as const, label: 'General Info', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { id: 'print' as const, label: 'Brand & Print', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    )},
    ...(isAdmin ? [{ id: 'users' as const, label: 'Access Control', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )}] : []),
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '850px', backgroundColor: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>System Settings</h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Manage your application configuration and preferences.</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar Tabs */}
          <div style={{ width: '250px', backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
                onMouseOver={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                onMouseOut={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '40px', backgroundColor: 'var(--surface)' }}>
            {/* School Information Tab */}
            {activeTab === 'school' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '500px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>School Identity</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.5 }}>This name appears on all reports, statements, and printed documents across the application.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Official School Name</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="text"
                        style={{ flex: 1, padding: '12px 16px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }}
                        value={localSchoolName}
                        onChange={(e) => setLocalSchoolName(e.target.value)}
                        placeholder="Enter school name"
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                      />
                      <button
                        onClick={handleSaveSchoolName}
                        disabled={saving || localSchoolName === schoolName}
                        style={{ padding: '0 24px', backgroundColor: (saving || localSchoolName === schoolName) ? 'var(--border)' : 'var(--primary)', color: (saving || localSchoolName === schoolName) ? 'var(--text-secondary)' : 'white', borderRadius: '8px', fontSize: '15px', fontWeight: 600, border: 'none', cursor: (saving || localSchoolName === schoolName) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Print Settings Tab */}
            {activeTab === 'print' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>School Logo</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.5 }}>Upload your school logo to display on printed statements and the login screen. Recommended size is at least 200x200 pixels.</p>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.03)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--background)'; }}
                  >
                    {schoolLogo ? (
                      <>
                        <img src={schoolLogo} alt="School Logo" style={{ maxHeight: '100px', objectFit: 'contain', marginBottom: '20px', borderRadius: '8px' }} />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)' }}>Click to upload a new logo</span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Upload Logo</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>PNG, JPG or GIF (max 2MB)</span>
                      </>
                    )}
                  </div>

                  {schoolLogo && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Remove Logo
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Print Preview</h3>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                      {schoolLogo ? (
                        <img src={schoolLogo} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '60px', height: '60px', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700 }}>NO LOGO</span>
                        </div>
                      )}
                      <div>
                        <h4 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>{localSchoolName || 'School Name'}</h4>
                        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px', fontWeight: 600 }}>
                          Financial Statement
                        </p>
                      </div>
                    </div>
                    <div style={{ borderTop: '2px solid var(--primary)', paddingTop: '16px', fontSize: '13px', color: '#6b7280', textAlign: 'center', fontStyle: 'italic' }}>
                      This represents how your school identity appears on printed materials.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* User Management Tab - Admin Only */}
            {activeTab === 'users' && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Access Control</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, maxWidth: '500px', lineHeight: 1.5 }}>Manage staff access to the system. Admins have full access, Bursars handle operations, and Viewers can only view reports.</p>
                  </div>
                  <button 
                    onClick={() => setShowAddUser(!showAddUser)}
                    style={{ padding: '10px 16px', backgroundColor: showAddUser ? 'var(--surface)' : 'var(--primary)', color: showAddUser ? 'var(--text-primary)' : 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: showAddUser ? '1px solid var(--border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                  >
                    {showAddUser ? 'Cancel' : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add User
                      </>
                    )}
                  </button>
                </div>
                
                {showAddUser && (
                  <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
                    <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Create New Account</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Full Name</label>
                        <input
                          type="text"
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                          placeholder="John Doe"
                          value={newUser.full_name}
                          onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Username</label>
                        <input
                          type="text"
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                          placeholder="johndoe"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Password</label>
                        <input
                          type="password"
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                          placeholder="Secure password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Role Level</label>
                        <select
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="bursar">Bursar (Operations)</option>
                          <option value="viewer">Viewer (Read-only)</option>
                          <option value="admin">Admin (Full Access)</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button 
                        onClick={handleAddUser}
                        style={{ padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
                      >
                        Confirm Creation
                      </button>
                    </div>
                  </div>
                )}
                
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--background)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: 'var(--surface)' }}>
                      <tr>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Account</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Role</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>Last Active</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: i === users.length - 1 ? 'none' : '1px solid var(--border)' }}>
                          <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.full_name || u.username}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>@{u.username}</div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ 
                              padding: '6px 12px', 
                              borderRadius: '9999px', 
                              fontSize: '12px', 
                              fontWeight: 600, 
                              backgroundColor: u.role === 'admin' ? 'rgba(249, 115, 22, 0.1)' : u.role === 'bursar' ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface)', 
                              color: u.role === 'admin' ? 'var(--primary)' : u.role === 'bursar' ? '#10b981' : 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              {u.role === 'admin' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                              {u.role === 'bursar' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
                              {u.role === 'viewer' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                              {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            {u.id !== user.id ? (
                              <button
                                onClick={() => handleDeactivateUser(u.id, u.full_name || u.username)}
                                style={{ padding: '6px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                Revoke Access
                              </button>
                            ) : (
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', paddingRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
                                Current User
                              </span>
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
    </div>
  );
};

export default SettingsModal;
