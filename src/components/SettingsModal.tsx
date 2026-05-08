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
  const [localSchoolAddress, setLocalSchoolAddress] = useState('');
  const [localSchoolPhone, setLocalSchoolPhone] = useState('');
  const [localSchoolEmail, setLocalSchoolEmail] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [newUser, setNewUser] = useState({ id: null as number | null, full_name: '', username: '', password: '', confirmPassword: '', role: 'user' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'school' | 'users' | 'profile'>(user.role === 'admin' ? 'school' : 'profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePassword, setProfilePassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [editableFullName, setEditableFullName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    loadSettings();
    loadUserProfile();
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const loadUserProfile = async () => {
    const userData = await db.get('SELECT full_name FROM users WHERE id = ?', [user.id]);
    if (userData) {
      setUserFullName(userData.full_name || '');
      setEditableFullName(userData.full_name || '');
    }
  };

  const handleSaveFullName = async () => {
    if (!isAdmin) return;
    setSavingName(true);
    try {
      await db.run('UPDATE users SET full_name = ?, updated_at = datetime("now") WHERE id = ?', [editableFullName, user.id]);
      setUserFullName(editableFullName);
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
        [user.id, user.username, 'profile_update', 'Updated full name']
      );
    } catch (err) {
      alert('Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  const loadSettings = async () => {
    const settings = await db.all("SELECT key, value FROM app_settings WHERE key IN ('school_logo', 'school_address', 'school_phone', 'school_email')");
    settings.forEach(s => {
      if (s.key === 'school_logo') setSchoolLogo(s.value);
      if (s.key === 'school_address') setLocalSchoolAddress(s.value || '');
      if (s.key === 'school_phone') setLocalSchoolPhone(s.value || '');
      if (s.key === 'school_email') setLocalSchoolEmail(s.value || '');
    });
  };

  const loadUsers = async () => {
    const result = await db.all(
      'SELECT id, full_name, username, role, is_active, last_login_at FROM users ORDER BY is_active DESC, full_name ASC'
    );
    setUsers(result);
  };

  const handleSaveSchoolInfo = async () => {
    setSaving(true);
    try {
      await db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_name', ?)", [localSchoolName]);
      await db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_address', ?)", [localSchoolAddress]);
      await db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_phone', ?)", [localSchoolPhone]);
      await db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('school_email', ?)", [localSchoolEmail]);
      
      onSchoolNameUpdate(localSchoolName);
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
        [user.id, user.username, 'settings_update', 'Updated school profile information']
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

  const handleProfilePasswordChange = async () => {
    setProfileMessage(null);
    
    if (!profilePassword || !profileNewPassword || !profileConfirmPassword) {
      setProfileMessage({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }

    if (profileNewPassword !== profileConfirmPassword) {
      setProfileMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (profileNewPassword.length < 4) {
      setProfileMessage({ type: 'error', text: 'Password must be at least 4 characters.' });
      return;
    }

    setProfileSaving(true);
    try {
      const currentUser = await db.get('SELECT password_hash FROM users WHERE id = ?', [user.id]);
      if (!currentUser) {
        setProfileMessage({ type: 'error', text: 'User not found.' });
        return;
      }

      const passwordMatch = bcryptjs.compareSync(profilePassword, currentUser.password_hash);
      if (!passwordMatch) {
        setProfileMessage({ type: 'error', text: 'Current password is incorrect.' });
        return;
      }

      const newHash = bcryptjs.hashSync(profileNewPassword, 10);
      await db.run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [newHash, user.id]);
      
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, details) VALUES (?, ?, ?, ?)',
        [user.id, user.username, 'password_change', 'Changed own password']
      );

      setProfileMessage({ type: 'success', text: 'Password changed successfully!' });
      setProfilePassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'Failed to change password. Please try again.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!newUser.full_name || !newUser.username) {
      alert('Please fill in both Full Name and Username.');
      return;
    }

    if (!newUser.id && !newUser.password) {
      alert('Password is required for new accounts.');
      return;
    }

    if (newUser.password !== newUser.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    setSavingUser(true);
    try {
      if (newUser.id) {
        // Update existing user
        if (newUser.id === user.id && newUser.role !== user.role) {
          alert('You cannot change your own access level.');
          setSavingUser(false);
          return;
        }

        let query = 'UPDATE users SET full_name = ?, username = ?, role = ?, updated_at = datetime(\'now\') WHERE id = ?';
        let params: any[] = [newUser.full_name, newUser.username, newUser.role, newUser.id];

        if (newUser.password) {
          const passwordHash = await bcryptjs.hash(newUser.password, 10);
          query = 'UPDATE users SET full_name = ?, username = ?, role = ?, password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?';
          params = [newUser.full_name, newUser.username, newUser.role, passwordHash, newUser.id];
        }

        await db.run(query, params);
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, user.username, 'user_updated', 'users', newUser.id, `Updated user: ${newUser.full_name} (${newUser.role})`]
        );
      } else {
        // Create new user
        const passwordHash = await bcryptjs.hash(newUser.password, 10);
        const result = await db.run(
          'INSERT INTO users (full_name, username, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
          [newUser.full_name, newUser.username, passwordHash, newUser.role, user.id]
        );

        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, user.username, 'user_created', 'users', result.lastID, `Created user: ${newUser.full_name} (${newUser.role})`]
        );
      }

      setNewUser({ id: null, full_name: '', username: '', password: '', confirmPassword: '', role: 'user' });
      setShowAddUser(false);
      loadUsers();
    } catch (err: any) {
      console.error('Error saving user:', err);
      alert('Failed to save user account. The username might already be in use.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleEditClick = (u: any) => {
    setNewUser({
      id: u.id,
      full_name: u.full_name,
      username: u.username,
      password: '', // Don't show password, only update if provided
      confirmPassword: '',
      role: u.role === 'admin' ? 'admin' : 'user' // Normalize role
    });
    setShowAddUser(true);
  };

  const handleToggleUserStatus = async (userId: number, username: string, currentStatus: number) => {
    if (userId === user.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    
    const action = currentStatus === 1 ? 'deactivate' : 'reactivate';
    
    // Safety check: Don't allow deactivating the last admin
    if (currentStatus === 1) {
      const activeAdmins = users.filter(u => u.role === 'admin' && u.is_active === 1);
      const userToDeactivate = users.find(u => u.id === userId);
      
      if (userToDeactivate?.role === 'admin' && activeAdmins.length <= 1) {
        alert('Cannot deactivate the only remaining active administrator. Please promote another user to Admin first.');
        return;
      }
    }

    if (!confirm(`Are you sure you want to ${action} access for "${username}"?`)) return;

    const newStatus = currentStatus === 1 ? 0 : 1;
    await db.run('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.username, `user_${action}d`, 'users', userId, `${currentStatus === 1 ? 'Deactivated' : 'Reactivated'} user: ${username}`]
    );
    loadUsers();
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (userId === user.id) {
      alert('You cannot delete your own account.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete the user "${username}"? This action cannot be undone.`)) return;

    try {
      await db.run('DELETE FROM users WHERE id = ?', [userId]);
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.username, 'user_deleted', 'users', userId, `Deleted user: ${username}`]
      );
      loadUsers();
    } catch (err) {
      alert('Failed to delete user. They may have related records in the system.');
    }
  };

  const tabs = [
    { id: 'school' as const, label: 'General Info', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { id: 'profile' as const, label: 'My Profile', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )},
    ...(isAdmin ? [{ id: 'users' as const, label: 'User Accounts', icon: (
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
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '1080px', backgroundColor: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Settings</h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Configure your school profile and manage system access.</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.color = 'var(--text-primary)'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
          {/* Sidebar Tabs */}
          <div style={{ width: '220px', backgroundColor: 'var(--background)', borderRight: '1px solid var(--border)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', backgroundColor: 'var(--surface)' }}>
            {/* School Information Tab (Combined) */}
            {activeTab === 'school' && !isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>School Profile</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Contact an administrator to update school information.</p>
                </div>
                <div style={{ backgroundColor: 'var(--background)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>School Name</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{localSchoolName || 'Not set'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Physical Address</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{localSchoolAddress || 'Not set'}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone Number</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{localSchoolPhone || 'Not set'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email Address</div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{localSchoolEmail || 'Not set'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'school' && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '48px' }}>
                  <div style={{ flex: 1, maxWidth: '450px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 24px 0' }}>School Profile</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>School Name</label>
                        <input
                          type="text"
                          style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                          value={localSchoolName}
                          onChange={(e) => setLocalSchoolName(e.target.value)}
                          placeholder="e.g. Green Valley International"
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Physical Address</label>
                        <textarea
                          style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none', minHeight: '80px', resize: 'vertical' }}
                          value={localSchoolAddress}
                          onChange={(e) => setLocalSchoolAddress(e.target.value)}
                          placeholder="Full school address..."
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Phone Number</label>
                          <input
                            type="text"
                            style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                            value={localSchoolPhone}
                            onChange={(e) => setLocalSchoolPhone(e.target.value)}
                            placeholder="+260..."
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Email Address</label>
                          <input
                            type="email"
                            style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                            value={localSchoolEmail}
                            onChange={(e) => setLocalSchoolEmail(e.target.value)}
                            placeholder="admin@school.com"
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: '12px' }}>
                        <button
                          onClick={handleSaveSchoolInfo}
                          disabled={saving}
                          style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}
                        >
                          {saving ? 'Updating Profile...' : 'Save School Profile'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>School Logo</h4>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        style={{ display: 'none' }}
                      />
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)', cursor: 'pointer', minHeight: '160px' }}
                      >
                        {schoolLogo ? (
                          <img src={schoolLogo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '8px' }} />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px' }}>
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>Upload Logo</div>
                          </div>
                        )}
                      </div>
                      {schoolLogo && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                          style={{ width: '100%', marginTop: '12px', padding: '8px', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>

                    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', backgroundColor: 'white' }}>
                      <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Print Header Preview</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                        {schoolLogo ? (
                          <img src={schoolLogo} alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', backgroundColor: '#f3f4f6', borderRadius: '4px' }} />
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{localSchoolName || 'School Name'}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>Financial Statement</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* My Profile Tab */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>My Profile</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, maxWidth: '500px' }}>Change your password and view your account details.</p>
                </div>

                <div style={{ backgroundColor: 'var(--background)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: 700 }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        {isAdmin ? (
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editableFullName}
                              onChange={(e) => setEditableFullName(e.target.value)}
                              disabled={savingName}
                              style={{ flex: 1, padding: '8px 12px', fontSize: '15px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontWeight: 600 }}
                              placeholder="Enter your full name"
                            />
                            <button
                              onClick={handleSaveFullName}
                              disabled={savingName || editableFullName === userFullName}
                              style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: savingName || editableFullName === userFullName ? 'not-allowed' : 'pointer', opacity: savingName || editableFullName === userFullName ? 0.6 : 1 }}
                            >
                              {savingName ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{userFullName || user.username}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>@{user.username}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0' }}>Change Password</h4>
                  
                  {profileMessage && (
                    <div style={{ 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      marginBottom: '16px',
                      backgroundColor: profileMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
                      color: profileMessage.type === 'success' ? '#065f46' : '#991b1b',
                      fontSize: '14px',
                      fontWeight: 500
                    }}>
                      {profileMessage.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Current Password</label>
                      <input
                        type="password"
                        disabled={profileSaving}
                        style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: profileSaving ? 0.7 : 1 }}
                        placeholder="Enter current password"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>New Password</label>
                      <input
                        type="password"
                        disabled={profileSaving}
                        style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: profileSaving ? 0.7 : 1 }}
                        placeholder="Enter new password"
                        value={profileNewPassword}
                        onChange={(e) => setProfileNewPassword(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Confirm New Password</label>
                      <input
                        type="password"
                        disabled={profileSaving}
                        style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: profileSaving ? 0.7 : 1 }}
                        placeholder="Confirm new password"
                        value={profileConfirmPassword}
                        onChange={(e) => setProfileConfirmPassword(e.target.value)}
                      />
                    </div>
                    <button 
                      onClick={handleProfilePasswordChange}
                      disabled={profileSaving}
                      style={{ width: '100%', padding: '14px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '15px', fontWeight: 700, border: 'none', cursor: profileSaving ? 'not-allowed' : 'pointer', opacity: profileSaving ? 0.7 : 1, marginTop: '8px' }}
                    >
                      {profileSaving ? 'Changing Password...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>User Accounts</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, maxWidth: '500px' }}>Manage staff accounts and their access levels within the system.</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (showAddUser && newUser.id) {
                        // If we were editing, just reset and keep open for new user
                        setNewUser({ id: null, full_name: '', username: '', password: '', role: 'user' });
                      } else {
                        // Standard toggle
                        if (showAddUser) setNewUser({ id: null, full_name: '', username: '', password: '', role: 'user' });
                        setShowAddUser(!showAddUser);
                      }
                    }}
                    disabled={savingUser}
                    style={{ padding: '10px 16px', backgroundColor: (showAddUser && !newUser.id) ? 'var(--surface)' : 'var(--primary)', color: (showAddUser && !newUser.id) ? 'var(--text-primary)' : 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: (showAddUser && !newUser.id) ? '1px solid var(--border)' : 'none', cursor: savingUser ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: savingUser ? 0.7 : 1 }}
                  >
                    {(showAddUser && !newUser.id) ? 'Cancel' : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New User
                      </>
                    )}
                  </button>
                </div>
                
                {showAddUser && (
                  <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
                    <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{newUser.id ? 'Edit User' : 'Add New User'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Full Name</label>
                        <input
                          type="text"
                          disabled={savingUser}
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: savingUser ? 0.7 : 1 }}
                          placeholder="John Doe"
                          value={newUser.full_name}
                          onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Username</label>
                        <input
                          type="text"
                          disabled={savingUser}
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: savingUser ? 0.7 : 1 }}
                          placeholder="johndoe"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Password {newUser.id && '(Leave blank to keep current)'}</label>
                        <input
                          type="password"
                          disabled={savingUser}
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: savingUser ? 0.7 : 1 }}
                          placeholder={newUser.id ? "New password (optional)" : "Secure password"}
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Confirm Password</label>
                        <input
                          type="password"
                          disabled={savingUser}
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: savingUser ? 0.7 : 1 }}
                          placeholder="Repeat password"
                          value={newUser.confirmPassword}
                          onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Access Level</label>
                        <select
                          disabled={savingUser}
                          style={{ padding: '12px 14px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', opacity: savingUser ? 0.7 : 1 }}
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '12px' }}>
                      {newUser.id && (
                        <button 
                          onClick={() => {
                            setNewUser({ id: null, full_name: '', username: '', password: '', role: 'user' });
                            setShowAddUser(false);
                          }}
                          disabled={savingUser}
                          style={{ padding: '10px 24px', backgroundColor: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer' }}
                        >
                          Cancel Edit
                        </button>
                      )}
                      <button 
                        onClick={handleSaveUser}
                        disabled={savingUser}
                        style={{ padding: '10px 24px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: savingUser ? 'not-allowed' : 'pointer', opacity: savingUser ? 0.7 : 1 }}
                      >
                        {savingUser ? 'Saving...' : (newUser.id ? 'Update User Account' : 'Create User Account')}
                      </button>
                    </div>
                  </div>
                )}
                
                <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflowX: 'auto', backgroundColor: 'var(--background)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead style={{ backgroundColor: 'var(--surface)' }}>
                      <tr>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Account</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Role</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Status</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Last Login</th>
                        <th style={{ padding: '16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '180px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u.id} style={{ borderBottom: i === users.length - 1 ? 'none' : '1px solid var(--border)', opacity: u.is_active ? 1 : 0.6 }}>
                          <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.full_name || u.username}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>@{u.username}</div>
                              </div>
                              {!u.is_active && (
                                <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '4px', textTransform: 'uppercase' }}>Deactivated</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '9999px', 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              backgroundColor: u.role === 'admin' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                              color: u.role === 'admin' ? 'var(--primary)' : '#10b981',
                              textTransform: 'uppercase'
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '9999px', 
                              fontSize: '11px', 
                              fontWeight: 700,
                              backgroundColor: u.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                              color: u.is_active ? '#10b981' : '#6b7280',
                              textTransform: 'uppercase'
                            }}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => handleEditClick(u)}
                                style={{ padding: '5px 10px', backgroundColor: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Edit
                              </button>
                              {u.id !== user.id ? (
                                <>
                                  <button
                                    onClick={() => handleToggleUserStatus(u.id, u.full_name || u.username, u.is_active)}
                                    style={{ 
                                      padding: '5px 10px', 
                                      backgroundColor: 'transparent', 
                                      color: u.is_active ? '#ef4444' : '#10b981', 
                                      border: `1px solid ${u.is_active ? '#fca5a5' : '#a7f3d0'}`, 
                                      borderRadius: '6px', 
                                      fontSize: '11px', 
                                      fontWeight: 600, 
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap' 
                                    }}
                                  >
                                    {u.is_active ? 'Deactivate' : 'Reactivate'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.full_name || u.username)}
                                    style={{ 
                                      padding: '5px 10px', 
                                      backgroundColor: 'transparent', 
                                      color: '#dc2626', 
                                      border: '1px solid #fca5a5', 
                                      borderRadius: '6px', 
                                      fontSize: '11px', 
                                      fontWeight: 600, 
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap' 
                                    }}
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 8px' }}>YOU</span>
                              )}
                            </div>
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
