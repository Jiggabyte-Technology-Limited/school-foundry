import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { db } from './lib/db-client';
import { AuthProvider, useAuth } from './lib/auth-context';
import SetupWizard from './components/SetupWizard';
import { Welcome } from './components/auth/Welcome';
import { Login } from './components/auth/Login';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import FeeStructureManager from './components/FeeStructureManager';
import PaymentManager from './components/PaymentManager';
import Dashboard from './components/Dashboard';
import StudentAccounts from './components/StudentAccounts';
import ActivityLog from './components/ActivityLog';
import BackupManager from './components/BackupManager';
import SettingsModal from './components/SettingsModal';

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  accounts: 'Student Accounts',
  fees: 'Fee Structure',
  payments: 'Payments',
  logs: 'Activity Logs',
  backup: 'Backup & Restore',
};

function AppInner() {
  const { user, login, logout } = useAuth();
  const [isSetup, setIsSetup] = useState(false);
  const [view, setView] = useState('dashboard');
  const [schoolName, setSchoolName] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      const adminUser = await db.get('SELECT * FROM users LIMIT 1');
      setIsSetup(!!adminUser);
    };
    checkSetup();
  }, []);

  useEffect(() => {
    const loadSchoolDetails = async () => {
      const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
      setSchoolName(setting?.value || '');
      
      const termRes = await db.get(`
        SELECT t.label 
        FROM terms t 
        JOIN academic_years y ON t.year_id = y.id 
        ORDER BY y.label DESC, t.term_number ASC 
        LIMIT 1
      `);
      if (termRes && termRes.label) {
        setActiveTerm(termRes.label);
      }
    };
    if (isSetup) loadSchoolDetails();
  }, [isSetup]);

  const handleLogout = () => {
    logout();
  };

  const handleSchoolNameUpdate = (name: string) => {
    setSchoolName(name);
  };

  if (!isSetup) return <SetupWizard onComplete={() => setIsSetup(true)} />;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={
          user ? (
            <div className="app-layout">
              <Sidebar activeView={view} onViewChange={setView} />
              <main className="main-content">
                <TopBar
                  pageTitle={pageTitles[view] || 'Dashboard'}
                  schoolName={schoolName}
                  activeTerm={activeTerm}
                  userName={user.full_name || user.username}
                  userRole={user.role}
                  onSettingsClick={() => setShowSettings(true)}
                  onLogout={handleLogout}
                />
                <div className="page-content">
                  {view === 'dashboard' && <Dashboard />}
                  {view === 'accounts' && <StudentAccounts />}
                  {view === 'fees' && <FeeStructureManager />}
                  {view === 'payments' && <PaymentManager />}
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
          ) : <Navigate to="/login" />
        } />
      </Routes>
    </Router>
  );
}

const App = () => (
  <AuthProvider>
    <AppInner />
  </AuthProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
