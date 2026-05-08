import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bcryptjs from 'bcryptjs';
import { db } from '../../lib/db-client';
import { useAuth } from '../../lib/auth-context';
import SphereCanvas from '../SphereCanvas';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('FeesFoundry');
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
        console.error("Failed to fetch school details", err);
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
      {/* Left Side - Orange Visual Section with SphereCanvas */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#f97316',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '40px'
      }}>
        {/* SphereCanvas Background */}
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          zIndex: 0,
          opacity: 0.6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
           <div style={{ width: '100%', height: '100%', minWidth: '600px', minHeight: '600px', maxWidth: '800px', maxHeight: '800px' }}>
              <SphereCanvas />
           </div>
        </div>
        
        {/* Main visual content */}
        <div style={{ textAlign: 'center', color: 'white', zIndex: 1, maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="./img/feesfoundry-logo.png" 
            alt="FeesFoundry Logo" 
            style={{ width: '80px', height: '80px', marginBottom: '24px', filter: 'brightness(0) invert(1)' }} 
          />
          <h1 style={{ fontSize: '48px', margin: 0, letterSpacing: '-1px', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#FFFFFF' }}>Fees</span>
            <span style={{ fontWeight: 400, color: '#FFFFFF' }}>Foundry</span>
          </h1>
          <p style={{ fontSize: '18px', marginTop: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>Forging a Stronger Financial Future<br/>for Schools.</p>
          
          <div style={{ 
            marginTop: '32px', 
            textAlign: 'left',
            width: '100%',
            maxWidth: '700px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '28px 32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 20px 0', color: '#f97316' }}>Key Features</h3>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '14px 28px' 
            }}>
              {[
                'Record Payments & Print Receipts',
                'Secure Login System',
                'Print Financial Statements',
                'Track Students Owing',
                'List Fully Paid Students',
                'Analytics Dashboard',
                'Activity Logging',
                'Student Management'
              ].map((feature, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ 
            marginTop: '32px', 
            paddingTop: '24px', 
            borderTop: '1px solid rgba(255,255,255,0.3)',
            width: '100%',
            maxWidth: '360px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.9)', fontSize: '13px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span style={{ fontWeight: 500 }}>info@jiggabyte.co.zm</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.9)', fontSize: '13px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.81 12.81 0 0 0 .63 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.62A2 2 0 0 1 22 16.92z" />
              </svg>
              <span style={{ fontWeight: 500 }}>+27 696372804</span>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                background: '#ffffff', 
                padding: '2px 8px', 
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.1)',
                marginLeft: '4px'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
                <span style={{ fontSize: '10px', color: '#25D366', fontWeight: 700, textTransform: 'uppercase' }}>WhatsApp</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer on orange side */}
        <div style={{ position: 'absolute', bottom: '24px', color: 'rgba(0,0,0,0.4)', fontSize: '12px', textAlign: 'center', zIndex: 1 }}>
          Developed by <strong style={{ color: 'rgba(0,0,0,0.5)' }}>Jiggabyte Technology Limited</strong>
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
        padding: '40px',
        position: 'relative'
      }}>
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            top: '40px',
            right: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: '8px',
            transition: 'background-color 0.2s, color 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--background)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Welcome
        </button>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Login header */}
          <div style={{ marginBottom: '40px' }}>
            {schoolLogo && (
              <img 
                src={schoolLogo} 
                alt={`${schoolName} Logo`} 
                style={{ width: 'auto', height: '64px', maxHeight: '64px', marginBottom: '16px', borderRadius: '12px', objectFit: 'contain' }} 
              />
            )}
            <h2 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Welcome to<br/>
              {schoolName}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '14px' }}>
              <span style={{ fontWeight: 700 }}>Fees</span><span style={{ fontWeight: 400 }}>Foundry</span> School Fees Manager
            </p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '16px', fontSize: '13px', lineHeight: 1.5 }}>
              Login below to record payments, view student balances, manage fee structures, and print financial statements for your school.
            </p>
          </div>

          {error && (
            <div className="error-message mb-4">
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
            <div style={{ marginTop: '16px' }}>
              <button 
                type="button"
                onClick={() => alert('Password reset not configured. Contact your administrator.')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                Forgot password?
              </button>
            </div>
          </form>

          {/* Footer */}
          <div style={{ marginTop: '48px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure Login by <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Fees</span><span style={{ fontWeight: 400 }}>Foundry</span>
          </div>
        </div>
      </div>
    </div>
  );
};
