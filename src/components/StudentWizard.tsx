import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

interface StudentWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  currentYearId?: number;
  preSelectedGrade?: number;
}

type Step = 'details' | 'guardian' | 'enrollment' | 'confirm';

const STEPS: { id: Step; label: string; icon: React.ReactElement }[] = [
  { 
    id: 'details', 
    label: 'Student Details',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  },
  { 
    id: 'guardian', 
    label: 'Guardian Info',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  },
  { 
    id: 'enrollment', 
    label: 'Enrollment',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  },
  { 
    id: 'confirm', 
    label: 'Confirm',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
  },
];

const StudentWizard: React.FC<StudentWizardProps> = ({ 
  onClose, 
  onSuccess, 
  currentYearId,
  preSelectedGrade 
}) => {
  const { user, canManageStudents } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [grades, setGrades] = useState<{id: number; label: string}[]>([]);
  const [currentYear, setCurrentYear] = useState<{id: number; label: string} | null>(null);

  // Form data
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_contact: '',
    guardian_name_2: '',
    guardian_contact_2: '',
    guardian_email: '',
    grade_id: preSelectedGrade ? String(preSelectedGrade) : '',
  });

  useEffect(() => {
    loadData();
  }, []);

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to manage students.</p>
      </div>
    );
  }

  const loadData = async () => {
    const [gradeList, yearData] = await Promise.all([
      db.all('SELECT id, label FROM grades ORDER BY id'),
      currentYearId 
        ? db.get('SELECT id, label FROM academic_years WHERE id = ?', [currentYearId])
        : db.get('SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1'),
    ]);
    setGrades(gradeList);
    setCurrentYear(yearData);
    
    if (preSelectedGrade) {
      setForm(f => ({ ...f, grade_id: String(preSelectedGrade) }));
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const validateStep = (): boolean => {
    setError('');
    
    switch (currentStep) {
      case 'details':
        if (!form.full_name.trim()) {
          setError('Please enter the student name');
          return false;
        }
        break;
      case 'guardian':
        if (!form.guardian_name.trim()) {
          setError('Please enter the primary guardian name');
          return false;
        }
        if (!form.guardian_contact.trim()) {
          setError('Please enter the guardian contact number');
          return false;
        }
        break;
      case 'enrollment':
        if (!form.grade_id) {
          setError('Please select a grade');
          return false;
        }
        break;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Add new student
      const result = await db.run(`
        INSERT INTO students (full_name, date_of_birth, gender, guardian_name, guardian_contact, guardian_name_2, guardian_contact_2, guardian_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        form.full_name, form.date_of_birth || null, form.gender || null,
        form.guardian_name, form.guardian_contact,
        form.guardian_name_2 || null, form.guardian_contact_2 || null,
        form.guardian_email || null
      ]);

      // Create enrollment for current year
      if (form.grade_id && currentYear && result.lastInsertRowid) {
        await db.run(
          'INSERT INTO student_year_enrollment (student_id, year_id, grade_id) VALUES (?, ?, ?)',
          [result.lastInsertRowid, currentYear.id, form.grade_id]
        );
      }

      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'student_added', 'students', result.lastInsertRowid || result.lastID, `Added new student: ${form.full_name}`]
      );

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add student. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedGradeLabel = () => {
    return grades.find(g => g.id === Number(form.grade_id))?.label || '';
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'details':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">1</span>
              Step 1 of 4
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Student Details</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Enter the basic information about the student.
            </p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label>Full Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Enter student's full name"
                  autoFocus
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="wizard-field">
                  <label>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case 'guardian':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">2</span>
              Step 2 of 4
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Guardian Information</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              {"Enter the parent or guardian's contact details."}
            </p>
            
            <div className="wizard-form">
              <div style={{ 
                backgroundColor: 'var(--color-sage-cream)', 
                padding: 16, 
                borderRadius: 'var(--border-radius-md)',
                marginBottom: 16
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Primary Guardian
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>Name <span className="required">*</span></label>
                    <input
                      type="text"
                      value={form.guardian_name}
                      onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                      placeholder="Guardian's full name"
                      autoFocus
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Contact <span className="required">*</span></label>
                    <input
                      type="tel"
                      value={form.guardian_contact}
                      onChange={(e) => setForm({ ...form, guardian_contact: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </div>

              <div style={{ 
                backgroundColor: 'var(--color-sage-cream)', 
                padding: 16, 
                borderRadius: 'var(--border-radius-md)'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-sage-placeholder)' }}>
                  Secondary Guardian (Optional)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>Name</label>
                    <input
                      type="text"
                      value={form.guardian_name_2}
                      onChange={(e) => setForm({ ...form, guardian_name_2: e.target.value })}
                      placeholder="Secondary guardian name"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Contact</label>
                    <input
                      type="tel"
                      value={form.guardian_contact_2}
                      onChange={(e) => setForm({ ...form, guardian_contact_2: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </div>

              <div className="wizard-field">
                <label>Email Address (Optional)</label>
                <input
                  type="email"
                  value={form.guardian_email}
                  onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                  placeholder="guardian@email.com"
                />
              </div>
            </div>
          </div>
        );

      case 'enrollment':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">3</span>
              Step 3 of 4
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Enrollment</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Select the grade level for this student.
            </p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label>Academic Year</label>
                <input
                  type="text"
                  value={currentYear?.label || ''}
                  disabled
                  style={{ backgroundColor: 'var(--color-sage-cream)', cursor: 'not-allowed' }}
                />
                <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', marginTop: 4 }}>
                  Students are automatically enrolled in the current academic year
                </p>
              </div>
              
              <div className="wizard-field">
                <label>Grade Level <span className="required">*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => setForm({ ...form, grade_id: String(grade.id) })}
                      style={{
                        padding: '12px 16px',
                        border: form.grade_id === String(grade.id) 
                          ? '2px solid var(--color-accent-teal)' 
                          : '1px solid var(--color-sage-border)',
                        borderRadius: 'var(--border-radius-md)',
                        backgroundColor: form.grade_id === String(grade.id) 
                          ? 'var(--color-accent-teal-light)' 
                          : 'white',
                        color: form.grade_id === String(grade.id) 
                          ? 'var(--color-accent-teal)' 
                          : 'var(--color-olive-ink)',
                        fontWeight: form.grade_id === String(grade.id) ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center'
                      }}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div>
            <div className="step-indicator">
              <span className="step-indicator-number">4</span>
              Step 4 of 4
            </div>
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>Confirm Details</h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Please review the information before adding this student.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ 
                backgroundColor: 'var(--color-sage-cream)', 
                padding: 16, 
                borderRadius: 'var(--border-radius-md)'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Student Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Name</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{form.full_name}</p>
                  </div>
                  {form.date_of_birth && (
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Date of Birth</span>
                      <p style={{ margin: '4px 0 0' }}>{new Date(form.date_of_birth).toLocaleDateString()}</p>
                    </div>
                  )}
                  {form.gender && (
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Gender</span>
                      <p style={{ margin: '4px 0 0', textTransform: 'capitalize' }}>{form.gender}</p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ 
                backgroundColor: 'var(--color-sage-cream)', 
                padding: 16, 
                borderRadius: 'var(--border-radius-md)'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Guardian Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Guardian(s)</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                      {form.guardian_name}
                      {form.guardian_name_2 && `, ${form.guardian_name_2}`}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                      {form.guardian_contact}
                      {form.guardian_contact_2 && `, ${form.guardian_contact_2}`}
                    </p>
                  </div>
                  {form.guardian_email && (
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Email</span>
                      <p style={{ margin: '4px 0 0' }}>{form.guardian_email}</p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ 
                backgroundColor: 'var(--color-accent-teal-light)', 
                padding: 16, 
                borderRadius: 'var(--border-radius-md)',
                border: '1px solid var(--color-accent-teal)'
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Enrollment
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Academic Year</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{currentYear?.label}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>Grade</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{getSelectedGradeLabel()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2>Add New Student</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '16px 20px',
          backgroundColor: 'var(--color-sage-cream)',
          borderBottom: '1px solid var(--color-sage-border)',
          overflow: 'hidden'
        }}>
          {STEPS.map((step, index) => {
            const isActive = currentStepIndex === index;
            const isCompleted = currentStepIndex > index;
            
            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: isCompleted ? 'var(--color-accent-emerald)' : 'var(--color-sage-border)',
                    margin: '0 8px'
                  }} />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: isActive ? 'var(--color-accent-teal)' : isCompleted ? 'var(--color-accent-emerald)' : 'var(--color-sage-placeholder)',
                  flexShrink: 0
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? 'var(--color-accent-teal)' : isCompleted ? 'var(--color-accent-emerald)' : 'var(--color-sage-cream)',
                    color: isActive || isCompleted ? 'white' : 'var(--color-sage-placeholder)',
                    border: isActive || isCompleted ? 'none' : '1px solid var(--color-sage-border)'
                  }}>
                    {isCompleted ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      step.icon
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, display: index < 2 || isActive ? 'block' : 'none' }}>
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
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
            {currentStep === 'details' ? (
              <>
                <button className="btn btn-outline" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={goNext}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            ) : currentStep === 'confirm' ? (
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
                  {isLoading ? 'Adding Student...' : 'Add Student'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                    <polyline points="20 6 9 17 4 12" />
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
                <button className="btn btn-primary" onClick={goNext}>
                  Continue
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                    <polyline points="9 18 15 12 9 6" />
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

export default StudentWizard;
