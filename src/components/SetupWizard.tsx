import React, { useState } from 'react';
import bcryptjs from 'bcryptjs';
import { db } from '../lib/db-client';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'school' | 'admin' | 'academic' | 'complete';

const STEPS: { id: Step; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'school', label: 'School Info' },
  { id: 'admin', label: 'Admin Account' },
  { id: 'academic', label: 'Academic Setup' },
  { id: 'complete', label: 'Complete' },
];

const DEFAULT_GRADES = [
  'Kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
];

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [schoolName, setSchoolName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [terms, setTerms] = useState(['Term 1', 'Term 2', 'Term 3']);
  const [grades, setGrades] = useState<string[]>(DEFAULT_GRADES);
  const [newGrade, setNewGrade] = useState('');

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const validateStep = (): boolean => {
    setError('');
    
    switch (currentStep) {
      case 'school':
        if (!schoolName.trim()) {
          setError('Please enter your school name');
          return false;
        }
        break;
      case 'admin':
        if (!adminFullName.trim()) {
          setError('Please enter your full name');
          return false;
        }
        if (!adminUsername.trim()) {
          setError('Please enter a username');
          return false;
        }
        if (adminPassword.length < 4) {
          setError('Password must be at least 4 characters');
          return false;
        }
        if (adminPassword !== confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
        break;
      case 'academic':
        if (!academicYear.trim()) {
          setError('Please enter the academic year');
          return false;
        }
        if (terms.filter(t => t.trim()).length === 0) {
          setError('Please add at least one term');
          return false;
        }
        if (grades.length === 0) {
          setError('Please add at least one grade');
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

  const addTerm = () => {
    if (terms.length < 4) {
      setTerms([...terms, `Term ${terms.length + 1}`]);
    }
  };

  const removeTerm = (index: number) => {
    if (terms.length > 1) {
      setTerms(terms.filter((_, i) => i !== index));
    }
  };

  const updateTerm = (index: number, value: string) => {
    const newTerms = [...terms];
    newTerms[index] = value;
    setTerms(newTerms);
  };

  const addGrade = () => {
    if (newGrade.trim() && !grades.includes(newGrade.trim())) {
      setGrades([...grades, newGrade.trim()]);
      setNewGrade('');
    }
  };

  const removeGrade = (index: number) => {
    if (grades.length > 1) {
      setGrades(grades.filter((_, i) => i !== index));
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError('');

    try {
      // 1. Save school info
      await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['school_name', schoolName]);

      // 2. Create admin user
      const passwordHash = await bcryptjs.hash(adminPassword, 10);
      await db.run(
        'INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)',
        [adminFullName, adminUsername, passwordHash, 'admin']
      );

      // 3. Create academic year
      const yearResult = await db.run('INSERT INTO academic_years (label) VALUES (?)', [academicYear]);
      const yearId = yearResult.lastInsertRowid;

      // 4. Create terms
      for (let i = 0; i < terms.length; i++) {
        if (terms[i].trim()) {
          await db.run('INSERT INTO terms (year_id, label, term_number) VALUES (?, ?, ?)', [yearId, terms[i], i + 1]);
        }
      }

      // 5. Create grades
      for (let i = 0; i < grades.length; i++) {
        await db.run('INSERT INTO grades (label) VALUES (?)', [grades[i]]);
      }

      // 6. Log setup completion
      await db.run(
        'INSERT INTO activity_log (action, entity, details) VALUES (?, ?, ?)',
        ['system_setup', 'app_settings', `Initial setup completed for ${schoolName}`]
      );

      setCurrentStep('complete');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-accent-teal-light)',
              color: 'var(--color-accent-teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="wizard-title">Welcome to School Fees Manager</h2>
            <p className="wizard-subtitle" style={{ maxWidth: 400, margin: '0 auto 24px' }}>
              {"Let's get your school set up in just a few steps. This wizard will guide you through the initial configuration."}
            </p>
            <div style={{ 
              backgroundColor: 'var(--color-sage-cream)', 
              borderRadius: 'var(--border-radius-md)',
              padding: 20,
              textAlign: 'left'
            }}>
              <h4 style={{ marginBottom: 12, fontSize: 14 }}>What we will set up:</h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--color-olive-ink)', fontSize: 14, lineHeight: 1.8 }}>
                <li>Your school information</li>
                <li>Administrator account</li>
                <li>Academic year and terms</li>
                <li>Grade levels</li>
              </ul>
            </div>
          </div>
        );

      case 'school':
        return (
          <div>
            <h2 className="wizard-title">School Information</h2>
            <p className="wizard-subtitle">Enter your school details. This will appear on all reports and statements.</p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label>School Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g., Springfield Elementary School"
                  autoFocus
                />
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div>
            <h2 className="wizard-title">Create Admin Account</h2>
            <p className="wizard-subtitle">Set up your administrator account. You can add more users later.</p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label>Full Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g., John Smith"
                  autoFocus
                />
              </div>
              <div className="wizard-field">
                <label>Username <span className="required">*</span></label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username"
                />
              </div>
              <div className="wizard-field">
                <label>Password <span className="required">*</span></label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password (min 4 characters)"
                />
              </div>
              <div className="wizard-field">
                <label>Confirm Password <span className="required">*</span></label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          </div>
        );

      case 'academic':
        return (
          <div>
            <h2 className="wizard-title">Academic Setup</h2>
            <p className="wizard-subtitle">Configure your academic year, terms, and grade levels.</p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label>Current Academic Year <span className="required">*</span></label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="e.g., 2024"
                />
              </div>

              <div className="wizard-field">
                <label>Terms/Semesters</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {terms.map((term, index) => (
                    <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={term}
                        onChange={(e) => updateTerm(index, e.target.value)}
                        placeholder={`Term ${index + 1}`}
                        style={{ flex: 1 }}
                      />
                      {terms.length > 1 && (
                        <button 
                          type="button"
                          className="btn btn-danger" 
                          onClick={() => removeTerm(index)}
                          style={{ padding: '8px 12px' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {terms.length < 4 && (
                    <button 
                      type="button"
                      className="btn btn-sage" 
                      onClick={addTerm}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      + Add Term
                    </button>
                  )}
                </div>
              </div>

              <div className="wizard-field">
                <label>Grade Levels</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {grades.map((grade, index) => (
                    <span 
                      key={index} 
                      className="chip chip-active"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {grade}
                      <button
                        type="button"
                        onClick={() => removeGrade(index)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'white',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    placeholder="Add custom grade"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGrade())}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button"
                    className="btn btn-sage" 
                    onClick={addGrade}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="wizard-success">
            <div className="wizard-success-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="wizard-title">Setup Complete!</h2>
            <p className="wizard-subtitle">
              Your school is ready to go. Here are some quick actions to get started:
            </p>

            <div className="wizard-quick-actions">
              <div className="wizard-quick-action" onClick={onComplete}>
                <div className="wizard-quick-action-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                  </svg>
                </div>
                <div className="wizard-quick-action-content">
                  <div className="wizard-quick-action-title">Add Students</div>
                  <div className="wizard-quick-action-desc">Start enrolling students in your school</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-sage-placeholder)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>

              <div className="wizard-quick-action" onClick={onComplete}>
                <div className="wizard-quick-action-icon" style={{ backgroundColor: 'var(--color-accent-amber-light)', color: 'var(--color-accent-amber)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div className="wizard-quick-action-content">
                  <div className="wizard-quick-action-title">Set Up Fees</div>
                  <div className="wizard-quick-action-desc">Configure fee structure for each grade</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-sage-placeholder)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>

              <div className="wizard-quick-action" onClick={onComplete}>
                <div className="wizard-quick-action-icon" style={{ backgroundColor: 'var(--color-accent-blue-light)', color: 'var(--color-accent-blue)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <div className="wizard-quick-action-content">
                  <div className="wizard-quick-action-title">Go to Dashboard</div>
                  <div className="wizard-quick-action-desc">View your school overview</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-sage-placeholder)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="layout-wrapper">
      <div className="centered-card-container">
        <div className="wizard-container">
          {/* Progress Steps */}
          {currentStep !== 'complete' && (
            <div className="wizard-progress">
              {STEPS.slice(1, -1).map((step, index) => {
                const stepIndex = index + 1;
                const isActive = currentStepIndex === stepIndex;
                const isCompleted = currentStepIndex > stepIndex;
                
                return (
                  <React.Fragment key={step.id}>
                    {index > 0 && (
                      <div className={`wizard-connector ${isCompleted ? 'completed' : ''}`} />
                    )}
                    <div className={`wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                      <div className="wizard-step-number">
                        {isCompleted ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span className="wizard-step-label">{step.label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Content */}
          <div className="wizard-content">
            {error && (
              <div className="error-message mb-4" style={{ textAlign: 'center' }}>
                {error}
              </div>
            )}
            
            {renderStepContent()}

            {/* Actions */}
            {currentStep !== 'complete' && (
              <div className="wizard-actions">
                {currentStep === 'welcome' ? (
                  <>
                    <div />
                    <button className="btn btn-primary btn-lg" onClick={goNext}>
                      Get Started
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 8 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </>
                ) : currentStep === 'academic' ? (
                  <>
                    <button className="btn btn-outline" onClick={goBack}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      Back
                    </button>
                    <button 
                      className="btn btn-success btn-lg" 
                      onClick={handleComplete}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Setting up...' : 'Complete Setup'}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
