import React, { useState } from 'react';
import bcryptjs from 'bcryptjs';
import { db } from '../lib/db-client';
import { User } from '../lib/auth-context';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
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
        onLoginSuccess({
          id: user.id,
          full_name: user.full_name || user.username,
          username: user.username,
          role: user.role,
        });
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
    <div className="card login-card">
      <h1>Login</h1>
      {error && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '14px' }}>{error}</p>}
      <div className="flex-col gap-4 mb-4">
        <input className="input-default" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading} />
        <input className="input-default" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
      </div>
      <button className="btn btn-primary w-full" onClick={handleLogin} disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  );
};

export default LoginScreen;
