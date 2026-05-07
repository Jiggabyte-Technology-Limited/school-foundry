import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bcryptjs from 'bcryptjs';
import { db } from '../../lib/db-client';
import { useAuth } from '../../lib/auth-context';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const user = await db.get(
        'SELECT id, full_name, username, role, password_hash, is_active, locked_until, failed_login_count FROM users WHERE username = ? COLLATE NOCASE',
        [username]
      );

      // User not found
      if (!user) {
        setError('Invalid credentials');
        setIsLoading(false);
        return;
      }

      // Check if account is deactivated
      if (user.is_active === 0) {
        setError('This account has been deactivated. Contact an administrator.');
        setIsLoading(false);
        return;
      }

      // Check lockout
      if (user.locked_until) {
        const lockUntil = new Date(user.locked_until).getTime();
        if (Date.now() < lockUntil) {
          const minsLeft = Math.ceil((lockUntil - Date.now()) / 60000);
          setError(`Account locked. Try again in ${minsLeft} minute${minsLeft !== 1 ? 's' : ''}.`);
          setIsLoading(false);
          return;
        }
      }

      // Verify password
      const valid = await bcryptjs.compare(password, user.password_hash);

      if (valid) {
        await db.run(
          'UPDATE users SET last_login_at = datetime("now"), failed_login_count = 0, locked_until = NULL WHERE id = ?',
          [user.id]
        );
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, user.username, 'USER_LOGIN', 'users', user.id, 'Successful login']
        );
        login({
          id: user.id,
          full_name: user.full_name || user.username,
          username: user.username,
          role: user.role,
        });
        navigate('/dashboard');
      } else {
        const newCount = (user.failed_login_count || 0) + 1;
        let lockUntil: string | null = null;

        if (newCount >= MAX_FAILED_ATTEMPTS) {
          const lockDate = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
          lockUntil = lockDate.toISOString();
          setError(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
        } else {
          setError(`Invalid credentials. ${MAX_FAILED_ATTEMPTS - newCount} attempt${newCount !== MAX_FAILED_ATTEMPTS - 1 ? 's' : ''} remaining.`);
        }

        await db.run(
          'UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?',
          [newCount, lockUntil, user.id]
        );
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, user.username, 'USER_LOGIN_FAILED', 'users', user.id, `Failed login attempt ${newCount}`]
        );
      }
    } catch (err: any) {
      console.error(err);
      setError('A system error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="layout-wrapper" style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)' }}>
      {/* Decorative elements */}
      <div style={{ position: 'fixed', top: '-50px', right: '-50px', width: '300px', height: '300px', borderRadius: '50%', backgroundColor: 'rgba(249, 115, 22, 0.08)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-100px', left: '-100px', width: '400px', height: '400px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.08)', pointerEvents: 'none' }} />
      
      <div className="centered-card-container">
        <div className="wizard-container" style={{ maxWidth: '450px', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)' }}>
            <div className="wizard-content">
                {/* FeeFocus Branding */}
                <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <svg width="50" height="50" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="#f97316" strokeWidth="2"/>
                        <circle cx="32" cy="32" r="23" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.4"/>
                        <g fill="#f97316">
                            <rect x="20" y="14" width="4.5" height="29" rx="1"/>
                            <rect x="20" y="14" width="13" height="4" rx="1"/>
                            <rect x="20" y="31" width="10" height="3.5" rx="1"/>
                        </g>
                        <circle cx="32" cy="32" r="2" fill="#f97316"/>
                        <line x1="32" y1="26" x2="32" y2="38" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="26" y1="32" x2="38" y2="32" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <div>
                        <h1 className="text-display" style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>FeeFocus</h1>
                        <p className="text-display" style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: 500, letterSpacing: '0.5px' }}>Clear Balances. Clear Records. Clear Future.</p>
                    </div>
                </div>

                {/* Authentication section */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '16px', 
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>
                    <h2 className="text-display" style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>System Access</h2>
                    <p className="text-display" style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>Authenticate to manage your school fees</p>
                </div>

                {error && (
                <div className="error-message mb-4" style={{ textAlign: 'center' }}>
                    {error}
                </div>
                )}

                <form onSubmit={handleLogin} className="wizard-form">
                <div className="wizard-field">
                    <label className="text-display">Username</label>
                    <input 
                    className="text-mono"
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin_user"
                    disabled={isLoading}
                    required
                    />
                </div>
                <div className="wizard-field">
                    <label className="text-display">Password</label>
                    <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    required
                    />
                </div>
                <div style={{ marginTop: '8px' }}>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="btn btn-primary btn-lg w-full"
                    >
                        {isLoading ? 'Authenticating...' : 'Sign In'}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>
                </form>
            </div>
            
            <div style={{ padding: '16px', backgroundColor: 'var(--secondary)', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                    Powered by <span style={{ fontWeight: 600 }}>FeeFocus</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' }}>
                    Developed by <span style={{ fontWeight: 600 }}>Jiggabyte Technology Limited</span>
                    <br />
                    <a href="https://jiggabyte.co.zm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                        jiggabyte.co.zm
                    </a>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
