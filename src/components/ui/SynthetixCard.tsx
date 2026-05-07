import React from 'react';

interface SynthetixCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const SynthetixCard: React.FC<SynthetixCardProps> = ({ children, className, style }) => {
  return (
    <div 
      className={className} 
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default SynthetixCard;
