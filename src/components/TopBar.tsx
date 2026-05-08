import React from 'react';

interface TopBarProps {
  pageTitle: string;
  schoolName: string;
  activeTerm?: string;
  userName: string;
  userRole: string;
  onSettingsClick: () => void;
  onLogout: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  pageTitle,
  schoolName,
  activeTerm,
  userName,
  userRole,
  onSettingsClick,
  onLogout,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title text-display">{pageTitle}</h1>
      </div>
      
      <div className="topbar-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="topbar-school text-display" style={{ lineHeight: 1.2 }}>{schoolName || 'School Name'}</span>
        {activeTerm && (
          <span style={{ fontSize: '13px', fontWeight: 300, color: 'var(--primary)', marginTop: '2px' }}>
            {activeTerm}
          </span>
        )}
      </div>
      
      <div className="topbar-right">
        <div className="topbar-user">
          <div className="topbar-user-avatar text-display">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="topbar-user-info">
            <span className="topbar-user-name text-display">{userName}</span>
            <span className="topbar-user-role text-mono" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{userRole}</span>
          </div>
        </div>
        
        <button className="topbar-btn" onClick={onSettingsClick} title="Settings">
          <svg
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
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        
        <button className="topbar-btn topbar-btn-logout" onClick={onLogout} title="Logout">
          <svg
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
        </button>
      </div>
    </header>
  );
};

export default TopBar;
