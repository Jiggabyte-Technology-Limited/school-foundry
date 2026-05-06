import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

interface PaymentWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  preSelectedStudent?: number;
}

type Step = 'student' | 'payment' | 'confirm';

interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  balance: number;
}

interface Term {
  id: number;
  label: string;
}

const PaymentWizard: React.FC<PaymentWizardProps> = ({ 
  onClose, 
  onSuccess,
  preSelectedStudent 
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(preSelectedStudent ? 'payment' : 'student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentYear, setCurrentYear] = useState<{id: number; label: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form data
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(preSelectedStudent || null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    term_id: '',
    amount: '',
    receipt_number: '',
    payment_method: 'cash',
    notes: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetails(selectedStudentId);
    }
  }, [selectedStudentId]);

  const loadInitialData = async () => {
    const yearData = await db.get('SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1');
    setCurrentYear(yearData);

    if (yearData) {
      const [studentList, termList] = await Promise.all([
        db.all(`
          SELECT s.id, s.full_name, g.label as grade_label,
            COALESCE((SELECT SUM(amount_cents) FROM fee_structure WHERE year_id = ? AND grade_id = sye.grade_id), 0) -
            COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ?), 0) as balance
          FROM students s
          JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
          JOIN grades g ON sye.grade_id = g.id
          WHERE s.is_active = 1
          ORDER BY s.full_name
        `, [yearData.id, yearData.id, yearData.id]),
        db.all('SELECT id, label FROM terms WHERE year_id = ? ORDER BY term_number', [yearData.id])
      ]);
      
      setStudents(studentList);
      setTerms(termList);
      
      if (termList.length > 0) {
        setForm(f => ({ ...f, term_id: String(termList[0].id) }));
      }

      // Generate receipt number
      const lastPayment = await db.get('SELECT receipt_number FROM payments ORDER BY id DESC LIMIT 1');
      const nextNum = lastPayment 
        ? String(parseInt(lastPayment.receipt_number.replace(/\D/g, '') || '0') + 1).padStart(6, '0')
        : '000001';
      setForm(f => ({ ...f, receipt_number: `RCP${nextNum}` }));

      if (preSelectedStudent) {
        loadStudentDetails(preSelectedStudent);
      }
    }
  };

  const loadStudentDetails = async (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
    } else if (currentYear) {
      const studentData = await db.get(`
        SELECT s.id, s.full_name, g.label as grade_label,
          COALESCE((SELECT SUM(amount_cents) FROM fee_structure WHERE year_id = ? AND grade_id = sye.grade_id), 0) -
          COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ?), 0) as balance
        FROM students s
        JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
        JOIN grades g ON sye.grade_id = g.id
        WHERE s.id = ?
      `, [currentYear.id, currentYear.id, currentYear.id, studentId]);
      setSelectedStudent(studentData);
    }
  };

  const filteredStudents = students.filter(s => 
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(s.id).includes(searchQuery)
  );

  const validateStep = (): boolean => {
    setError('');
    
    switch (currentStep) {
      case 'student':
        if (!selectedStudentId) {
          setError('Please select a student');
          return false;
        }
        break;
      case 'payment':
        if (!form.amount || parseFloat(form.amount) <= 0) {
          setError('Please enter a valid amount');
          return false;
        }
        if (!form.term_id) {
          setError('Please select a term');
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
    setIsLoading(true);
    setError('');

    try {
      const amountCents = Math.round(parseFloat(form.amount) * 100);
      
      await db.run(`
        INSERT INTO payments (student_id, year_id, term_id, receipt_number, amount_paid_cents)
        VALUES (?, ?, ?, ?, ?)
      `, [selectedStudentId, currentYear?.id, form.term_id, form.receipt_number, amountCents]);

      await db.run(
        'INSERT INTO activity_log (action, details) VALUES (?, ?)',
        ['payment_recorded', `Payment of $${form.amount} recorded for ${selectedStudent?.full_name} (${form.receipt_number})`]
      );

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getSelectedTermLabel = () => {
    return terms.find(t => t.id === Number(form.term_id))?.label || '';
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Select Student</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Search and select the student to record a payment for.
            </p>
            
            <div className="wizard-field" style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID..."
                autoFocus
                style={{ padding: '12px 16px' }}
              />
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-sage-border)', borderRadius: 'var(--border-radius-md)' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-sage-placeholder)' }}>
                  No students found
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
                      backgroundColor: selectedStudentId === student.id ? 'var(--color-accent-teal-light)' : 'transparent',
                      borderBottom: '1px solid var(--color-light-sage)',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-deep-olive)' }}>
                        {student.full_name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>
                        #{student.id} - {student.grade_label}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600,
                        color: student.balance > 0 ? '#dc2626' : 'var(--color-accent-emerald)'
                      }}>
                        {student.balance > 0 ? `${formatCurrency(student.balance)} due` : 'Paid'}
                      </div>
                    </div>
                    {selectedStudentId === student.id && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-teal)" strokeWidth="3" style={{ marginLeft: 12 }}>
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Payment Details</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Enter the payment information.
            </p>

            {selectedStudent && (
              <div style={{ 
                backgroundColor: 'var(--color-sage-cream)', 
                padding: 16, 
                borderRadius: 'var(--border-radius-md)',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-deep-olive)' }}>
                    {selectedStudent.full_name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>
                    {selectedStudent.grade_label} - {currentYear?.label}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Current Balance</div>
                  <div style={{ 
                    fontSize: 18, 
                    fontWeight: 700,
                    color: selectedStudent.balance > 0 ? '#dc2626' : 'var(--color-accent-emerald)'
                  }}>
                    {formatCurrency(selectedStudent.balance)}
                  </div>
                </div>
              </div>
            )}

            <div className="wizard-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>Amount <span className="required">*</span></label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 12, 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      color: 'var(--color-sage-placeholder)',
                      fontWeight: 600
                    }}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      autoFocus
                      style={{ paddingLeft: 28 }}
                    />
                  </div>
                  {selectedStudent && selectedStudent.balance > 0 && (
                    <button 
                      type="button"
                      onClick={() => setForm({ ...form, amount: (selectedStudent.balance / 100).toFixed(2) })}
                      style={{
                        marginTop: 8,
                        padding: '6px 12px',
                        fontSize: 12,
                        backgroundColor: 'var(--color-accent-teal-light)',
                        color: 'var(--color-accent-teal)',
                        border: 'none',
                        borderRadius: 'var(--border-radius-md)',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Pay Full Balance ({formatCurrency(selectedStudent.balance)})
                    </button>
                  )}
                </div>
                <div className="wizard-field">
                  <label>Term <span className="required">*</span></label>
                  <select
                    value={form.term_id}
                    onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                  >
                    {terms.map(term => (
                      <option key={term.id} value={term.id}>{term.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>Receipt Number</label>
                  <input
                    type="text"
                    value={form.receipt_number}
                    onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                    style={{ backgroundColor: 'var(--color-sage-cream)' }}
                  />
                </div>
                <div className="wizard-field">
                  <label>Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Confirm Payment</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Please review the payment details before confirming.
            </p>
            
            <div style={{ 
              backgroundColor: 'var(--color-accent-emerald-light)', 
              padding: 24, 
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--color-accent-emerald)',
              textAlign: 'center',
              marginBottom: 20
            }}>
              <div style={{ fontSize: 14, color: 'var(--color-accent-emerald)', marginBottom: 4 }}>
                Payment Amount
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-accent-emerald)' }}>
                ${parseFloat(form.amount || '0').toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-light-sage)'
              }}>
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Student</span>
                <span style={{ fontWeight: 600 }}>{selectedStudent?.full_name}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-light-sage)'
              }}>
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Grade</span>
                <span>{selectedStudent?.grade_label}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-light-sage)'
              }}>
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Term</span>
                <span>{getSelectedTermLabel()}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-light-sage)'
              }}>
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Receipt Number</span>
                <span style={{ fontFamily: 'monospace' }}>{form.receipt_number}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid var(--color-light-sage)'
              }}>
                <span style={{ color: 'var(--color-sage-placeholder)' }}>Payment Method</span>
                <span style={{ textTransform: 'capitalize' }}>{form.payment_method}</span>
              </div>
              {selectedStudent && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  backgroundColor: 'var(--color-sage-cream)',
                  margin: '0 -20px',
                  padding: '12px 20px'
                }}>
                  <span style={{ fontWeight: 600 }}>New Balance After Payment</span>
                  <span style={{ 
                    fontWeight: 700,
                    color: (selectedStudent.balance - parseFloat(form.amount || '0') * 100) > 0 
                      ? '#dc2626' 
                      : 'var(--color-accent-emerald)'
                  }}>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
        <div className="modal-header">
          <h2>Record Payment</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message mb-4">
              {error}
            </div>
          )}
          
          {renderStepContent()}

          {/* Actions */}
          <div className="wizard-actions" style={{ marginTop: 24, paddingTop: 20 }}>
            {currentStep === 'student' ? (
              <>
                <button className="btn btn-outline" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={goNext} disabled={!selectedStudentId}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            ) : currentStep === 'payment' ? (
              <>
                <button className="btn btn-outline" onClick={preSelectedStudent ? onClose : goBack}>
                  {preSelectedStudent ? 'Cancel' : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      Back
                    </>
                  )}
                </button>
                <button className="btn btn-primary" onClick={goNext}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-outline" onClick={goBack}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentWizard;
