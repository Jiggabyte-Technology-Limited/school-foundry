import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';
import { getCurrencySymbol } from '../lib/currency';
import Receipt from './Receipt';
import PaymentMethodToggle, {
  PaymentMethod,
  getPaymentMethodLabel,
} from './ui/PaymentMethodToggle';

interface PaymentWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  preSelectedStudent?: number;
  yearId?: number;
}

type Step = 'student' | 'payment' | 'confirm';

interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  balance: number;
  is_active: number;
}

interface Term {
  id: number;
  label: string;
}

const PaymentWizard: React.FC<PaymentWizardProps> = ({
  onClose,
  onSuccess,
  preSelectedStudent,
  yearId: propYearId,
}) => {
  const { user, canRecordPayments } = useAuth();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(preSelectedStudent ? 'payment' : 'student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReceipt, setShowReceipt] = useState<any>(null);

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentYear, setCurrentYear] = useState<{ id: number; label: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form data
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    preSelectedStudent || null
  );
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    amount: '',
    receipt_number: '',
    payment_method: 'cash' as PaymentMethod,
    notes: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  if (!canRecordPayments) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to record payments.</p>
      </div>
    );
  }

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetails(selectedStudentId);
    }
  }, [selectedStudentId]);

  const loadInitialData = async () => {
    const yearData = await db.get(
      'SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1'
    );
    setCurrentYear(yearData);

    if (yearData) {
      const [studentList, termList] = await Promise.all([
        db.all(
          `
          SELECT s.id, s.full_name,
            CASE
              WHEN cs.label IS NULL OR cs.label = '' THEN g.label
              ELSE g.label || ' - ' || cs.label
            END as grade_label,
            s.is_active,
            COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf JOIN fee_structure fs ON sf.fee_structure_id = fs.id WHERE sf.student_id = s.id AND fs.year_id = ?), 0) -
            COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
          FROM students s
          JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
          JOIN grades g ON sye.grade_id = g.id
          LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
          WHERE s.is_active = 1
          ORDER BY s.full_name
        `,
          [yearData.id, yearData.id, yearData.id]
        ),
        db.all('SELECT id, label FROM terms WHERE year_id = ? ORDER BY term_number', [yearData.id]),
      ]);

      setStudents(studentList);
      setTerms(termList);

      // Generate unique receipt number
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const receiptNumber = `RCP${timestamp}${random}`;
      setForm(f => ({ ...f, receipt_number: receiptNumber }));

      if (preSelectedStudent) {
        const student = studentList.find(s => s.id === preSelectedStudent);
        if (student) {
          setSelectedStudent(student);
        } else {
          const studentData = await db.get(
            `
            SELECT s.id, s.full_name,
              CASE
                WHEN cs.label IS NULL OR cs.label = '' THEN g.label
                ELSE g.label || ' - ' || cs.label
              END as grade_label,
              s.is_active,
              COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf JOIN fee_structure fs ON sf.fee_structure_id = fs.id WHERE sf.student_id = s.id AND fs.year_id = ?), 0) -
              COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
            FROM students s
            JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
            JOIN grades g ON sye.grade_id = g.id
            LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
            WHERE s.id = ?
          `,
            [yearData.id, yearData.id, yearData.id, preSelectedStudent]
          );
          if (studentData) setSelectedStudent(studentData);
        }
      }
    }
  };

  const loadStudentDetails = async (studentId: number) => {
    // Try to find in current students list first
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      return;
    }

    // If not found (or list empty), fetch from DB
    // Use propYearId if provided, otherwise use currentYear or fetch latest
    let yearId = propYearId || currentYear?.id;
    if (!yearId) {
      const yearData = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
      yearId = yearData?.id;
    }

    if (yearId) {
      const studentData = await db.get(
        `
        SELECT s.id, s.full_name,
          CASE
            WHEN cs.label IS NULL OR cs.label = '' THEN g.label
            ELSE g.label || ' - ' || cs.label
          END as grade_label,
          s.is_active,
          COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf JOIN fee_structure fs ON sf.fee_structure_id = fs.id WHERE sf.student_id = s.id AND fs.year_id = ?), 0) -
          COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
        FROM students s
        JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
        JOIN grades g ON sye.grade_id = g.id
        LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
        WHERE s.id = ?
      `,
        [yearId, yearId, yearId, studentId]
      );
      if (studentData) setSelectedStudent(studentData);
    }
  };

  const filteredStudents = students.filter(
    s =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.id).includes(searchQuery)
  );

  const validateStep = (): boolean => {
    setError('');

    switch (currentStep) {
      case 'student':
        if (!selectedStudentId) {
          setError('Please select a learner');
          return false;
        }
        break;
      case 'payment':
        if (!form.amount || parseFloat(form.amount) <= 0) {
          setError('Please enter a valid amount');
          return false;
        }
        break;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    if (currentStep === 'student') setCurrentStep('payment');
    else if (currentStep === 'payment') setCurrentStep('confirm');
  };

  const goBack = () => {
    if (currentStep === 'confirm') setCurrentStep('payment');
    else if (currentStep === 'payment' && !preSelectedStudent) setCurrentStep('student');
  };

  const handleSubmit = async () => {
    if (!selectedStudent || !currentYear) return;

    // Check if learner is active
    if (selectedStudent.is_active === 0) {
      setError('Cannot record payment for inactive learner');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const amountCents = Math.round(parseFloat(form.amount) * 100);

      // Get the student's current grade for this year
      const enrollment = await db.get(
        'SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
        [selectedStudent.id, currentYear.id]
      );

      if (!enrollment) {
        throw new Error('Learner is not enrolled for the selected academic year.');
      }

      const result = await db.run(
        `
        INSERT INTO payments (
            student_id, 
            year_id, 
            term_id,
            grade_id,
            receipt_number, 
            amount_paid_cents, 
            payment_date, 
            payment_method,
            notes,
            recorded_by
        )
        VALUES (?, ?, NULL, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)
        `,
        [
          selectedStudent.id,
          currentYear.id,
          enrollment.grade_id,
          form.receipt_number,
          amountCents,
          form.payment_method,
          form.notes,
          user?.id || 1,
        ]
      );

      // Log the activity
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          user?.id ?? null,
          user?.username ?? 'System',
          'payment_recorded',
          'payments',
          result.lastInsertRowid || result.lastID,
          `Payment of ${getCurrencySymbol()}${form.amount} recorded for ${selectedStudent.full_name} (${form.receipt_number})`,
        ]
      );

      // Fetch the newly created payment to show receipt
      const newPayment = await db.get(
        `
        SELECT p.id, p.student_id, p.year_id, p.receipt_number, p.amount_paid_cents, p.payment_date, p.is_voided, p.void_reason,
               s.full_name as student_name, s.guardian_name, s.guardian_contact, 
               y.label as year_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.id = ?
      `,
        [result.lastInsertRowid || result.lastID]
      );

      if (newPayment) {
        showToast(
          'success',
          'Payment Recorded',
          `Payment of ${getCurrencySymbol()}${form.amount} recorded for ${selectedStudent.full_name}.`
        );
        setShowReceipt(newPayment);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `${getCurrencySymbol()}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'student':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">1</span>
              Step 1 of 3
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Select Learner
            </h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Search and select the learner to record a payment for.
            </p>

            <div className="wizard-field" style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID..."
                autoFocus
                style={{ padding: '12px 16px' }}
              />
            </div>

            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                border: '1px solid var(--color-sage-border)',
                borderRadius: 'var(--border-radius-md)',
              }}
            >
              {filteredStudents.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--color-sage-placeholder)',
                  }}
                >
                  No learners found
                </div>
              ) : (
                filteredStudents.map(student => (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor:
                        selectedStudentId === student.id
                          ? 'var(--color-accent-teal-light)'
                          : 'transparent',
                      borderBottom: '1px solid var(--color-light-sage)',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {student.full_name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>
                        #{student.id} - {student.grade_label}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: student.balance > 0 ? '#dc2626' : 'var(--color-accent-emerald)',
                        }}
                      >
                        {student.balance > 0 ? `${formatCurrency(student.balance)} due` : 'Paid'}
                      </div>
                    </div>
                    {selectedStudentId === student.id && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-accent-teal)"
                        strokeWidth="3"
                        style={{ marginLeft: 12 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'payment':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">2</span>
              Step {preSelectedStudent ? '1' : '2'} of {preSelectedStudent ? '2' : '3'}
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Payment Details
            </h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Enter the payment information.
            </p>

            {!selectedStudent ? (
              <div
                style={{
                  backgroundColor: 'var(--color-sage-cream)',
                  padding: '24px',
                  borderRadius: 'var(--border-radius-md)',
                  marginBottom: 20,
                  textAlign: 'center',
                  color: 'var(--color-sage-placeholder)',
                }}
              >
                Loading learner records...
              </div>
            ) : (
              <div>
                <div
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e5e5',
                    padding: 16,
                    borderRadius: 'var(--border-radius-md)',
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#000', fontSize: 16 }}>
                      {selectedStudent.full_name}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      {selectedStudent.grade_label} - {currentYear?.label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#666',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Balance
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: selectedStudent.balance > 0 ? '#dc2626' : '#059669',
                      }}
                    >
                      {formatCurrency(selectedStudent.balance)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: 20,
                    padding: '10px 14px',
                    backgroundColor: selectedStudent.balance > 0 ? '#FEE2E2' : '#D1FAE5',
                    borderRadius: 'var(--border-radius-md)',
                    border: `1px solid ${selectedStudent.balance > 0 ? '#FCA5A5' : '#6EE7B7'}`,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={selectedStudent.balance > 0 ? '#991B1B' : '#065F46'}
                    strokeWidth="2"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    {selectedStudent.balance > 0 ? (
                      <>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </>
                    ) : (
                      <>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </>
                    )}
                  </svg>
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: selectedStudent.balance > 0 ? '#991B1B' : '#065F46',
                        fontSize: 14,
                      }}
                    >
                      {selectedStudent.balance > 0 ? 'Owing' : 'Paid'}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: selectedStudent.balance > 0 ? '#B91C1C' : '#047857',
                      }}
                    >
                      {selectedStudent.balance > 0
                        ? `Balance: ${formatCurrency(selectedStudent.balance)}`
                        : 'All fees cleared'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="wizard-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label style={{ color: '#000', fontWeight: 600 }}>
                    Amount <span className="required">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#374151',
                        fontWeight: 600,
                      }}
                    >
                      {getCurrencySymbol()}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      autoFocus
                      style={{
                        paddingLeft: 28,
                        color: '#000',
                        fontWeight: 500,
                        border: '2px solid #000',
                      }}
                    />
                  </div>
                  {selectedStudent && selectedStudent.balance > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, amount: (selectedStudent.balance / 100).toFixed(2) })
                      }
                      style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #F59E0B',
                        borderRadius: 'var(--border-radius-md)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Pay Balance ({formatCurrency(selectedStudent.balance)})
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>Receipt Number</label>
                  <input
                    type="text"
                    value={form.receipt_number}
                    onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                    style={{ backgroundColor: 'var(--color-sage-cream)' }}
                  />
                </div>
                <div className="wizard-field">
                  <PaymentMethodToggle
                    value={form.payment_method}
                    onChange={payment_method => setForm({ ...form, payment_method })}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">3</span>
              Step {preSelectedStudent ? '2' : '3'} of {preSelectedStudent ? '2' : '3'}
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Confirm Payment
            </h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Please review the payment details before confirming.
            </p>

            <div
              style={{
                backgroundColor: 'var(--color-accent-emerald-light)',
                padding: 24,
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-accent-emerald)',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 14, color: 'var(--color-accent-emerald)', marginBottom: 4 }}>
                Payment Amount
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-accent-emerald)' }}>
                {getCurrencySymbol()}
                {parseFloat(form.amount || '0').toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-light-sage)',
                }}
              >
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Learner</span>
                <span style={{ fontWeight: 600 }}>{selectedStudent?.full_name}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-light-sage)',
                }}
              >
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Grade</span>
                <span>{selectedStudent?.grade_label}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-light-sage)',
                }}
              >
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Receipt Number</span>
                <span style={{ fontFamily: 'monospace' }}>{form.receipt_number}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-light-sage)',
                }}
              >
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Payment Method</span>
                <span>{getPaymentMethodLabel(form.payment_method)}</span>
              </div>
              {selectedStudent && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--color-sage-cream)',
                    margin: '0 -20px',
                    padding: '12px 20px',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>New Balance After Payment</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color:
                        selectedStudent.balance - parseFloat(form.amount || '0') * 100 > 0
                          ? '#dc2626'
                          : 'var(--color-accent-emerald)',
                    }}
                  >
                    {formatCurrency(selectedStudent.balance - parseFloat(form.amount || '0') * 100)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content modal-lg"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: 550 }}
        >
          <div className="modal-header">
            <h2>Record Payment</h2>
            <button className="modal-close" onClick={onClose}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="error-message mb-4">{error}</div>}

            {renderStepContent()}

            {/* Actions */}
            <div className="wizard-actions" style={{ marginTop: 24, paddingTop: 20 }}>
              {currentStep === 'student' ? (
                <>
                  <button className="btn btn-outline" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={goNext}
                    disabled={!selectedStudentId}
                  >
                    Continue
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ marginLeft: 8 }}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </>
              ) : currentStep === 'payment' ? (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={preSelectedStudent ? onClose : goBack}
                  >
                    {preSelectedStudent ? (
                      'Cancel'
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ marginRight: 8 }}
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Back
                      </>
                    )}
                  </button>
                  <button className="btn btn-primary" onClick={goNext}>
                    Continue
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ marginLeft: 8 }}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-outline" onClick={goBack}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ marginRight: 8 }}
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back
                  </button>
                  <button
                    className="btn btn-success btn-lg"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Recording...' : 'Confirm Payment'}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ marginLeft: 8 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {showReceipt && (
        <Receipt
          payment={showReceipt}
          onClose={() => {
            setShowReceipt(null);
            onSuccess();
          }}
          canVoid={false}
        />
      )}
    </>
  );
};

export default PaymentWizard;
