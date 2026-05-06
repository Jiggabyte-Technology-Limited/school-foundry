import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
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

  return (
    <div className="layout-wrapper">
      {!isSetup ? (
        <div className="centered-card-container">
          <SetupWizard onComplete={() => setIsSetup(true)} />
        </div>
      ) : !user ? (
        <div className="centered-card-container">
          <LoginScreen onLoginSuccess={setUser} />
        </div>
      ) : (
        <>
          <nav className="navbar">
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
            <button className={view === 'students' ? 'active' : ''} onClick={() => setView('students')}>Students</button>
            <button className={view === 'fees' ? 'active' : ''} onClick={() => setView('fees')}>Fees</button>
            <button className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>Payments</button>
            <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}>Reports</button>
            <button className={view === 'logs' ? 'active' : ''} onClick={() => setView('logs')}>Logs</button>
            <button className={view === 'backup' ? 'active' : ''} onClick={() => setView('backup')}>Backup/Restore</button>
          </nav>
          
          <div className="page-container">
            {view === 'dashboard' && <Dashboard />}
            {view === 'students' && <StudentManager />}
            {view === 'fees' && <FeeStructureManager />}
            {view === 'payments' && <PaymentManager />}
            {view === 'reports' && <Reports />}
            {view === 'logs' && <ActivityLog />}
            {view === 'backup' && <BackupManager />}
          </div>
        </>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
