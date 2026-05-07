import React from 'react';

interface ReceiptProps {
  payment: {
    receipt_number: string;
    student_name: string;
    amount_paid_cents: number;
    payment_date: string;
    year_label: string;
    term_label: string;
  };
  onClose: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ payment, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '400px', padding: '20px' }}>
        <div id="receipt-content" className="statement-preview" style={{ padding: '20px' }}>
          <div className="statement-header">
            <h2 className="statement-school-name">School Receipt</h2>
            <p className="statement-title">{payment.receipt_number}</p>
          </div>
          <div className="statement-info">
            <p><strong>Student:</strong> {payment.student_name}</p>
            <p><strong>Date:</strong> {new Date(payment.payment_date).toLocaleDateString()}</p>
            <p><strong>Period:</strong> {payment.term_label} / {payment.year_label}</p>
          </div>
          <div className="statement-summary">
            <div className="summary-row">
              <span>Payment Amount</span>
              <span className="summary-row total">${(payment.amount_paid_cents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="flex-between mt-4 no-print">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>Print</button>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
