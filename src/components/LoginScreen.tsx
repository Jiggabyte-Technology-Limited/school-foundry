import React, { useState } from 'react';
import { db } from '../lib/db-client';

const LoginScreen = ({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
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
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Login</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};

export default LoginScreen;
