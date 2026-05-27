import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bcryptjs from 'bcryptjs';
import { db } from '../../lib/db-client';
import { useAuth } from '../../lib/auth-context';
import SphereCanvas from '../SphereCanvas';
import { FeatureCards } from '../FeatureCards';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('SchoolFoundry');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchSchoolDetails = async () => {
      try {
        const nameRes = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
        if (nameRes && nameRes.value) {
          setSchoolName(nameRes.value);
        }
        const logoRes = await db.get("SELECT value FROM app_settings WHERE key = 'school_logo'");
        if (logoRes && logoRes.value) {
          setSchoolLogo(logoRes.value);
        }
      } catch (err) {
        console.error('Failed to fetch school details', err);
      }
    };
    fetchSchoolDetails();
  }, []);

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
          setError(
            `Invalid credentials. ${MAX_FAILED_ATTEMPTS - newCount} attempt${newCount !== MAX_FAILED_ATTEMPTS - 1 ? 's' : ''} remaining.`
          );
        }

        await db.run('UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?', [
          newCount,
          lockUntil,
          user.id,
        ]);
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [
            user.id,
            user.username,
            'USER_LOGIN_FAILED',
            'users',
            user.id,
            `Failed login attempt ${newCount}`,
          ]
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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Elements */}
      <div
        style={{
          position: 'absolute',
          right: '-5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(249,115,22,0.06), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(20,184,166,0.04), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 60px',
          width: '100%',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '80px' }}
        >
          {/* Left Column - Login Form */}
          <div
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
          >
            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '10px 20px',
                borderRadius: '9999px',
                marginBottom: '32px',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.backgroundColor = 'var(--secondary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.backgroundColor = 'var(--surface)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Back to Welcome
            </button>

            <div style={{ width: '100%', maxWidth: '420px', textAlign: 'left' }}>
              {/* Login header */}
              <div style={{ marginBottom: '32px' }}>
                {schoolLogo && (
                  <img
                    src={schoolLogo}
                    alt={`${schoolName} Logo`}
                    style={{
                      width: 'auto',
                      height: '56px',
                      maxHeight: '56px',
                      marginBottom: '16px',
                      borderRadius: '12px',
                      objectFit: 'contain',
                    }}
                  />
                )}
                <h2
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
                  }}
                >
                  Sign in to
                  <br />
                  {schoolName}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px' }}>
                  <span style={{ fontWeight: 700 }}>Fees</span>
                  <span style={{ fontWeight: 400 }}>Foundry</span> School Fees Manager
                </p>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    marginTop: '16px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  Login below to record payments, view learner balances, manage fee structures, and
                  print financial statements for your school.
                </p>
              </div>

              {error && <div className="error-message mb-4">{error}</div>}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '20px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    USERNAME
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    disabled={isLoading}
                    required
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--surface)',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    required
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid var(--border)',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--surface)',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
                  }}
                  onMouseOver={e =>
                    !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')
                  }
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {isLoading ? 'Authenticating...' : 'Sign In'}
                </button>
                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      alert('Password reset not configured. Contact your administrator.')
                    }
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div
                style={{
                  marginTop: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Secure Login by{' '}
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Fees</span>
                <span style={{ fontWeight: 400 }}>Foundry</span>
              </div>
            </div>
          </div>

          {/* Right Column - Branding & SphereCanvas with Feature Cards */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              overflow: 'visible',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '500px',
                height: '500px',
                position: 'relative',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
              }}
            >
              <SphereCanvas />
              <FeatureCards position="right" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '40px', left: 0, right: 0, textAlign: 'center' }}>
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ fontWeight: 700 }}>Fees</span>
          <span style={{ fontWeight: 400 }}>Foundry</span> • v1.2.0 • Build 2026
        </span>
      </div>
    </div>
  );
};
