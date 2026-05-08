import React from 'react';

interface ReceiptProps {
  payment: {
    receipt_number: string;
    student_name: string;
    amount_paid_cents: number;
    payment_date: string;
    year_label: string;
    term_label: string;
    guardian_name: string;
    guardian_contact: string;
  };
  onClose: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ payment, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px', padding: '0' }}>
        <div id="receipt-content" className="statement-preview" style={{ padding: '32px' }}>
          <div className="statement-header">
            <h2 className="statement-school-name" style={{ fontSize: '24px', marginBottom: '8px' }}>School Receipt</h2>
            <p className="statement-title" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Receipt #{payment.receipt_number}</p>
          </div>
          
          <div style={{ borderTop: '2px solid var(--border)', borderBottom: '2px solid var(--border)', paddingTop: '20px', paddingBottom: '20px', marginTop: '24px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>STUDENT</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{payment.student_name}</div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>GUARDIAN</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{payment.guardian_name}</div>
              {payment.guardian_contact && (
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{payment.guardian_contact}</div>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>PERIOD</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{payment.term_label}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{payment.year_label}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>DATE</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{new Date(payment.payment_date).toLocaleDateString()}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{new Date(payment.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'var(--secondary)', padding: '20px', borderRadius: 'var(--border-radius-md)', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount Paid</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>${(payment.amount_paid_cents / 100).toFixed(2)}</div>
          </div>
          
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <p style={{ margin: '8px 0' }}>Thank you for your payment</p>
            <p style={{ margin: '4px 0', fontSize: '11px' }}>This receipt is a proof of payment</p>
          </div>
        </div>
        
        <div className="flex-between no-print" style={{ padding: '20px 32px', backgroundColor: 'var(--secondary)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>Print Receipt</button>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
