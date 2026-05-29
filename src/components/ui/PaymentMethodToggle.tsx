import React from 'react';

export type PaymentMethod = 'cash' | 'ecocash' | 'bank_transfer' | 'other';

interface PaymentMethodToggleProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  label?: string;
}

const OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'ecocash', label: 'EcoCash / Mobile' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export const getPaymentMethodLabel = (value: PaymentMethod) =>
  OPTIONS.find(option => option.value === value)?.label || 'Cash';

const PaymentMethodToggle: React.FC<PaymentMethodToggleProps> = ({
  value,
  onChange,
  label = 'Payment Method',
}) => {
  return (
    <div>
      <label
        style={{
          fontSize: '11px',
          opacity: 0.8,
          display: 'block',
          marginBottom: '6px',
          color: 'inherit',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
        }}
      >
        {label}
      </label>
      <div
        role="group"
        aria-label={label}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        {OPTIONS.map(option => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`chip text-display ${selected ? 'chip-active' : ''}`}
              style={{
                border: '1px solid',
                borderColor: selected ? 'var(--primary)' : 'var(--border)',
                cursor: 'pointer',
                padding: '0.55rem 0.9rem',
                background: selected ? 'var(--primary)' : 'rgba(255,255,255,0.96)',
                color: selected ? '#fff' : 'var(--text-primary)',
                boxShadow: selected ? '0 8px 18px rgba(249, 115, 22, 0.2)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PaymentMethodToggle;
