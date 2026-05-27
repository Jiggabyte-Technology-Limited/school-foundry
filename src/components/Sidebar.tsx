import React, { JSX } from 'react';
import { useAuth } from '../lib/auth-context';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onSettingsClick: () => void;
  onLogout: () => void;
}

type RoleAccess = 'admin' | 'user';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  roles: RoleAccess[];
}

const allNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', roles: ['admin', 'user'] },
  { id: 'accounts', label: 'Learner Accounts', icon: 'file-text', roles: ['admin', 'user'] },
  { id: 'payments', label: 'Payments', icon: 'credit-card', roles: ['admin', 'user'] },
  { id: 'fees', label: 'School Fees', icon: 'dollar', roles: ['admin'] },
  { id: 'logs', label: 'Logs', icon: 'list', roles: ['admin'] },
  { id: 'backup', label: 'Backup', icon: 'database', roles: ['admin'] },
];

const iconPaths: Record<string, JSX.Element> = {
  grid: <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zm-11 0h7v7H3v-7z" />,
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  dollar: (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  'credit-card': (
    <>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </>
  ),
  list: (
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
};

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  onSettingsClick,
  onLogout,
}) => {
  const { user } = useAuth();
  const role = (user?.role as RoleAccess) || 'user';
  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img
            src="./img/schoolfoundry-icon.svg"
            alt="SchoolFoundry Logo"
            style={{ width: '35.2px', height: '35.2px' }}
          />
        </div>
        <div className="sidebar-title">
          <span
            className="sidebar-title-text"
            style={{ display: 'flex', color: 'var(--text-primary)', fontSize: '22px' }}
          >
            <span style={{ fontWeight: 800 }}>School</span>
            <span style={{ fontWeight: 400 }}>Foundry</span>
          </span>
          <span className="sidebar-title-sub" style={{ fontSize: '9px', marginTop: '2px' }}>
            School Management System
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <svg
              className="sidebar-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {iconPaths[item.icon]}
            </svg>
            <span className="text-display">{item.label}</span>
          </button>
        ))}

        <div style={{ margin: '12px 16px', borderTop: '1px solid var(--border)', opacity: 0.3 }} />

        <button
          className="sidebar-nav-item"
          onClick={onSettingsClick}
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg
            className="sidebar-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2 2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="text-display">Settings</span>
        </button>

        <button className="sidebar-nav-item" onClick={onLogout} style={{ color: '#ef4444' }}>
          <svg
            className="sidebar-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="text-display">Logout</span>
        </button>
      </nav>

      <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}
        >
          v1.2.0 • Build 2026
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          &copy; Jiggabyte Technology Limited
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
