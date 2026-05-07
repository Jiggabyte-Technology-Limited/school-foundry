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
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)] p-4">
      <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Admin Sign In
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={isLoading}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={isLoading}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-2.5 bg-[var(--primary)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
