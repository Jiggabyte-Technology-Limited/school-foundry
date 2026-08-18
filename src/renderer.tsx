import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import './index.css';
import { db } from './lib/db-client';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ToastProvider } from './components/Toast';
import { loadCurrency } from './lib/currency';
import { LicenseActivation } from './components/auth/LicenseActivation';
import { useLocation } from 'react-router-dom';

// License status type
type LicenseStatusResult = {
  valid: boolean;
  status: string;
  error?: string;
  expiresAt?: string;
  daysRemaining?: number;
};

// Global error handler to catch unhandled errors
window.onerror = async (message, source, lineno, colno, error) => {
  const errorMsg = error?.message || String(message);
  const location = `${source}:${lineno}:${colno}`;
  const details = `Uncaught error at ${location}: ${errorMsg}`;
  console.error('Global error:', details);
  try {
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [null, 'System', 'error_uncaught', 'error', null, details]
    );
  } catch (e) {
    console.error('Failed to log error:', e);
  }
  return false;
};

// Global unhandled promise rejection handler
window.onunhandledrejection = async event => {
  const errorMsg = event.reason?.message || String(event.reason);
  const details = `Unhandled promise rejection: ${errorMsg}`;
  console.error('Unhandled rejection:', details);
  try {
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [null, 'System', 'error_promise', 'error', null, details]
    );
  } catch (e) {
    console.error('Failed to log rejection:', e);
  }
};

import PageHeader from './components/PageHeader';
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
import ClassLists from './components/ClassLists';
import UserGuide from './components/UserGuide';
import PageErrorBoundary from './components/PageErrorBoundary';

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  accounts: 'Learner Accounts',
  'class-lists': 'Class Lists',
  fees: 'Fee Structure',
  payments: 'Payments',
  logs: 'Activity Logs',
  backup: 'Backup & Restore',
};

function LicenseGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [licenseStatus, setLicenseStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [licenseData, setLicenseData] = useState<LicenseStatusResult | null>(null);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const result: LicenseStatusResult = await window.api.getLicenseStatus();
        if (result.valid) {
          setLicenseStatus('valid');
          setLicenseData(result);
        } else {
          setLicenseStatus('invalid');
          setLicenseData(result);
        }
      } catch (err) {
        console.error('Failed to check license:', err);
        setLicenseStatus('invalid');
      }
    };

    checkLicense();
  }, []);

  if (licenseStatus === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
            style={{ borderColor: 'var(--primary) transparent var(--primary) var(--primary)' }}
          ></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', fontWeight: 500 }}>
            Checking license...
          </p>
        </div>
      </div>
    );
  }

  if (licenseStatus === 'invalid') {
    if (location.pathname === '/') {
      return <>{children}</>;
    }
    return (
      <LicenseActivation
        onActivated={() => {
          setLicenseStatus('valid');
        }}
      />
    );
  }

  return <>{children}</>;
}

function AppInner() {
  const { user, login, logout } = useAuth();
  const location = useLocation();
  const [isSetup, setIsSetup] = useState(false);
  const [view, setView] = useState('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const isUserGuideWindow = new URLSearchParams(window.location.search).get('window') === 'user-guide';

  useEffect(() => {
    const checkSetup = async () => {
      const adminUser = await db.get('SELECT * FROM users LIMIT 1');
      setIsSetup(!!adminUser);
      // Load currency early
      loadCurrency().catch(console.error);
    };
    checkSetup();
  }, []);

  // Auto-debit fees on app load
  useEffect(() => {
    if (isSetup) {
      window.api.autoDebitFees().catch(console.error);
    }
  }, [isSetup]);

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

  const suppressPageTransition = view === 'accounts' && selectedStudentId !== null;

  if (isUserGuideWindow)
    return (
      <PageTransition key="user-guide" pageKey="user-guide">
        <UserGuide />
      </PageTransition>
    );

  if (!isSetup)
    return (
      <PageTransition key="setup" pageKey="setup">
        <SetupWizard onComplete={() => setIsSetup(true)} />
      </PageTransition>
    );

  return (
      <Routes>
        <Route
          path="/"
          element={
            <PageTransition key="welcome" pageKey="welcome">
              <Welcome isSetup={isSetup} />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            !user ? (
              <PageTransition key="login" pageKey="login">
                <Login />
              </PageTransition>
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            user ? (
              <div className="app-layout">
                <Sidebar
                  activeView={view}
                  onViewChange={setView}
                  onGuideClick={() => window.api.openUserGuideWindow()}
                  onSettingsClick={() => setShowSettings(true)}
                  onLogout={handleLogout}
                />
                <main className="main-content">
                  <TopBar
                    pageTitle={pageTitles[view] || 'Dashboard'}
                    schoolName={schoolName}
                    activeTerm={activeTerm}
                    userName={user.full_name || user.username}
                    userRole={user.role}
                  />
                  <PageErrorBoundary resetKey={view}>
                    <PageTransition key={view} pageKey={view} disabled={suppressPageTransition}>
                      <div className="page-content">
                        {view === 'dashboard' && (
                          <Dashboard
                            onViewStatement={(studentId: number) => {
                              setView('accounts');
                              setSelectedStudentId(studentId);
                            }}
                          />
                        )}
                        {view === 'accounts' && (
                          <StudentAccounts
                            preselectedStudentId={selectedStudentId}
                            onStatementViewed={() => setSelectedStudentId(null)}
                          />
                        )}
                        {view === 'class-lists' && (
                          <ClassLists
                            onViewStudentAccount={(studentId: number) => {
                              setView('accounts');
                              setSelectedStudentId(studentId);
                            }}
                          />
                        )}
                        {view === 'fees' && <FeeStructureManager />}
                        {view === 'payments' && (
                          <PaymentManager
                            onViewStatement={(studentId: number) => {
                              setView('accounts');
                              setSelectedStudentId(studentId);
                            }}
                          />
                        )}
                        {view === 'logs' && <ActivityLog />}
                        {view === 'backup' && <BackupManager />}
                      </div>
                    </PageTransition>
                  </PageErrorBoundary>
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
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
  );
}

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <Router>
        <LicenseGate>
          <AppInner />
        </LicenseGate>
      </Router>
    </ToastProvider>
  </AuthProvider>
);

function PageTransition({
  children,
  pageKey,
  disabled = false,
}: {
  children: React.ReactNode;
  pageKey?: string;
  disabled?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsVisible(true);
      return;
    }
    setIsVisible(false);
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [pageKey, disabled]);

  return (
    <div className={`page-transition ${disabled || isVisible ? 'is-visible' : ''}`}>{children}</div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
