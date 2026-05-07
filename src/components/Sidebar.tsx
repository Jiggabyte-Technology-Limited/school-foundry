import React, { JSX } from 'react';
import { useAuth } from '../lib/auth-context';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

type RoleAccess = 'admin' | 'bursar' | 'viewer';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  roles: RoleAccess[];
}

const allNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', roles: ['admin', 'bursar', 'viewer'] },
  { id: 'accounts', label: 'Student Accounts', icon: 'file-text', roles: ['admin', 'bursar', 'viewer'] },
  { id: 'fees', label: 'Fee Structure', icon: 'dollar', roles: ['admin'] },
  { id: 'payments', label: 'Payments', icon: 'credit-card', roles: ['admin', 'bursar'] },
  { id: 'logs', label: 'Logs', icon: 'list', roles: ['admin'] },
  { id: 'backup', label: 'Backup', icon: 'database', roles: ['admin'] },
];

const iconPaths: Record<string, JSX.Element> = {
  grid: (
    <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zm-11 0h7v7H3v-7z" />
  ),
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

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const { user } = useAuth();
  const role = (user?.role as RoleAccess) || 'viewer';
  const navItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Focus ring (outer) */}
            <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="1.5"/>
            
            {/* Focus ring (middle) */}
            <circle cx="32" cy="32" r="23" fill="none" stroke="white" strokeWidth="1" opacity="0.5"/>
            
            {/* Letter F */}
            <g fill="white">
              {/* Vertical bar */}
              <rect x="20" y="14" width="4.5" height="29" rx="1"/>
              
              {/* Top horizontal bar */}
              <rect x="20" y="14" width="13" height="4" rx="1"/>
              
              {/* Middle horizontal bar */}
              <rect x="20" y="31" width="10" height="3.5" rx="1"/>
            </g>
            
            {/* Clarity crosshair center */}
            <circle cx="32" cy="32" r="2" fill="white"/>
            <line x1="32" y1="26" x2="32" y2="38" stroke="white" strokeWidth="1" strokeLinecap="round"/>
            <line x1="26" y1="32" x2="38" y2="32" stroke="white" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="sidebar-title">
          <span className="sidebar-title-text">FeeFocus</span>
          <span className="sidebar-title-sub">Fee Management</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
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
            {activeView === item.id && (
              <div style={{ marginLeft: 'auto', width: '4px', height: '16px', backgroundColor: 'white', borderRadius: '2px' }} />
            )}
          </button>
        ))}
      </nav>
      
      <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          v1.2.0 • Build 2026
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
