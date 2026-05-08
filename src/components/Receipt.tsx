import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

interface ReceiptProps {
  payment: {
    id: number;
    student_id: number;
    receipt_number: string;
    student_name: string;
    amount_paid_cents: number;
    payment_date: string;
    year_id: number;
    year_label: string;
    term_label: string;
    guardian_name: string;
    guardian_contact: string;
    is_voided?: number;
    void_reason?: string;
    recorded_by_name?: string;
  };
  onClose: () => void;
  onVoid?: () => void;
  canVoid?: boolean;
}

interface PaymentHistory {
  receipt_number: string;
  term_label: string;
  amount_paid_cents: number;
  payment_date: string;
}

const Receipt: React.FC<ReceiptProps> = ({ payment, onClose, onVoid, canVoid }) => {
  const [schoolName, setSchoolName] = useState('School');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [runningTotal, setRunningTotal] = useState(0);
  const [currentAmountDue, setCurrentAmountDue] = useState(0);
  const isVoided = payment.is_voided === 1;

  useEffect(() => {
    const loadData = async () => {
      try {
        const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
        if (setting?.value) {
          setSchoolName(setting.value);
        }

        // Load payment history for this student in the same year
        const history = await db.all(`
          SELECT p.receipt_number, t.label as term_label, p.amount_paid_cents, p.payment_date
          FROM payments p
          JOIN terms t ON p.term_id = t.id
          WHERE p.student_id = ? AND p.year_id = ? AND p.is_voided = 0 AND p.id <= ?
          ORDER BY p.payment_date ASC
        `, [payment.student_id, payment.year_id, payment.id]);

        setPaymentHistory(history);
        
        // Calculate running total (sum of all non-voided payments up to and including this one)
        const total = await db.get(`
          SELECT COALESCE(SUM(amount_paid_cents), 0) as total
          FROM payments
          WHERE student_id = ? AND year_id = ? AND is_voided = 0 AND id <= ?
        `, [payment.student_id, payment.year_id, payment.id]);
        setRunningTotal(total?.total || 0);

        // Get total expected fees for the year
        const expectedFees = await db.get(`
          SELECT COALESCE(SUM(amount_cents), 0) as total
          FROM fees
          WHERE student_id = ? AND year_id = ?
        `, [payment.student_id, payment.year_id]);
        
        const expected = expectedFees?.total || 0;
        const paid = total?.total || 0;
        setCurrentAmountDue(Math.max(0, expected - paid));
      } catch (err) {
        console.error('Error loading receipt data:', err);
      }
    };
    loadData();
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px', padding: '0', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div id="receipt-content" className="statement-preview" style={{ padding: '24px', position: 'relative', fontFamily: 'monospace', overflowY: 'auto', flex: 1 }}>
          {isVoided && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-30deg)',
              fontSize: '64px',
              fontWeight: 800,
              color: '#ccc',
              textTransform: 'uppercase',
              letterSpacing: '4px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}>
              VOIDED
            </div>
          )}
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>OFFICIAL SCHOOL RECEIPT</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{schoolName}</div>
            <div style={{ fontSize: '10px', marginTop: '4px' }}>Powered by FeesFoundry</div>
          </div>
          
          <div style={{ borderTop: '1px dashed #333', borderBottom: '1px dashed #333', padding: '12px 0', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px' }}>Receipt No:</span>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{payment.receipt_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px' }}>Date:</span>
              <span style={{ fontSize: '12px' }}>{new Date(payment.payment_date).toLocaleDateString()} {new Date(payment.payment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px' }}>Student:</span>
              <span style={{ fontSize: '12px', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{payment.student_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px' }}>Guardian:</span>
              <span style={{ fontSize: '12px', textAlign: 'right', maxWidth: '60%' }}>{payment.guardian_name}{payment.guardian_contact ? ` - ${payment.guardian_contact}` : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px' }}>Period:</span>
              <span style={{ fontSize: '12px' }}>{payment.term_label}, {payment.year_label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px' }}>Recorded by:</span>
              <span style={{ fontSize: '12px' }}>{payment.recorded_by_name || 'System'}</span>
            </div>
          </div>
          
          {/* Amount */}
          <div style={{ textAlign: 'center', marginBottom: '16px', padding: '12px', border: '1px solid #333' }}>
            <div style={{ fontSize: '11px', marginBottom: '4px' }}>{isVoided ? 'ORIGINAL AMOUNT (VOIDED)' : 'AMOUNT PAID'}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, textDecoration: isVoided ? 'line-through' : 'none' }}>${(payment.amount_paid_cents / 100).toFixed(2)}</div>
            {isVoided && payment.void_reason && (
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Reason: {payment.void_reason}</div>
            )}
          </div>
          
          {paymentHistory.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>PAYMENT HISTORY - {payment.year_label}</div>
              <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                <tbody>
                  {paymentHistory.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 0' }}>{new Date(p.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td style={{ padding: '4px 0', textAlign: 'center' }}>{p.receipt_number}</td>
                      <td style={{ padding: '4px 0', textAlign: 'center' }}>{p.term_label}</td>
                      <td style={{ padding: '4px 0', textAlign: 'right' }}>${(p.amount_paid_cents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '8px', padding: '8px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>RUNNING TOTAL</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>${(runningTotal / 100).toFixed(2)}</span>
              </div>
              {currentAmountDue > 0 && (
                <div style={{ marginTop: '8px', padding: '8px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>CURRENT AMOUNT DUE</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>${(currentAmountDue / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          
          <div style={{ fontSize: '10px', textAlign: 'center', paddingTop: '12px', borderTop: '1px dashed #333' }}>
            <p style={{ margin: '4px 0', fontWeight: 600 }}>{isVoided ? '*** THIS PAYMENT HAS BEEN VOIDED ***' : '*** VALID PROOF OF PAYMENT ***'}</p>
            <p style={{ margin: '4px 0' }}>Please retain this receipt for your records.</p>
          </div>
          
          {/* T&Cs Section */}
          <div style={{ fontSize: '9px', textAlign: 'left', paddingTop: '12px', marginTop: '8px', borderTop: '1px dashed #333' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>TERMS & CONDITIONS:</div>
            <ul style={{ margin: 0, paddingLeft: '12px', lineHeight: 1.4 }}>
              <li>This receipt is valid proof of payment and must be retained for record purposes.</li>
              <li>All payments are non-refundable unless explicitly approved by school administration.</li>
              <li>Payment of school fees does not guarantee enrollment or continued enrollment.</li>
              <li>Outstanding fees may result in suspension of classes or exclusion from examinations.</li>
              <li>For any queries regarding this receipt, contact the school finance office.</li>
            </ul>
          </div>
          
          {/* Footer Branding */}
          <div style={{ fontSize: '9px', textAlign: 'center', paddingTop: '12px', marginTop: '12px', borderTop: '1px dashed #333' }}>
            <p style={{ margin: '2px 0' }}>For assistance, contact: {schoolName} Finance Office</p>
            <p style={{ margin: '2px 0' }}>Powered by <strong>FeesFoundry</strong> - A product of <strong>Jiggabyte Technology Limited</strong></p>
            <p style={{ margin: '2px 0', fontStyle: 'italic' }}>www.jiggabyte.co.zm</p>
          </div>
        </div>
        
        <div className="no-print" style={{ padding: '20px 32px', backgroundColor: 'var(--secondary)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', display: 'flex', gap: '12px', justifyContent: 'center', flexShrink: 0 }}>
          {canVoid && !isVoided && onVoid && (
            <button 
              className="btn" 
              onClick={onVoid}
              style={{ background: '#dc2626', color: 'white', flex: 1 }}
            >
              Void Payment
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ flex: 1 }}>
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
