import React, { useState } from 'react';
import bcryptjs from 'bcryptjs';
import { db } from '../../lib/db-client';
import { useToast } from '../Toast';

interface ResetPasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'reset' | 'recover';

/**
 * License-key-gated admin password reset / recovery.
 *
 * Two modes supported inside one modal:
 *
 *  A) RESET EXISTING ACCOUNT
 *     The license holder knows the username but forgot the password.
 *     We verify the license, hash & write the new password, clear any
 *     lockout state, and audit-log the event.
 *
 *  B) RECOVER / BOOTSTRAP ADMIN
 *     The license holder lost the username entirely (admin left, etc),
 *     or no active admin exists at all. The license key proves
 *     ownership of the install, so we let them:
 *       - Reset an existing admin's password by their username, OR
 *       - Create a brand-new admin (full_name + username + password).
 *
 * Both modes require the license activation key.
 */
const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ onClose, onSuccess }) => {
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>('reset');

  // For mode A (reset)
  const [existingUsername, setExistingUsername] = useState('');

  // For mode B (bootstrap / create new admin)
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [adminAction, setAdminAction] = useState<'reset_existing_admin' | 'create_new_admin'>(
    'reset_existing_admin'
  );
  const [existingAdminUsername, setExistingAdminUsername] = useState('');

  // Shared
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!licenseKey.trim()) {
      setError('Please enter your license activation key to authorize this reset.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (mode === 'reset') {
      if (!existingUsername.trim()) {
        setError('Please enter the username to reset.');
        return;
      }
    } else {
      // recover mode
      if (adminAction === 'create_new_admin') {
        if (!newFullName.trim()) {
          setError('Please enter the new admin\'s full name.');
          return;
        }
        if (!newUsername.trim()) {
          setError('Please enter the new admin\'s username.');
          return;
        }
      } else {
        if (!existingAdminUsername.trim()) {
          setError('Please enter the existing admin\'s username.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // 1) Verify the license key against the offline license validator.
      const licenseResult = await window.api.activateLicense(licenseKey.trim());
      if (!licenseResult || licenseResult.valid !== true) {
        setError(
          licenseResult?.error ||
            'Invalid license key. Please double-check and try again.'
        );
        setIsSubmitting(false);
        return;
      }

      if (mode === 'reset') {
        await runReset(existingUsername.trim());
      } else if (adminAction === 'reset_existing_admin') {
        await runReset(existingAdminUsername.trim());
      } else {
        await runCreateAdmin(newFullName.trim(), newUsername.trim());
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err?.message || 'Password reset failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -- Internal helpers -----------------------------------------------------------------

  async function runReset(username: string) {
    const targetUser = await db.get(
      'SELECT id, username, role FROM users WHERE username = ? COLLATE NOCASE',
      [username]
    );
    if (!targetUser) {
      throw new Error('No user with that username exists on this device.');
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);
    await db.run(
      `UPDATE users SET
         password_hash = ?,
         failed_login_count = 0,
         locked_until = NULL,
         updated_at = datetime('now')
       WHERE id = ?`,
      [passwordHash, targetUser.id]
    );

    await db.run(
      `INSERT INTO activity_log (user_id, username, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        targetUser.id,
        targetUser.username,
        'USER_PASSWORD_RESET',
        'users',
        targetUser.id,
        `Password reset via license key (role: ${targetUser.role})`,
      ]
    );

    showToast(
      'success',
      'Password Reset',
      `Password for ${targetUser.username} has been reset. They can sign in now.`
    );
  }

  async function runCreateAdmin(fullName: string, username: string) {
    // Reject if username already taken.
    const existing = await db.get(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
      [username]
    );
    if (existing) {
      throw new Error(
        `A user with username "${username}" already exists. Switch to "reset existing admin" instead.`
      );
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);
    const result = await db.run(
      `INSERT INTO users (full_name, username, password_hash, role, is_active)
       VALUES (?, ?, ?, 'admin', 1)`,
      [fullName, username, passwordHash]
    );

    const newId = result.lastID ?? result.lastInsertRowid;

    await db.run(
      `INSERT INTO activity_log (user_id, username, action, entity, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newId,
        username,
        'USER_CREATED_VIA_RECOVERY',
        'users',
        newId,
        `Bootstrap admin created via license key recovery (full_name: ${fullName})`,
      ]
    );

    showToast(
      'success',
      'Admin Account Created',
      `New admin "${username}" is ready. They can sign in immediately.`
    );
  }

  // -- Render -------------------------------------------------------------------------

  return (
    <div
      className="modal-overlay"
      onClick={isSubmitting ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        className="card-surface"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          padding: 24,
          backgroundColor: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            className="text-display"
            style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}
          >
            Recover Account Access
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: 'var(--text-secondary)',
              padding: 4,
            }}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: '0 0 16px',
            lineHeight: 1.5,
          }}
        >
          This recovery screen is reserved for license holders. Choose the situation that
          matches yours below.
        </p>

        {/* Mode toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 20,
            backgroundColor: 'var(--secondary)',
            padding: 4,
            borderRadius: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setMode('reset')}
            disabled={isSubmitting}
            style={{
              padding: '10px 8px',
              borderRadius: 8,
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              backgroundColor: mode === 'reset' ? 'var(--surface)' : 'transparent',
              color: mode === 'reset' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              boxShadow:
                mode === 'reset' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            I know the username
          </button>
          <button
            type="button"
            onClick={() => setMode('recover')}
            disabled={isSubmitting}
            style={{
              padding: '10px 8px',
              borderRadius: 8,
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              backgroundColor: mode === 'recover' ? 'var(--surface)' : 'transparent',
              color: mode === 'recover' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              boxShadow:
                mode === 'recover' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Username lost / new admin
          </button>
        </div>

        {error && (
          <div
            className="error-message"
            style={{ marginBottom: 16, padding: 10, borderRadius: 8 }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* MODE A — Reset existing account */}
          {mode === 'reset' && (
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: 'var(--text-secondary)',
                }}
              >
                USERNAME TO RESET
              </label>
              <input
                type="text"
                value={existingUsername}
                onChange={e => setExistingUsername(e.target.value)}
                placeholder="e.g. admin"
                disabled={isSubmitting}
                autoFocus
                required
                style={inputStyle}
              />
            </div>
          )}

          {/* MODE B — Recover (sub-choice: reset an admin's pw OR create new admin) */}
          {mode === 'recover' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: 'var(--text-secondary)',
                  }}
                >
                  WHAT DO YOU NEED?
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAdminAction('reset_existing_admin')}
                    disabled={isSubmitting}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border:
                        adminAction === 'reset_existing_admin'
                          ? '2px solid var(--primary)'
                          : '2px solid var(--border)',
                      backgroundColor:
                        adminAction === 'reset_existing_admin'
                          ? 'rgba(249,115,22,0.06)'
                          : 'transparent',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Reset an admin's password
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminAction('create_new_admin')}
                    disabled={isSubmitting}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border:
                        adminAction === 'create_new_admin'
                          ? '2px solid var(--primary)'
                          : '2px solid var(--border)',
                      backgroundColor:
                        adminAction === 'create_new_admin'
                          ? 'rgba(249,115,22,0.06)'
                          : 'transparent',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Create a new admin
                  </button>
                </div>
              </div>

              {adminAction === 'reset_existing_admin' && (
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    EXISTING ADMIN USERNAME
                  </label>
                  <input
                    type="text"
                    value={existingAdminUsername}
                    onChange={e => setExistingAdminUsername(e.target.value)}
                    placeholder="e.g. admin"
                    disabled={isSubmitting}
                    autoFocus
                    required
                    style={inputStyle}
                  />
                </div>
              )}

              {adminAction === 'create_new_admin' && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 6,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      FULL NAME
                    </label>
                    <input
                      type="text"
                      value={newFullName}
                      onChange={e => setNewFullName(e.target.value)}
                      placeholder="e.g. Patience Moyo"
                      disabled={isSubmitting}
                      autoFocus
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 6,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      NEW ADMIN USERNAME
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      placeholder="e.g. admin"
                      disabled={isSubmitting}
                      required
                      style={inputStyle}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* New password fields (always required) */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--text-secondary)',
              }}
            >
              NEW PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                disabled={isSubmitting}
                required
                style={{ ...inputStyle, paddingRight: 60 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                disabled={isSubmitting}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--text-secondary)',
              }}
            >
              CONFIRM NEW PASSWORD
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              disabled={isSubmitting}
              required
              style={inputStyle}
            />
          </div>

          {/* License key (always required) */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--text-secondary)',
              }}
            >
              LICENSE ACTIVATION KEY
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              disabled={isSubmitting}
              required
              style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
            <p
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                margin: '6px 0 0',
              }}
            >
              Same key you used to activate this app on this computer.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting
                ? 'Working…'
                : mode === 'recover' && adminAction === 'create_new_admin'
                  ? 'Create Admin'
                  : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '2px solid var(--border)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: 'var(--surface)',
};

export default ResetPasswordModal;
