import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db-client';
import { printDocument, generateReceiptHtml } from '../../lib/print-service';
import { getCurrencySymbol } from '../../lib/currency';

/*
 * IMPORTANT DEVELOPMENT NOTE FOR AI MODELS AND DEVELOPERS:
 * ==========================================================
 * The UI preview (what users see on screen) MUST always match exactly what gets printed.
 * This is critical because the UI is showing the user exactly what will be printed.
 *
 * When making changes to receipt or statement functionality:
 * 1. Always update BOTH the UI preview component AND the print template
 * 2. Test by printing and comparing side-by-side with the UI preview
 * 3. Any data filtering in the print function MUST be replicated in the UI preview
 * 4. This applies to: PaymentReceiptPreview, StudentStatementPreview, and any other preview components
 *
 * For receipts specifically:
 * - Payment history should only show payments up to and including the current receipt
 * - Account balance should reflect the balance at the time of that receipt
 * - This ensures the receipt matches the original document given to the student
 */

interface Payment {
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
}

interface PaymentReceiptPreviewProps {
  payment: Payment;
  onClose: () => void;
  onVoid?: () => void;
  canVoid?: boolean;
}

const PaymentReceiptPreview: React.FC<PaymentReceiptPreviewProps> = ({
  payment,
  onClose,
  onVoid,
  canVoid,
}) => {
  const [schoolName, setSchoolName] = useState('School');
  const [runningTotal, setRunningTotal] = useState(0);
  const [currentAmountDue, setCurrentAmountDue] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isVoided = payment.is_voided === 1;

  // Reset state when payment changes
  useEffect(() => {
    setPaymentHistory([]);
    setRunningTotal(0);
    setCurrentAmountDue(0);
    setIsLoading(true);
  }, [payment.id, payment.student_id, payment.year_id]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
        if (setting?.value) setSchoolName(setting.value);

        // Load ALL payments for student in this year (including after this receipt)
        const history = await db.all(
          `SELECT p.receipt_number, t.label as term_label, p.amount_paid_cents, p.payment_date, p.is_voided
           FROM payments p
           LEFT JOIN terms t ON p.term_id = t.id
           WHERE p.student_id = ? AND p.year_id = ?
           ORDER BY p.payment_date ASC`,
          [payment.student_id, payment.year_id]
        );
        setPaymentHistory(history);

        const total = await db.get(
          `SELECT COALESCE(SUM(amount_paid_cents), 0) as total
           FROM payments
           WHERE student_id = ? AND year_id = ? AND is_voided = 0`,
          [payment.student_id, payment.year_id]
        );
        setRunningTotal(total?.total || 0);

        const enrollment = await db.get(
          `SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?`,
          [payment.student_id, payment.year_id]
        );

        const now = new Date().toISOString().split('T')[0];
        const currentPeriod = await db.get(
          `SELECT id, label FROM terms WHERE year_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= ? AND end_date >= ? ORDER BY term_number LIMIT 1`,
          [payment.year_id, now, now]
        );

        const periods = await db.all(
          `SELECT id, label, start_date, end_date FROM terms WHERE year_id = ? ORDER BY term_number`,
          [payment.year_id]
        );

        let activePeriod = currentPeriod;
        if (!activePeriod) {
          activePeriod = periods.find((p: any) => p.end_date >= now) || periods[periods.length - 1];
        }

        let expectedFees = 0;
        if (activePeriod && enrollment?.grade_id) {
          const debitedFees = await db.get(
            `SELECT COALESCE(SUM(sf.amount_cents), 0) as total 
             FROM student_fees sf 
             JOIN fee_structure fs ON sf.fee_structure_id = fs.id 
             WHERE sf.student_id = ? AND fs.term_id = ? AND fs.grade_id = ?`,
            [payment.student_id, activePeriod.id, enrollment.grade_id]
          );

          if (debitedFees?.total > 0) {
            expectedFees = debitedFees.total;
          } else {
            const feesResult = await db.get(
              `SELECT COALESCE(SUM(amount_cents), 0) as total FROM fee_structure WHERE grade_id = ? AND year_id = ? AND term_id = ?`,
              [enrollment.grade_id, payment.year_id, activePeriod.id]
            );
            expectedFees = feesResult?.total || 0;
          }
        }

        const allPayments = await db.get(
          `SELECT COALESCE(SUM(amount_paid_cents), 0) as total FROM payments WHERE student_id = ? AND year_id = ? AND is_voided = 0`,
          [payment.student_id, payment.year_id]
        );
        const allPaid = allPayments?.total || 0;
        const accountBalance = expectedFees - allPaid;
        setCurrentAmountDue(accountBalance);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading receipt data:', err);
        setIsLoading(false);
      }
    };
    loadData();
  }, [payment.id, payment.student_id, payment.year_id]);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = generateReceiptHtml({
        schoolName,
        receiptNumber: payment.receipt_number,
        date: new Date(payment.payment_date).toLocaleDateString(),
        time: new Date(payment.payment_date).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        studentName: payment.student_name,
        period: `${payment.term_label}, ${payment.year_label}`,
        amount: (payment.amount_paid_cents / 100).toFixed(2),
        currencySymbol: getCurrencySymbol(),
        isVoided,
        voidReason: payment.void_reason,
        runningTotal: (runningTotal / 100).toFixed(2),
        currentAmountDue: (currentAmountDue / 100).toFixed(2),
        paymentHistory: paymentHistory.map(p => ({
          date: new Date(p.payment_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          receiptNumber: p.receipt_number,
          termLabel: p.term_label,
          amount: (p.amount_paid_cents / 100).toFixed(2),
          isVoided: p.is_voided === 1,
        })),
        currentReceiptNumber: payment.receipt_number,
      });
      await printDocument({
        html,
        filename: `receipt_${payment.receipt_number}`,
        title: `Receipt ${payment.receipt_number}`,
      });
    } catch (err) {
      console.error('Error printing receipt:', err);
    } finally {
      setPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          padding: '40px',
          textAlign: 'center',
          minHeight: '400px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <div style={{ fontSize: '12px', color: '#6b7280' }}>Loading receipt...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#1f2937',
        maxHeight: '100vh',
        position: 'relative',
      }}
    >
      {isVoided && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: '48px',
            fontWeight: 800,
            color: '#ccc',
            textTransform: 'uppercase',
            letterSpacing: '4px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          VOIDED
        </div>
      )}

      <div style={{ padding: '16px', position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
            OFFICIAL SCHOOL RECEIPT
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{schoolName}</div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>Powered by SchoolFoundry</div>
        </div>

        {/* Receipt Details */}
        <div
          style={{
            borderTop: '1px dashed #333',
            borderBottom: '1px dashed #333',
            padding: '12px 0',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px' }}>Receipt No:</span>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>{payment.receipt_number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px' }}>Date:</span>
            <span style={{ fontSize: '12px' }}>
              {new Date(payment.payment_date).toLocaleDateString()}{' '}
              {new Date(payment.payment_date).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px' }}>Student:</span>
            <span
              style={{ fontSize: '12px', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}
            >
              {payment.student_name}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px' }}>Period:</span>
            <span style={{ fontSize: '12px' }}>
              {payment.term_label}, {payment.year_label}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px' }}>Recorded by:</span>
            <span style={{ fontSize: '12px' }}>{payment.recorded_by_name || 'System'}</span>
          </div>
        </div>

        {/* Amount */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '16px',
            padding: '12px',
            border: '1px solid #333',
          }}
        >
          <div style={{ fontSize: '11px', marginBottom: '4px' }}>
            {isVoided ? 'ORIGINAL AMOUNT (VOIDED)' : 'AMOUNT PAID'}
          </div>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 700,
              textDecoration: isVoided ? 'line-through' : 'none',
            }}
          >
            +{getCurrencySymbol()}
            {(payment.amount_paid_cents / 100).toFixed(2)}
          </div>
          {isVoided && payment.void_reason && (
            <div style={{ fontSize: '11px', marginTop: '4px' }}>Reason: {payment.void_reason}</div>
          )}
        </div>

        {/* Payment History */}
        {paymentHistory.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: '8px',
                borderBottom: '1px solid #333',
                paddingBottom: '4px',
              }}
            >
              PAYMENT HISTORY - {payment.year_label}
            </div>
            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
              <tbody>
                {paymentHistory.map((p, i) => {
                  const isCurrentReceipt = p.receipt_number === payment.receipt_number;
                  const rowStyle = isCurrentReceipt
                    ? { borderTop: '2px dotted #000', borderBottom: '2px dotted #000' }
                    : p.is_voided
                      ? { opacity: 0.5 }
                      : {};
                  return (
                    <tr key={i} style={rowStyle}>
                      <td
                        style={{
                          padding: '4px 0',
                          textDecoration: p.is_voided ? 'line-through' : 'none',
                          fontWeight: isCurrentReceipt ? 700 : 'normal',
                        }}
                      >
                        {new Date(p.payment_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td
                        style={{
                          padding: '4px 0',
                          textAlign: 'center',
                          textDecoration: p.is_voided ? 'line-through' : 'none',
                          fontWeight: isCurrentReceipt ? 700 : 'normal',
                        }}
                      >
                        {p.receipt_number}
                        {p.is_voided ? ' (VOID)' : ''}
                        {isCurrentReceipt ? ' ★' : ''}
                      </td>
                      <td
                        style={{
                          padding: '4px 0',
                          textAlign: 'center',
                          textDecoration: p.is_voided ? 'line-through' : 'none',
                          fontWeight: isCurrentReceipt ? 700 : 'normal',
                        }}
                      >
                        {p.term_label || '-'}
                      </td>
                      <td
                        style={{
                          padding: '4px 0',
                          textAlign: 'right',
                          textDecoration: p.is_voided ? 'line-through' : 'none',
                        }}
                      >
                        +{getCurrencySymbol()}
                        {(p.amount_paid_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div
              style={{
                marginTop: '8px',
                padding: '8px',
                border: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600 }}>ACCOUNT BALANCE</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color:
                    currentAmountDue > 0 ? '#dc2626' : currentAmountDue < 0 ? '#16a34a' : '#16a34a',
                }}
              >
                {currentAmountDue > 0
                  ? `-${getCurrencySymbol()}${(currentAmountDue / 100).toFixed(2)}`
                  : currentAmountDue < 0
                    ? `+${getCurrencySymbol()}${Math.abs(currentAmountDue / 100).toFixed(2)}`
                    : `${getCurrencySymbol()}0.00`}
              </span>
            </div>
          </div>
        )}

        {/* Validation Message */}
        <div
          style={{
            fontSize: '10px',
            textAlign: 'center',
            paddingTop: '12px',
            borderTop: '1px dashed #333',
          }}
        >
          <p style={{ margin: '4px 0', fontWeight: 600 }}>
            {isVoided ? '*** THIS PAYMENT HAS BEEN VOIDED ***' : '*** VALID PROOF OF PAYMENT ***'}
          </p>
          <p style={{ margin: '4px 0' }}>Please retain this receipt for your records.</p>
        </div>

        {/* T&Cs Section */}
        <div
          style={{
            fontSize: '9px',
            textAlign: 'left',
            paddingTop: '12px',
            marginTop: '8px',
            borderTop: '1px dashed #333',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>TERMS & CONDITIONS:</div>
          <ul style={{ margin: 0, paddingLeft: '12px', lineHeight: 1.4 }}>
            <li>
              This receipt is valid proof of payment and must be retained for record purposes.
            </li>
            <li>
              All payments are non-refundable unless explicitly approved by school administration.
            </li>
            <li>Payment of school fees does not guarantee enrollment or continued enrollment.</li>
            <li>
              Outstanding fees may result in suspension of classes or exclusion from examinations.
            </li>
            <li>For any queries regarding this receipt, contact the school finance office.</li>
          </ul>
        </div>

        {/* Footer Branding */}
        <div
          style={{
            fontSize: '9px',
            textAlign: 'center',
            paddingTop: '12px',
            marginTop: '12px',
            borderTop: '1px dashed #333',
          }}
        >
          <p style={{ margin: '2px 0' }}>For assistance, contact: {schoolName} Finance Office</p>
          <p style={{ margin: '2px 0' }}>
            Powered by <strong>SchoolFoundry</strong> - A product of{' '}
            <strong>Jiggabyte Technology Limited</strong>
          </p>
          <p style={{ margin: '2px 0', fontStyle: 'italic' }}>www.jiggabyte.co.zm</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceiptPreview;
