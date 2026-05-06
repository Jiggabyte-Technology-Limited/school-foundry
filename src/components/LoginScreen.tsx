import React, { useState } from 'react';
import { db } from '../lib/db-client';

const LoginScreen = ({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) => {
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
      const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
      
      if (user && user.password_hash === password) {
        await db.run('UPDATE users SET last_login_at = datetime("now"), failed_login_count = 0 WHERE id = ?', [user.id]);
        onLoginSuccess(user);
      } else {
        setError('Invalid credentials');
        if (user) {
          await db.run('UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ?', [user.id]);
        }
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
