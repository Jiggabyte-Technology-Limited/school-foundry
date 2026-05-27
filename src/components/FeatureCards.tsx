import React from 'react';

const features = [
  {
    title: 'Record School Fees Payments',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    ),
  },
  {
    title: 'Print Learner Statements',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: 'Print Receipts',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
        <path d="M16 8h-6a2 2 0 1 0 0 4" />
        <path d="M12 17V7" />
      </svg>
    ),
  },
  {
    title: 'School Fees Analytics',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    title: 'Data Backup',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: 'Learner Management',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Payment Tracking',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: 'Financial Reports',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
];

interface FeatureCardsProps {
  position?: 'left' | 'right';
}

export const FeatureCards: React.FC<FeatureCardsProps> = ({ position = 'right' }) => {
  const isLeft = position === 'left';

  const cardStyles: React.CSSProperties[] = [
    { top: '-25px', left: '50%', transform: 'translateX(-50%)' },
    { top: '15%', right: '-45px' },
    { top: '50%', right: '-45px', transform: 'translateY(-50%)' },
    { top: '85%', right: '-45px' },
    { bottom: '-25px', left: '50%', transform: 'translateX(-50%)' },
    { top: '85%', left: '-45px' },
    { top: '50%', left: '-45px', transform: 'translateY(-50%)' },
    { top: '15%', left: '-45px' },
  ];

  return (
    <>
      {features.map((feature, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            ...cardStyles[idx],
            background: 'rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '16px',
            padding: '12px 16px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            zIndex: 10,
            maxWidth: '220px',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            cursor: 'default',
          }}
          onMouseOver={e => {
            const isRight = idx === 1 || idx === 2;
            const isLeft = idx === 3 || idx === 4;
            const moveX = isRight ? '8px' : isLeft ? '-8px' : '0';
            const currentTransform = cardStyles[idx].transform || '';
            e.currentTarget.style.transform = currentTransform
              ? `${currentTransform} translateX(${moveX})`
              : `translateX(${moveX})`;
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.12)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = cardStyles[idx].transform || '';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.08)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          }}
        >
          <div style={{ color: 'var(--primary)', flexShrink: 0 }}>{feature.icon}</div>
          <span style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.3 }}>
            {feature.title}
          </span>
        </div>
      ))}
    </>
  );
};
