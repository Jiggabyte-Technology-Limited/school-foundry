import React from 'react';

interface VoidKeyModalProps {
  voidKeyInput: string;
  setVoidKeyInput: (val: string) => void;
  voidKeyError: string;
  setVoidKeyError: (err: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const VoidKeyModal: React.FC<VoidKeyModalProps> = ({
  voidKeyInput,
  setVoidKeyInput,
  voidKeyError,
  setVoidKeyError,
  onClose,
  onSubmit,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '350px',
          width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Enter Void Key</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
          Enter the void key to authorize voiding this payment.
        </p>
        <div style={{ marginBottom: '16px' }}>
          <input
            type="password"
            value={voidKeyInput}
            onChange={e => {
              setVoidKeyInput(e.target.value);
              setVoidKeyError('');
            }}
            className="input-default"
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '18px',
              letterSpacing: '4px',
            }}
            placeholder="••••"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onSubmit();
              }
            }}
          />
          {voidKeyError && (
            <p
              style={{
                color: '#ef4444',
                fontSize: '12px',
                marginTop: '8px',
                marginBottom: 0,
              }}
            >
              {voidKeyError}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} style={{ flex: 1 }}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
