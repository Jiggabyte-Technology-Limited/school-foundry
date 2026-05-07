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
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Left Side - Orange Visual Section */}
      <div style={{ 
        flex: 1, 
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '40px'
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '20%', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }} />
        
        {/* Floating elements */}
        <div style={{ position: 'absolute', top: '20%', right: '30%', width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(255,255,255,0.15)', transform: 'rotate(15deg)' }} />
        <div style={{ position: 'absolute', bottom: '30%', left: '15%', width: '120px', height: '120px', borderRadius: '30px', background: 'rgba(255,255,255,0.1)', transform: 'rotate(-10deg)' }} />
        
        {/* Main visual content */}
        <div style={{ textAlign: 'center', color: 'white', zIndex: 1, maxWidth: '400px' }}>
          <svg width="100" height="100" viewBox="0 0 64 64" fill="none" style={{ marginBottom: '24px' }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="2"/>
            <circle cx="32" cy="32" r="23" fill="none" stroke="white" strokeWidth="1" opacity="0.4"/>
            <g fill="white">
              <rect x="20" y="14" width="4.5" height="29" rx="1"/>
              <rect x="20" y="14" width="13" height="4" rx="1"/>
              <rect x="20" y="31" width="10" height="3.5" rx="1"/>
            </g>
            <circle cx="32" cy="32" r="2" fill="white"/>
            <line x1="32" y1="26" x2="32" y2="38" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="26" y1="32" x2="38" y2="32" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <h1 style={{ fontSize: '48px', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>FeeFocus</h1>
          <p style={{ fontSize: '18px', marginTop: '16px', opacity: 0.9, fontWeight: 500 }}>Clear Balances.<br/>Clear Records.<br/>Clear Future.</p>
          
          <div style={{ marginTop: '48px', display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800 }}>100%</div>
              <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>Secure</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800 }}>24/7</div>
              <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>Access</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800 }}>Free</div>
              <div style={{ fontSize: '12px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>Updates</div>
            </div>
          </div>
        </div>
        
        {/* Footer on orange side */}
        <div style={{ position: 'absolute', bottom: '24px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', textAlign: 'center' }}>
          Developed by <strong>Jiggabyte Technology Limited</strong>
        </div>
      </div>

      {/* Right Side - White Login Section */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: 'white',
        padding: '40px'
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Login header */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Welcome Back</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>Sign in to manage your school fees</p>
          </div>

          {error && (
            <div className="error-message mb-4" style={{ textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>USERNAME</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                required
                style={{ 
                  width: '100%', 
                  padding: '14px 16px', 
                  borderRadius: '10px', 
                  border: '2px solid var(--border)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>PASSWORD</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                required
                style={{ 
                  width: '100%', 
                  padding: '14px 16px', 
                  borderRadius: '10px', 
                  border: '2px solid var(--border)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '10px', 
                border: 'none',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)'
              }}
              onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: '48px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Powered by <span style={{ fontWeight: 600, color: 'var(--primary)' }}>FeeFocus</span>
          </div>
        </div>
      </div>
    </div>
  );
};
