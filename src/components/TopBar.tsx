import React from 'react';

interface TopBarProps {
  pageTitle: string;
  schoolName: string;
  activeTerm?: string;
  userName: string;
  userRole: string;
}

const TopBar: React.FC<TopBarProps> = ({
  pageTitle,
  schoolName,
  activeTerm,
  userName,
  userRole,
}) => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title text-display">{pageTitle}</h1>
      </div>

      <div
        className="topbar-center"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <span className="topbar-school text-display" style={{ lineHeight: 1.2 }}>
          {schoolName || 'School Name'}
        </span>
      </div>

      <div className="topbar-right">
        <div className="topbar-user" style={{ cursor: 'default' }}>
          <div className="topbar-user-info" style={{ textAlign: 'right', marginRight: '12px' }}>
            <span className="topbar-user-name text-display" style={{ display: 'block' }}>
              {userName}
            </span>
            <span
              className="topbar-user-role text-mono"
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--primary)',
                fontWeight: 700,
              }}
            >
              {userRole}
            </span>
          </div>
          <div className="topbar-user-avatar text-display" style={{ margin: 0 }}>
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
