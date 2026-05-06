import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './lib/db-client';
import SetupWizard from './components/SetupWizard';
import LoginScreen from './components/LoginScreen';
import StudentManager from './components/StudentManager';
import FeeStructureManager from './components/FeeStructureManager';
import PaymentManager from './components/PaymentManager';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import ActivityLog from './components/ActivityLog';
import BackupManager from './components/BackupManager';

const App = () => {
  const [isSetup, setIsSetup] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    const checkSetup = async () => {
      const adminUser = await db.get('SELECT * FROM users LIMIT 1');
      setIsSetup(!!adminUser);
    };
    checkSetup();
  }, []);

  if (!isSetup) {
    return <SetupWizard onComplete={() => setIsSetup(true)} />;
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={setUser} />;
  }

  return (
    <div>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <button onClick={() => setView('dashboard')}>Dashboard</button>
        <button onClick={() => setView('students')}>Students</button>
        <button onClick={() => setView('fees')}>Fees</button>
        <button onClick={() => setView('payments')}>Payments</button>
        <button onClick={() => setView('reports')}>Reports</button>
        <button onClick={() => setView('logs')}>Logs</button>
        <button onClick={() => setView('backup')}>Backup/Restore</button>
      </nav>

      {view === 'dashboard' && <Dashboard />}
      {view === 'students' && <StudentManager />}
      {view === 'fees' && <FeeStructureManager />}
      {view === 'payments' && <PaymentManager />}
      {view === 'reports' && <Reports />}
      {view === 'logs' && <ActivityLog />}
      {view === 'backup' && <BackupManager />}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
