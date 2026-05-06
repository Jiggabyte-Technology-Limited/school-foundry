import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { db } from './lib/db-client';
import SetupWizard from './components/SetupWizard';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StudentManager from './components/StudentManager';
import FeeStructureManager from './components/FeeStructureManager';
import PaymentManager from './components/PaymentManager';
import Dashboard from './components/Dashboard';
import FinancialStatements from './components/FinancialStatements';
import ActivityLog from './components/ActivityLog';
import BackupManager from './components/BackupManager';
import SettingsModal from './components/SettingsModal';
import { ToastProvider } from './components/Toast';

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  statements: 'Financial Statements',
  students: 'Enrolled Students',
  fees: 'Fee Structure',
  payments: 'Payments',
  logs: 'Activity Logs',
  backup: 'Backup & Restore',
};

const App = () => {
  const [isSetup, setIsSetup] = useState(false);
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [view, setView] = useState('dashboard');
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      const adminUser = await db.get('SELECT * FROM users LIMIT 1');
      setIsSetup(!!adminUser);
    };
    checkSetup();
  }, []);

  useEffect(() => {
    const loadSchoolName = async () => {
      const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
      setSchoolName(setting?.value || '');
    };
    if (isSetup) loadSchoolName();
  }, [isSetup]);

  const handleLogout = () => {
    setUser(null);
    setView('dashboard');
  };

  const handleSchoolNameUpdate = (name: string) => {
    setSchoolName(name);
  };

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
        <div className="app-layout">
          <Sidebar activeView={view} onViewChange={setView} />
          
          <main className="main-content">
            <TopBar
              pageTitle={pageTitles[view] || 'Dashboard'}
              schoolName={schoolName}
              userName={user.username}
              userRole={user.role}
              onSettingsClick={() => setShowSettings(true)}
              onLogout={handleLogout}
            />
            
            <div className="page-content">
              {view === 'dashboard' && <Dashboard />}
              {view === 'students' && <StudentManager />}
              {view === 'fees' && <FeeStructureManager />}
              {view === 'payments' && <PaymentManager />}
              {view === 'statements' && <FinancialStatements />}
              {view === 'logs' && <ActivityLog />}
              {view === 'backup' && <BackupManager />}
            </div>
          </main>
          
          {showSettings && (
            <SettingsModal
              user={user}
              schoolName={schoolName}
              onSchoolNameUpdate={handleSchoolNameUpdate}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
