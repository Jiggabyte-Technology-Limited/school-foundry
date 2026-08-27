import React from 'react';
import ChipSelector from '../ui/ChipSelector';
import type { Payment } from './types';

interface VoidPaymentModalProps {
  payment: Payment;
  voidReason: string;
  setVoidReason: (reason: string) => void;
  voidComment: string;
  setVoidComment: (comment: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  formatCurrency: (cents: number) => string;
}

export const VoidPaymentModal: React.FC<VoidPaymentModalProps> = ({
  payment,
  voidReason,
  setVoidReason,
  voidComment,
  setVoidComment,
  onClose,
  onConfirm,
  formatCurrency,
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
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Void Payment</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
          Receipt: <strong>{payment.receipt_number}</strong>
          <br />
          Student: <strong>{payment.student_name}</strong>
          <br />
          Amount: <strong>{formatCurrency(payment.amount_paid_cents)}</strong>
        </p>

        <div style={{ marginBottom: '16px' }}>
          <ChipSelector
            label="Reason *"
            value={voidReason || null}
            onChange={value => setVoidReason((value as string) || '')}
            options={[
              { value: 'Mistake', label: 'Mistake' },
              { value: 'Wrong learner', label: 'Wrong learner' },
              { value: 'Wrong amount', label: 'Wrong amount' },
              { value: 'Duplicate payment', label: 'Duplicate payment' },
              { value: 'Customer request', label: 'Customer request' },
              { value: 'Other', label: 'Other' },
            ]}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
          >
            Comment (optional)
          </label>
          <textarea
            value={voidComment}
            onChange={e => setVoidComment(e.target.value)}
            className="input-default"
            style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
            placeholder="Additional details..."
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            disabled={!voidReason}
            style={{ flex: 1, background: '#ef4444', color: 'white' }}
          >
            Void Payment
          </button>
        </div>
      </div>
    </div>
  );
};
