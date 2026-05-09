import React from 'react';

interface PageHeaderProps {
  term?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({ term }) => {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const dateLine = term ? `Date: ${term} - ${today}` : `Date: School Holiday - ${today}`;

  return (
    <div
      style={{
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {dateLine}
      </div>
    </div>
  );
};

export default PageHeader;
