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
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
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
      if (schoolAddress.trim()) await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['school_address', schoolAddress]);
      if (schoolPhone.trim()) await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['school_phone', schoolPhone]);
      if (schoolEmail.trim()) await db.run('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['school_email', schoolEmail]);

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
              borderRadius: '24px', 
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              transform: 'rotate(-5deg)'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="wizard-title text-display" style={{ fontSize: '32px', letterSpacing: '-0.02em' }}>Intelligence Scaled.</h2>
            <p className="wizard-subtitle text-display" style={{ maxWidth: 440, margin: '0 auto 32px', fontSize: '16px', lineHeight: '1.6' }}>
              Welcome to FeesFoundry. Let's get your school's financial infrastructure set up in just a few minutes.
            </p>
            <div style={{ 
              backgroundColor: 'var(--secondary)', 
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'left',
              border: '1px solid var(--border)'
            }}>
              <h4 className="text-display" style={{ marginBottom: '16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Onboarding Path:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                    <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>School Identity</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                    <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>Admin Security</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                    <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>Academic Terms</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                    <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>Grade Matrix</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'school':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>Step 01</div>
            <h2 className="wizard-title text-display">School Identity</h2>
            <p className="wizard-subtitle text-display">Enter your school details. This will appear on all legal reports and statements.</p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label className="text-display">Official School Name <span className="required">*</span></label>
                <input
                  className="text-display"
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g., Springfield Elementary School"
                  autoFocus
                />
              </div>
              <div className="wizard-field">
                <label className="text-display">School Address</label>
                <input
                  className="text-display"
                  type="text"
                  value={schoolAddress}
                  onChange={(e) => setSchoolAddress(e.target.value)}
                  placeholder="e.g., 123 Main Street, City, State"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="wizard-field">
                  <label className="text-display">Phone Number</label>
                  <input
                    className="text-display"
                    type="tel"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    placeholder="e.g., +1 (555) 123-4567"
                  />
                </div>
                <div className="wizard-field">
                  <label className="text-display">Email Address</label>
                  <input
                    className="text-display"
                    type="email"
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                    placeholder="e.g., info@school.edu"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>Step 02</div>
            <h2 className="wizard-title text-display">Security Protocol</h2>
            <p className="wizard-subtitle text-display">Establish your primary administrative access credentials.</p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label className="text-display">Full Legal Name <span className="required">*</span></label>
                <input
                  className="text-display"
                  type="text"
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g., John Smith"
                  autoFocus
                />
              </div>
              <div className="wizard-field">
                <label className="text-display">System Username <span className="required">*</span></label>
                <input
                  className="text-mono"
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin_username"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="wizard-field">
                    <label className="text-display">Access Password <span className="required">*</span></label>
                    <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    />
                </div>
                <div className="wizard-field">
                    <label className="text-display">Confirm Password <span className="required">*</span></label>
                    <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    />
                </div>
              </div>
            </div>
          </div>
        );

      case 'academic':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>Step 03</div>
            <h2 className="wizard-title text-display">Academic Infrastructure</h2>
            <p className="wizard-subtitle text-display">Configure your primary academic calendar and grade levels.</p>
            
            <div className="wizard-form">
              <div className="wizard-field">
                <label className="text-display">Current Academic Year <span className="required">*</span></label>
                <input
                  className="text-mono"
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026"
                />
              </div>

              <div className="wizard-field">
                <label className="text-display">Term Configuration</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {terms.map((term, index) => (
                    <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="text-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', width: '20px' }}>{index + 1}</div>
                      <input
                        className="text-display"
                        type="text"
                        value={term}
                        onChange={(e) => updateTerm(index, e.target.value)}
                        placeholder={`Term ${index + 1}`}
                        style={{ flex: 1 }}
                      />
                      {terms.length > 1 && (
                        <button 
                          type="button"
                          className="btn btn-outline" 
                          onClick={() => removeTerm(index)}
                          style={{ padding: '10px' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {terms.length < 4 && (
                    <button 
                      type="button"
                      className="btn btn-outline" 
                      onClick={addTerm}
                      style={{ width: '100%', borderStyle: 'dashed' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Term
                    </button>
                  )}
                </div>
              </div>

              <div className="wizard-field">
                <label className="text-display">Grade Registry</label>
                <div className="chip-list" style={{ marginBottom: '16px' }}>
                  {grades.map((grade, index) => (
                    <span 
                      key={index} 
                      className="chip chip-active text-display"
                      style={{ padding: '6px 12px', gap: '8px' }}
                    >
                      {grade}
                      <button
                        type="button"
                        onClick={() => removeGrade(index)}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    className="text-display"
                    type="text"
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    placeholder="Add custom grade..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGrade())}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button"
                    className="btn btn-primary" 
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
            <div className="wizard-success-icon" style={{ borderRadius: '24px', transform: 'rotate(5deg)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="wizard-title text-display" style={{ fontSize: '32px' }}>Operational.</h2>
            <p className="wizard-subtitle text-display" style={{ maxWidth: 400, margin: '0 auto 32px' }}>
              Your financial infrastructure is ready. Proceed to the dashboard to begin management.
            </p>

            <div className="wizard-quick-actions">
              <div className="wizard-quick-action" onClick={onComplete}>
                <div className="wizard-quick-action-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <div className="wizard-quick-action-content">
                  <div className="wizard-quick-action-title text-display">Initialize Dashboard</div>
                  <div className="wizard-quick-action-desc text-display">View your complete school financial overview</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
