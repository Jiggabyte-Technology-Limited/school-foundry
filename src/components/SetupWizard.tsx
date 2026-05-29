import React, { useState } from 'react';
import bcryptjs from 'bcryptjs';
import { db } from '../lib/db-client';

interface SetupWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'school' | 'admin' | 'periods' | 'fees' | 'complete';

const STEPS: { id: Step; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'school', label: 'School Info' },
  { id: 'admin', label: 'Admin Account' },
  { id: 'periods', label: 'Payment Periods' },
  { id: 'fees', label: 'Fee Setup' },
  { id: 'complete', label: 'Complete' },
];

type PeriodType = 'terms' | 'month' | 'quarter' | 'half_year' | 'custom';

interface PaymentPeriod {
  term_number: number;
  label: string;
  start_date: string;
  end_date: string;
}

interface GradeFee {
  grade: string;
  amounts: Record<number, string>;
  copyToAll?: boolean;
}

const DEFAULT_GRADES = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  'Form 1',
  'Form 2',
  'Form 3',
  'Form 4',
  'Form 5',
  'Form 6',
];

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // Form data
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolWebsite, setSchoolWebsite] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [periodType, setPeriodType] = useState<PeriodType>('terms');
  const [customPeriodCount, setCustomPeriodCount] = useState(3);
  const [periods, setPeriods] = useState<PaymentPeriod[]>([]);
  const [grades, setGrades] = useState<string[]>(DEFAULT_GRADES);
  const [newGrade, setNewGrade] = useState('');
  const [gradeFees, setGradeFees] = useState<GradeFee[]>([]);

  // Initialize periods on mount
  React.useEffect(() => {
    setPeriods(generatePeriods('terms'));
  }, []);

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
      case 'periods':
        if (!academicYear.trim()) {
          setError('Please enter the academic year');
          return false;
        }
        if (periods.length === 0) {
          setError('Please add at least one payment period');
          return false;
        }
        break;
      case 'fees':
        if (grades.length === 0) {
          setError('Please add at least one grade');
          return false;
        }
        for (const grade of grades) {
          const gradeFee = gradeFees.find(f => f.grade === grade);
          const hasAmount = periods.some(p => gradeFee?.amounts?.[p.term_number]);
          if (!hasAmount) {
            setError(`Please enter fees for ${grade}`);
            return false;
          }
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

  const generatePeriods = (type: PeriodType, customNum?: number): PaymentPeriod[] => {
    const baseYear = parseInt(academicYear) || new Date().getFullYear();
    const labels: string[] = [];
    let count = 0;

    if (type === 'month') {
      labels.push(
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
      );
      count = 12;
    } else if (type === 'quarter') {
      count = 4;
      for (let i = 1; i <= count; i++) labels.push(`Quarter ${i}`);
    } else if (type === 'half_year') {
      labels.push('1st Half', '2nd Half');
      count = 2;
    } else if (type === 'terms') {
      count = customNum || 3;
      for (let i = 1; i <= count; i++) labels.push(`Term ${i}`);
    } else {
      count = customNum || 3;
      for (let i = 1; i <= count; i++) labels.push(`Period ${i}`);
    }

    const getDates = (index: number): { start: string; end: string } => {
      if (type === 'month') {
        const start = new Date(baseYear, index, 1);
        const end = new Date(baseYear, index + 1, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      } else if (type === 'quarter') {
        const start = new Date(baseYear, index * 3, 1);
        const end = new Date(baseYear, (index + 1) * 3, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      } else if (type === 'half_year') {
        const start = new Date(baseYear, index * 6, 1);
        const end = new Date(baseYear, (index + 1) * 6, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      } else {
        const monthsPer = Math.floor(12 / count);
        const start = new Date(baseYear, index * monthsPer, 1);
        const end =
          index === count - 1
            ? new Date(baseYear, 11, 31)
            : new Date(baseYear, (index + 1) * monthsPer, 0);
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
      }
    };

    return labels.map((label, i) => {
      const { start, end } = getDates(i);
      return { term_number: i + 1, label, start_date: start, end_date: end };
    });
  };

  const handlePeriodTypeChange = (type: PeriodType) => {
    setPeriodType(type);
    setPeriods(generatePeriods(type, type === 'custom' ? customPeriodCount : undefined));
  };

  const handlePeriodChange = (index: number, field: keyof PaymentPeriod, value: string) => {
    setPeriods(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCustomCountChange = (count: number) => {
    setCustomPeriodCount(count);
    setPeriods(generatePeriods('custom', count));
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
      await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
        'school_name',
        schoolName,
      ]);
      if (schoolAddress.trim())
        await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
          'school_address',
          schoolAddress,
        ]);
      if (schoolPhone.trim())
        await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
          'school_phone',
          schoolPhone,
        ]);
      if (schoolEmail.trim())
        await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
          'school_email',
          schoolEmail,
        ]);
      if (schoolWebsite.trim())
        await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
          'school_website',
          schoolWebsite,
        ]);
      if (schoolLogo)
        await db.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [
          'school_logo',
          schoolLogo,
        ]);

      // 2. Create admin user
      const passwordHash = await bcryptjs.hash(adminPassword, 10);
      await db.run(
        'INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)',
        [adminFullName, adminUsername, passwordHash, 'admin']
      );

      // 3. Create academic year
      const yearResult = await db.run('INSERT OR IGNORE INTO academic_years (label) VALUES (?)', [
        academicYear,
      ]);
      // If year already exists (IGNORE), we would need to query it. But setup runs on fresh DB. 
      // If it fails, we fall back. Let's just keep INSERT for the rest, except maybe users:
      
      // Wait, just the app_settings are usually populated or causing uniqueness conflicts if a user hit 'Complete Setup' and it failed midway (e.g. at user creation).
      // Let's also use INSERT OR IGNORE for the initial user.
      const yearId = yearResult.lastInsertRowid || (await db.get('SELECT id FROM academic_years WHERE label = ?', [academicYear])).id;

      // 4. Create terms with dates and period type
      for (const p of periods) {
        await db.run(
          'INSERT OR IGNORE INTO terms (year_id, label, term_number, period_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
          [yearId, p.label, p.term_number, periodType, p.start_date || null, p.end_date || null]
        );
      }

      // 5. Get term IDs for fee structure
      const termList = await db.all('SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [
        yearId,
      ]);

      // 6. Create grades and fee structure
      const gradeIds: Record<string, number> = {};
      for (let i = 0; i < grades.length; i++) {
        const gradeResult = await db.run('INSERT OR IGNORE INTO grades (label) VALUES (?)', [grades[i]]);
        gradeIds[grades[i]] = gradeResult.lastInsertRowid || (await db.get('SELECT id FROM grades WHERE label = ?', [grades[i]])).id;
      }

      // 7. Create fee structure
      for (const grade of grades) {
        const gradeId = gradeIds[grade];
        const gradeFee = gradeFees.find(f => f.grade === grade);

        for (const term of termList) {
          const feeAmount = Math.round(
            parseFloat(gradeFee?.amounts?.[term.term_number] || '0') * 100
          );
          await db.run(
            'INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, same_amount_all_periods) VALUES (?, ?, ?, ?, ?, ?)',
            [yearId, term.id, gradeId, 'tuition', feeAmount, 0]
          );
        }
      }

      // Log setup completion
      await db.run('INSERT INTO activity_log (action, entity, details) VALUES (?, ?, ?)', [
        'system_setup',
        'app_settings',
        `Initial setup completed for ${schoolName}`,
      ]);

      setCurrentStep('complete');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during setup. Please try again.');
      setIsLoading(false);
    }
  };

  const handleImportDatabase = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await window.api.fsRestore();
      if (result) {
        setImportSuccess(true);
        // Give user a moment to see the success state, then relaunch
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        // User cancelled the file dialog
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to import database. Please try again.');
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            {/* Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '9999px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                marginBottom: '24px',
                fontSize: '13px',
                fontFamily: 'monospace',
                margin: '0 auto 24px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  animation: 'pulse 2s infinite',
                }}
              ></span>
              Initial Setup
            </div>

            <h2
              style={{
                fontSize: '36px',
                fontWeight: 500,
                margin: '0 0 8px 0',
                color: 'var(--text-secondary)',
              }}
            >
              Welcome to
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <img
                src="./img/schoolfoundry-logo.svg"
                alt="SchoolFoundry"
                style={{ height: '48px', width: 'auto' }}
              />
              <h1
                style={{
                  fontSize: '56px',
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: '-2px',
                  lineHeight: 1,
                }}
              >
                School<span style={{ fontWeight: 400 }}>Foundry</span>
              </h1>
            </div>

            <p
              style={{
                fontSize: '18px',
                color: 'var(--text-secondary)',
                marginBottom: '32px',
                maxWidth: '500px',
                lineHeight: 1.6,
                margin: '0 auto 32px',
              }}
            >
              Let's get your school's financial infrastructure set up in just a few minutes.
            </p>
            <div
              style={{
                backgroundColor: 'var(--secondary)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'left',
                border: '1px solid var(--border)',
                width: '100%',
                maxWidth: '520px',
                margin: '0 auto',
              }}
            >
              <h4
                className="text-display"
                style={{
                  marginBottom: '16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                }}
              >
                Onboarding Path:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                  <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>
                    School Identity
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                  <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>
                    Admin Security
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                  <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>
                    Payment Periods
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                  <span className="text-display" style={{ fontSize: '14px', fontWeight: 500 }}>
                    Fee Structure
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'school':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>
              Step 01
            </div>
            <h2 className="wizard-title text-display">School Identity</h2>
            <p className="wizard-subtitle text-display">
              Enter your school details. This will appear on all legal reports and statements.
            </p>

            <div className="wizard-form">
              {/* Logo Upload */}
              <div className="wizard-field" style={{ marginBottom: '24px' }}>
                <label className="text-display">School Logo (Optional)</label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div
                    onClick={() => document.getElementById('school-logo-input')?.click()}
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '12px',
                      border: '2px dashed var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: schoolLogo ? 'transparent' : 'var(--surface)',
                      overflow: 'hidden',
                    }}
                  >
                    {schoolLogo ? (
                      <img
                        src={schoolLogo}
                        alt="School Logo"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--text-secondary)"
                          strokeWidth="2"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            marginTop: '4px',
                          }}
                        >
                          Upload
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    id="school-logo-input"
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = event => {
                          setSchoolLogo(event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        margin: '0 0 8px 0',
                      }}
                    >
                      Upload your school logo to display on reports and receipts.
                    </p>
                    {schoolLogo && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setSchoolLogo(null);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="wizard-field">
                <label className="text-display">
                  Official School Name <span className="required">*</span>
                </label>
                <input
                  className="text-display"
                  type="text"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
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
                  onChange={e => setSchoolAddress(e.target.value)}
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
                    onChange={e => setSchoolPhone(e.target.value)}
                    placeholder="e.g., +1 (555) 123-4567"
                  />
                </div>
                <div className="wizard-field">
                  <label className="text-display">Email Address</label>
                  <input
                    className="text-display"
                    type="email"
                    value={schoolEmail}
                    onChange={e => setSchoolEmail(e.target.value)}
                    placeholder="e.g., info@school.edu"
                  />
                </div>
              </div>
              <div className="wizard-field">
                <label className="text-display">School Website</label>
                <input
                  className="text-display"
                  type="url"
                  value={schoolWebsite}
                  onChange={e => setSchoolWebsite(e.target.value)}
                  placeholder="e.g., https://www.school.edu (optional)"
                />
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>
              Step 02
            </div>
            <h2 className="wizard-title text-display">Security Protocol</h2>
            <p className="wizard-subtitle text-display">
              Establish your primary administrative access credentials.
            </p>

            <div className="wizard-form">
              <div className="wizard-field">
                <label className="text-display">
                  Full Legal Name <span className="required">*</span>
                </label>
                <input
                  className="text-display"
                  type="text"
                  value={adminFullName}
                  onChange={e => setAdminFullName(e.target.value)}
                  placeholder="e.g., John Smith"
                  autoFocus
                />
              </div>
              <div className="wizard-field">
                <label className="text-display">
                  System Username <span className="required">*</span>
                </label>
                <input
                  className="text-mono"
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  placeholder="admin_username"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="wizard-field">
                  <label className="text-display">
                    Access Password <span className="required">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="wizard-field">
                  <label className="text-display">
                    Confirm Password <span className="required">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'periods':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>
              Step 03
            </div>
            <h2 className="wizard-title text-display">Payment Periods</h2>
            <p className="wizard-subtitle text-display">
              Configure when payments are due throughout the year.
            </p>

            <div className="wizard-form">
              <div className="wizard-field">
                <label className="text-display">
                  Academic Year <span className="required">*</span>
                </label>
                <input
                  className="text-mono"
                  type="text"
                  value={academicYear}
                  onChange={e => {
                    setAcademicYear(e.target.value);
                    setPeriods(generatePeriods(periodType));
                  }}
                  placeholder="2026"
                />
              </div>

              <div className="wizard-field">
                <label className="text-display">Payment Period Type</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  {[
                    { id: 'terms', label: 'Terms' },
                    { id: 'month', label: 'Monthly' },
                    { id: 'quarter', label: 'Quarterly' },
                    { id: 'half_year', label: 'Half Year' },
                    { id: 'custom', label: 'Custom' },
                  ].map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handlePeriodTypeChange(type.id as PeriodType)}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        border:
                          periodType === type.id
                            ? '2px solid var(--primary)'
                            : '2px solid var(--border)',
                        background:
                          periodType === type.id ? 'rgba(249, 115, 22, 0.1)' : 'var(--surface)',
                        color: periodType === type.id ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                {(periodType === 'terms' || periodType === 'custom') && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Number of {periodType === 'terms' ? 'terms' : 'periods'}:
                    </span>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      value={customPeriodCount}
                      onChange={e => handleCustomCountChange(parseInt(e.target.value) || 3)}
                      style={{
                        width: '60px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '2px solid var(--border)',
                        background: 'var(--surface)',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="wizard-field">
                <label className="text-display">Periods</label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                  }}
                >
                  {periods.map((period, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 1.5fr 1fr 1fr',
                        gap: '16px',
                        alignItems: 'center',
                        padding: '16px',
                        background: 'var(--secondary)',
                        borderRadius: '12px',
                      }}
                    >
                      <div
                        className="text-mono"
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {index + 1}
                      </div>
                      <input
                        className="text-display"
                        type="text"
                        value={period.label}
                        onChange={e => handlePeriodChange(index, 'label', e.target.value)}
                        placeholder="Period name"
                        style={{ fontSize: '13px' }}
                      />
                      <input
                        className="text-mono"
                        type="date"
                        value={period.start_date}
                        onChange={e => handlePeriodChange(index, 'start_date', e.target.value)}
                        style={{ fontSize: '12px', padding: '8px' }}
                      />
                      <input
                        className="text-mono"
                        type="date"
                        value={period.end_date}
                        onChange={e => handlePeriodChange(index, 'end_date', e.target.value)}
                        style={{ fontSize: '12px', padding: '8px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'fees':
        return (
          <div>
            <div className="metric-label" style={{ textAlign: 'center' }}>
              Step 04
            </div>
            <h2 className="wizard-title text-display">Fee Structure</h2>
            <p className="wizard-subtitle text-display">
              Set up school fees for each grade. You can set the same amount for all grades or
              customize per grade.
            </p>

            <div className="wizard-form">
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
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
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
                    onChange={e => setNewGrade(e.target.value)}
                    placeholder="Add custom grade..."
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addGrade())}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-primary" onClick={addGrade}>
                    Add
                  </button>
                </div>
              </div>

              <div className="wizard-field">
                <label className="text-display">Fee Structure</label>
                <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '13px',
                      minWidth: '500px',
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: 'left',
                            padding: '10px 8px',
                            borderBottom: '2px solid var(--border)',
                            borderRight: '2px solid var(--border)',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            position: 'sticky',
                            left: 0,
                            background: 'var(--surface)',
                            zIndex: 10,
                            background: 'var(--surface)',
                            width: '120px',
                          }}
                        >
                          Grade/Form
                        </th>
                        <th
                          style={{
                            textAlign: 'center',
                            padding: '10px 8px',
                            borderBottom: '2px solid var(--border)',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            background: 'var(--surface)',
                            width: '50px',
                          }}
                        >
                          Copy All
                        </th>
                        {periods.map((period, idx) => (
                          <th
                            key={idx}
                            style={{
                              textAlign: 'center',
                              padding: '10px 8px',
                              borderBottom: '2px solid var(--border)',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              background: 'var(--surface)',
                              minWidth: '100px',
                            }}
                          >
                            {period.label}
                          </th>
                        ))}
                        <th
                          style={{
                            textAlign: 'center',
                            padding: '10px 8px',
                            borderBottom: '2px solid var(--border)',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            background: 'var(--surface)',
                            width: '90px',
                          }}
                        >
                          Year Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map(grade => {
                        const gradeFee = gradeFees.find(f => f.grade === grade) || {
                          grade,
                          amounts: {},
                          copyToAll: undefined,
                        };
                        const total = periods.reduce(
                          (sum, p) =>
                            sum + (parseFloat(gradeFee.amounts?.[p.term_number] || '0') || 0),
                          0
                        );
                        return (
                          <tr key={grade} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td
                              style={{
                                padding: '6px 8px',
                                fontWeight: 500,
                                position: 'sticky',
                                left: 0,
                                background: 'var(--background)',
                                borderRight: '2px solid var(--border)',
                              }}
                            >
                              {grade}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={gradeFee.copyToAll === true}
                                onChange={e => {
                                  const newFees = [...gradeFees];
                                  const existingIdx = newFees.findIndex(f => f.grade === grade);
                                  const firstAmount = newFees[existingIdx]?.amounts?.[1] || '';
                                  if (existingIdx >= 0) {
                                    newFees[existingIdx] = {
                                      ...newFees[existingIdx],
                                      copyToAll: e.target.checked,
                                      amounts: e.target.checked
                                        ? Object.fromEntries(
                                            periods.map(p => [p.term_number, firstAmount])
                                          )
                                        : newFees[existingIdx].amounts,
                                    };
                                  } else if (e.target.checked) {
                                    newFees.push({
                                      grade,
                                      copyToAll: true,
                                      amounts: Object.fromEntries(
                                        periods.map(p => [p.term_number, ''])
                                      ),
                                    });
                                  }
                                  setGradeFees(newFees);
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                title="Copy first period amount to all periods"
                              />
                            </td>
                            {periods.map(period => (
                              <td
                                key={period.term_number}
                                style={{ padding: '4px 4px', textAlign: 'center' }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '1px',
                                  }}
                                >
                                  <span
                                    style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
                                  >
                                    $
                                  </span>
                                  <input
                                    className="text-display"
                                    type="number"
                                    step="0.01"
                                    value={gradeFee.amounts?.[period.term_number] || ''}
                                    onChange={e => {
                                      const newFees = [...gradeFees];
                                      const existingIdx = newFees.findIndex(f => f.grade === grade);
                                      const updatedAmounts = {
                                        ...(newFees[existingIdx]?.amounts || {}),
                                        [period.term_number]: e.target.value,
                                      };
                                      if (existingIdx >= 0) {
                                        newFees[existingIdx] = {
                                          ...newFees[existingIdx],
                                          amounts: updatedAmounts,
                                        };
                                        if (
                                          newFees[existingIdx].copyToAll &&
                                          period.term_number === 1
                                        ) {
                                          newFees[existingIdx].amounts = Object.fromEntries(
                                            periods.map(p => [p.term_number, e.target.value])
                                          );
                                        }
                                      } else {
                                        newFees.push({
                                          grade,
                                          amounts: { [period.term_number]: e.target.value },
                                        });
                                      }
                                      setGradeFees(newFees);
                                    }}
                                    placeholder="0"
                                    style={{
                                      width: '80px',
                                      padding: '6px 8px',
                                      fontSize: '13px',
                                      textAlign: 'right',
                                    }}
                                  />
                                </div>
                              </td>
                            ))}
                            <td
                              style={{
                                padding: '6px 8px',
                                textAlign: 'center',
                                fontWeight: 600,
                                color: 'var(--primary)',
                              }}
                            >
                              ${total.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="wizard-success">
            <div
              className="wizard-success-icon"
              style={{ borderRadius: '24px', transform: 'rotate(5deg)' }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="wizard-title text-display" style={{ fontSize: '32px' }}>
              Operational.
            </h2>
            <p
              className="wizard-subtitle text-display"
              style={{ maxWidth: 400, margin: '0 auto 32px' }}
            >
              Your financial infrastructure is ready. Proceed to the dashboard to begin management.
            </p>

            <div className="wizard-quick-actions">
              <div className="wizard-quick-action" onClick={onComplete}>
                <div className="wizard-quick-action-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <div className="wizard-quick-action-content">
                  <div className="wizard-quick-action-title text-display">Open System</div>
                  <div className="wizard-quick-action-desc text-display">
                    Start using your school management system
                  </div>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--background)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Elements */}
      <div
        style={{
          position: 'absolute',
          right: '-5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(249,115,22,0.06), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(20,184,166,0.04), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Progress Navbar */}
      {currentStep !== 'complete' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'transparent',
            padding: '20px 40px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              maxWidth: '800px',
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Progress Line Background */}
            <div
              style={{
                position: 'absolute',
                top: '18px',
                left: '10%',
                right: '10%',
                height: '2px',
                background: 'var(--border)',
                zIndex: 0,
              }}
            />
            {/* Progress Line Active */}
            <div
              style={{
                position: 'absolute',
                top: '18px',
                left: '10%',
                height: '2px',
                background: 'var(--primary)',
                zIndex: 1,
                width: currentStepIndex <= 1 ? '0%' : `${((currentStepIndex - 1) / 3) * 80}%`,
                transition: 'width 0.3s ease',
              }}
            />
            {STEPS.slice(1, -1).map((step, index) => {
              const stepIndex = index + 1;
              const isActive = currentStepIndex === stepIndex;
              const isCompleted = currentStepIndex > stepIndex;

              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    position: 'relative',
                    zIndex: 2,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: isActive || isCompleted ? 'var(--primary)' : 'var(--surface)',
                      color: isActive || isCompleted ? 'white' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      border: isActive ? '3px solid var(--primary)' : '2px solid var(--border)',
                      boxShadow: isActive ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {isCompleted ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content - Single Column Layout */}
      <div
        style={{
          maxWidth: 'none',
          margin: '0 auto',
          padding: currentStep !== 'complete' ? '84px 40px 56px' : '0 40px',
          width: '100%',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            gap: '0',
            width: '100%',
            minHeight: currentStep === 'complete' ? 'auto' : 'calc(100vh - 140px)',
          }}
        >
          {/* Main Wizard Form Container */}
          <div
            style={{
              width: '100%',
              maxWidth: currentStep === 'fees' ? '1280px' : '760px',
              margin: '0 auto',
            }}
          >
            <div style={{ background: 'transparent', boxShadow: 'none', padding: '0' }}>
              {/* Content */}
              <div style={{ padding: '0' }}>
                {error && (
                  <div className="error-message mb-4" style={{ textAlign: 'center' }}>
                    {error}
                  </div>
                )}

                {renderStepContent()}

                {/* Actions */}
                {currentStep !== 'complete' && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginTop: '32px',
                      gap: '16px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {currentStep !== 'welcome' && (
                      <button
                        className="btn btn-outline"
                        onClick={goBack}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Back
                      </button>
                    )}
                    {currentStep === 'welcome' && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
                        <button
                          className="btn btn-primary btn-lg"
                          onClick={goNext}
                          disabled={isLoading}
                          style={{ padding: '16px 48px', fontSize: '16px' }}
                        >
                          Get Started
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
                        <button
                          className="btn btn-outline btn-lg"
                          onClick={handleImportDatabase}
                          disabled={isLoading}
                          style={{ padding: '16px 32px', fontSize: '16px', display: 'flex', alignItems: 'center' }}
                        >
                          {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.3" />
                                <path d="M21 12a9 9 0 00-9-9" />
                              </svg>
                              Importing...
                            </span>
                          ) : importSuccess ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Success!
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              Import Database
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                    {currentStep === 'fees' && (
                      <button
                        className="btn btn-success btn-lg"
                        onClick={handleComplete}
                        disabled={isLoading}
                        style={{ padding: '16px 48px', fontSize: '16px' }}
                      >
                        {isLoading ? 'Setting up...' : 'Complete Setup'}
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
                    )}
                    {currentStep !== 'welcome' && currentStep !== 'fees' && (
                      <button
                        className="btn btn-primary"
                        onClick={goNext}
                        style={{ padding: '14px 32px' }}
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Spinning Globe & Feature Cards) removed for perfect centering of welcome content */}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
