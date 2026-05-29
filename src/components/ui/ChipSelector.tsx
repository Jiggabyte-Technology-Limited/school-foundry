import React from 'react';

export type ChipOptionValue = string | number;

export interface ChipOption<T extends ChipOptionValue> {
  value: T;
  label: React.ReactNode;
}

interface ChipSelectorProps<T extends ChipOptionValue> {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: ChipOption<T>[];
  allLabel?: string;
  allowAll?: boolean;
}

const ChipSelector = <T extends ChipOptionValue>({
  label,
  value,
  onChange,
  options,
  allLabel,
  allowAll = false,
}: ChipSelectorProps<T>) => {
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
        {allowAll && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`chip text-display ${value === null ? 'chip-active' : ''}`}
            style={{
              border: '1px solid',
              borderColor: value === null ? 'var(--primary)' : 'var(--border)',
              cursor: 'pointer',
              padding: '0.55rem 0.9rem',
              background: value === null ? 'var(--primary)' : 'rgba(255,255,255,0.96)',
              color: value === null ? '#fff' : 'var(--text-primary)',
              boxShadow: value === null ? '0 8px 18px rgba(249, 115, 22, 0.2)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {allLabel || 'All'}
          </button>
        )}
        {options.map(option => {
          const selected = Object.is(value, option.value);
          return (
            <button
              key={String(option.value)}
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

export default ChipSelector;
