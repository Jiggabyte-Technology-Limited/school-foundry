import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';
import ChipSelector from './ui/ChipSelector';

interface StudentWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  currentYearId?: number;
  preSelectedGrade?: number;
  preSelectedClassSection?: number;
}

type Step = 'details' | 'guardian' | 'enrollment' | 'confirm';

const STEPS: { id: Step; label: string; icon: React.ReactElement }[] = [
  {
    id: 'details',
    label: 'Student Details',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 'guardian',
    label: 'Guardian Info',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'enrollment',
    label: 'Enrollment',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'confirm',
    label: 'Confirm',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

const StudentWizard: React.FC<StudentWizardProps> = ({
  onClose,
  onSuccess,
  currentYearId,
  preSelectedGrade,
  preSelectedClassSection,
}) => {
  const { user, canManageStudents } = useAuth();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [grades, setGrades] = useState<{ id: number; label: string }[]>([]);
  const [classSections, setClassSections] = useState<{ id: number; grade_id: number; label: string }[]>([]);
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [enableSubgrades, setEnableSubgrades] = useState(false);
  const [currentYear, setCurrentYear] = useState<{ id: number; label: string } | null>(null);
  const [subsidyProviders, setSubsidyProviders] = useState<{ id: number; name: string; provider_type: string }[]>([]);

  // Form data
  const [form, setForm] = useState({
    first_name: '',
    surname: '',
    date_of_birth: '',
    gender: '',
    is_vulnerable_child: false,
    ovc_category: '',
    guardian_first_name: '',
    guardian_surname: '',
    guardian_contact: '',
    guardian_first_name_2: '',
    guardian_surname_2: '',
    guardian_contact_2: '',
    guardian_email: '',
    grade_id: preSelectedGrade ? String(preSelectedGrade) : '',
    class_section_id: preSelectedClassSection ? String(preSelectedClassSection) : '',
    has_subsidy: false,
    subsidy_provider_id: '',
    subsidy_coverage_type: 'full_100',
    subsidy_coverage_value: '100',
    subsidy_ref: '',
  });

  // Derived: full_name for backwards compat
  const full_name = `${form.first_name} ${form.surname}`.trim();
  const guardian_name = `${form.guardian_first_name} ${form.guardian_surname}`.trim();
  const guardian_name_2 = `${form.guardian_first_name_2} ${form.guardian_surname_2}`.trim();

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
    const setting = await db.get("SELECT value FROM app_settings WHERE key = 'enable_subgrades'");
    const isSubgradesEnabled = setting?.value === 'true';
    setEnableSubgrades(isSubgradesEnabled);

    const [gradeList, sectionsData, yearData, providers] = await Promise.all([
      db.all('SELECT id, label FROM grades ORDER BY id'),
      isSubgradesEnabled ? db.all('SELECT id, grade_id, label FROM class_sections ORDER BY label') : Promise.resolve([]),
      currentYearId
        ? db.get('SELECT id, label FROM academic_years WHERE id = ?', [currentYearId])
        : db.get('SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1'),
      db.all('SELECT * FROM subsidy_providers ORDER BY name ASC').catch(() => []),
    ]);
    setGrades(gradeList);
    setClassSections(sectionsData);
    setCurrentYear(yearData);
    setSubsidyProviders(providers || []);

    if (preSelectedGrade) {
      setForm(f => ({ 
        ...f, 
        grade_id: String(preSelectedGrade),
        class_section_id: preSelectedClassSection ? String(preSelectedClassSection) : ''
      }));
    }
  };

  const handleAddSection = async () => {
    if (!newSectionLabel.trim() || !form.grade_id) return;
    try {
      const result = await db.run(
        'INSERT INTO class_sections (grade_id, label) VALUES (?, ?)',
        [form.grade_id, newSectionLabel.trim()]
      );
      const newSection = {
        id: result.lastInsertRowid || result.lastID,
        grade_id: Number(form.grade_id),
        label: newSectionLabel.trim()
      };
      setClassSections([...classSections, newSection]);
      setForm({ ...form, class_section_id: String(newSection.id) });
      setNewSectionLabel('');
    } catch (err) {
      console.error('Error adding section:', err);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const validateStep = (): boolean => {
    setError('');

    switch (currentStep) {
      case 'details':
        if (!form.first_name.trim() || !form.surname.trim()) {
          setError('Please enter the student name and surname');
          return false;
        }
        break;
      case 'guardian':
        if (!form.guardian_first_name.trim() || !form.guardian_surname.trim()) {
          setError('Please enter the primary guardian name and surname');
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
        if (enableSubgrades && !form.class_section_id) {
          setError('Please select a class section');
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
      // Generate unique student number (STU + year + random 4 digits)
      const studentNumber = `STU${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;

      // Add new student
      const result = await db.run(
        `
        INSERT INTO students (student_number, full_name, first_name, surname, date_of_birth, gender,
          is_vulnerable_child, ovc_category,
          guardian_name, guardian_first_name, guardian_surname, guardian_contact,
          guardian_name_2, guardian_first_name_2, guardian_surname_2, guardian_contact_2, guardian_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          studentNumber,
          full_name,
          form.first_name,
          form.surname,
          form.date_of_birth || null,
          form.gender || null,
          form.is_vulnerable_child ? 1 : 0,
          form.ovc_category || null,
          guardian_name,
          form.guardian_first_name,
          form.guardian_surname,
          form.guardian_contact,
          guardian_name_2 || null,
          form.guardian_first_name_2 || null,
          form.guardian_surname_2 || null,
          form.guardian_contact_2 || null,
          form.guardian_email || null,
        ]
      );

      // Create enrollment for current year
      if (form.grade_id && currentYear && result.lastInsertRowid) {
        const studentId = result.lastInsertRowid;
        await db.run(
          'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id) VALUES (?, ?, ?, ?)',
          [studentId, currentYear.id, form.grade_id, form.class_section_id || null]
        );

        // Record active subsidy if selected
        if (form.has_subsidy && form.subsidy_provider_id) {
          const coverageVal =
            form.subsidy_coverage_type === 'full_100'
              ? 100
              : form.subsidy_coverage_type === 'percentage'
                ? Math.max(1, Math.min(100, Number(form.subsidy_coverage_value) || 100))
                : Math.round(Number(form.subsidy_coverage_value || 0) * 100);

          await db.run(
            `INSERT OR REPLACE INTO student_subsidies (
              student_id, provider_id, year_id, term_id, coverage_type,
              coverage_value, application_reason, grant_reference_number,
              is_active, prevent_academic_exclusion, created_by
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 1, 1, ?)`,
            [
              studentId,
              Number(form.subsidy_provider_id),
              currentYear.id,
              form.subsidy_coverage_type,
              coverageVal,
              form.is_vulnerable_child
                ? `OVC Category ${form.ovc_category || 'Safeguarded'}`
                : 'Educational Subsidy / Grant',
              form.subsidy_ref || '',
              user?.id ?? null,
            ]
          );
        }

        const today = new Date().toISOString().split('T')[0];
        // Get enrollment date to only debit terms that start on or after enrollment
        const enrollment = await db.get(
          'SELECT created_at FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
          [studentId, currentYear.id]
        );
        const enrolledDate = enrollment?.created_at ? enrollment.created_at.split('T')[0] : today;

        const activeFees = await db.all(
          `
          SELECT fs.id, fs.amount_cents, t.start_date
          FROM fee_structure fs
          JOIN terms t ON fs.term_id = t.id
          WHERE fs.year_id = ?
            AND fs.grade_id = ?
            AND t.start_date IS NOT NULL
            AND date(t.start_date) <= date(?)
            AND (t.end_date IS NULL OR date(t.end_date) >= date(?))
        `,
          [currentYear.id, form.grade_id, today, enrolledDate]
        );

        for (const fee of activeFees) {
          await db.run(
            'INSERT OR IGNORE INTO student_fees (student_id, fee_structure_id, debit_date, amount_cents) VALUES (?, ?, ?, ?)',
            [studentId, fee.id, today, fee.amount_cents]
          );
        }
      }

      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          user?.id ?? null,
          user?.username ?? 'System',
          'student_added',
          'students',
          result.lastInsertRowid || result.lastID,
          `Added new student: ${full_name}`,
        ]
      );

      showToast('success', 'Student Added', `${full_name} has been successfully enrolled.`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add student. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedGradeLabel = () => {
    const grade = grades.find(g => g.id === Number(form.grade_id))?.label || '';
    const section = classSections.find(c => c.id === Number(form.class_section_id))?.label || '';
    return section ? `${grade} - ${section}` : grade;
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Student Details
            </h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Enter the basic information about the student.
            </p>

            <div className="wizard-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>
                    Name(s) <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    placeholder="First name(s)"
                    autoFocus
                  />
                </div>
                <div className="wizard-field">
                  <label>
                    Surname <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.surname}
                    onChange={e => setForm({ ...form, surname: e.target.value })}
                    placeholder="Surname"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="wizard-field">
                  <ChipSelector
                    label="Gender"
                    value={form.gender || null}
                    onChange={value => setForm({ ...form, gender: (value as string) || '' })}
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Guardian Information
            </h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              {"Enter the parent or guardian's contact details."}
            </p>

            <div className="wizard-form">
              <div
                style={{
                  backgroundColor: 'var(--color-sage-cream)',
                  padding: 16,
                  borderRadius: 'var(--border-radius-md)',
                  marginBottom: 16,
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Primary Guardian
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>
                      Name(s) <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.guardian_first_name}
                      onChange={e => setForm({ ...form, guardian_first_name: e.target.value })}
                      placeholder="First name(s)"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>
                      Surname <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.guardian_surname}
                      onChange={e => setForm({ ...form, guardian_surname: e.target.value })}
                      placeholder="Surname"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>
                      Contact <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.guardian_contact}
                      onChange={e => setForm({ ...form, guardian_contact: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-sage-cream)',
                  padding: 16,
                  borderRadius: 'var(--border-radius-md)',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 12px',
                    fontSize: 14,
                    color: 'var(--color-sage-placeholder)',
                  }}
                >
                  Secondary Guardian (Optional)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>Name(s)</label>
                    <input
                      type="text"
                      value={form.guardian_first_name_2}
                      onChange={e => setForm({ ...form, guardian_first_name_2: e.target.value })}
                      placeholder="First name(s)"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Surname</label>
                    <input
                      type="text"
                      value={form.guardian_surname_2}
                      onChange={e => setForm({ ...form, guardian_surname_2: e.target.value })}
                      placeholder="Surname"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Contact</label>
                    <input
                      type="tel"
                      value={form.guardian_contact_2}
                      onChange={e => setForm({ ...form, guardian_contact_2: e.target.value })}
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
                  onChange={e => setForm({ ...form, guardian_email: e.target.value })}
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Enrollment
            </h2>
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
                <label>
                  Grade Level <span className="required">*</span>
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 8,
                  }}
                >
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => setForm({ ...form, grade_id: String(grade.id), class_section_id: '' })}
                      style={{
                        padding: '12px 16px',
                        border:
                          form.grade_id === String(grade.id)
                            ? '2px solid var(--color-accent-teal)'
                            : '1px solid var(--color-sage-border)',
                        borderRadius: 'var(--border-radius-md)',
                        backgroundColor:
                          form.grade_id === String(grade.id)
                            ? 'var(--color-accent-teal-light)'
                            : 'white',
                        color:
                          form.grade_id === String(grade.id)
                            ? 'var(--color-accent-teal)'
                            : 'var(--color-olive-ink)',
                        fontWeight: form.grade_id === String(grade.id) ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                    >
                      {grade.label}
                    </button>
                  ))}
                </div>
              </div>

              {enableSubgrades && form.grade_id && (
                <div className="wizard-field" style={{ marginTop: '16px' }}>
                  <label>
                    Class Section <span className="required">*</span>
                  </label>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {classSections.filter(c => c.grade_id === Number(form.grade_id)).map(section => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setForm({ ...form, class_section_id: String(section.id) })}
                        style={{
                          padding: '12px 16px',
                          border:
                            form.class_section_id === String(section.id)
                              ? '2px solid var(--color-accent-teal)'
                              : '1px solid var(--color-sage-border)',
                          borderRadius: 'var(--border-radius-md)',
                          backgroundColor:
                            form.class_section_id === String(section.id)
                              ? 'var(--color-accent-teal-light)'
                              : 'white',
                          color:
                            form.class_section_id === String(section.id)
                              ? 'var(--color-accent-teal)'
                              : 'var(--color-olive-ink)',
                          fontWeight: form.class_section_id === String(section.id) ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'center',
                        }}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input 
                      type="text" 
                      placeholder="New Section (e.g. 1A)"
                      value={newSectionLabel}
                      onChange={e => setNewSectionLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSection();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button"
                      className="btn btn-outline"
                      onClick={handleAddSection}
                      disabled={!newSectionLabel.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Child Safeguarding & Subsidy Card */}
              <div
                style={{
                  marginTop: 24,
                  padding: 16,
                  borderRadius: 12,
                  background: 'var(--color-sage-cream, #f9fafb)',
                  border: '1px solid var(--color-sage-border, #e5e7eb)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary, #111827)' }}>
                      🛡️ Child Safeguarding & Educational Subsidy
                    </span>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)', margin: '2px 0 0 0' }}>
                      Flag students on government grants, bursaries, or scholarships to shield them from fee lockouts and exclusion.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="has_subsidy_toggle"
                    checked={form.has_subsidy}
                    onChange={e => setForm({ ...form, has_subsidy: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#f97316' }}
                  />
                </div>

                {form.has_subsidy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    <div className="wizard-field">
                      <label>Sponsoring Entity / Grant Provider</label>
                      <select
                        value={form.subsidy_provider_id}
                        onChange={e => setForm({ ...form, subsidy_provider_id: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' }}
                      >
                        <option value="">Select Grant / Scholarship Provider...</option>
                        {subsidyProviders.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.provider_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="wizard-field">
                        <label>Coverage Level</label>
                        <select
                          value={form.subsidy_coverage_type}
                          onChange={e => setForm({ ...form, subsidy_coverage_type: e.target.value as any })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white' }}
                        >
                          <option value="full_100">100% Full Tuition Grant</option>
                          <option value="percentage">Percentage (Partial)</option>
                          <option value="fixed_amount">Fixed Amount</option>
                        </select>
                      </div>

                      <div className="wizard-field">
                        <label>Grant / Bursary Reference Number</label>
                        <input
                          type="text"
                          placeholder="e.g. CDF/2026/042"
                          value={form.subsidy_ref}
                          onChange={e => setForm({ ...form, subsidy_ref: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        id="is_vulnerable_child_toggle"
                        checked={form.is_vulnerable_child}
                        onChange={e => setForm({ ...form, is_vulnerable_child: e.target.checked })}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <label htmlFor="is_vulnerable_child_toggle" style={{ fontSize: 13, cursor: 'pointer', color: '#065f46', fontWeight: 600 }}>
                        Mark as Vulnerable Child / OVC (Enforce permanent anti-exclusion protocol)
                      </label>
                    </div>
                  </div>
                )}
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
            <h2 className="wizard-title" style={{ textAlign: 'left', fontSize: 20 }}>
              Confirm Details
            </h2>
            <p className="wizard-subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
              Please review the information before adding this student.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  backgroundColor: 'var(--color-sage-cream)',
                  padding: 16,
                  borderRadius: 'var(--border-radius-md)',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Student Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                      Name
                    </span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{full_name}</p>
                  </div>
                  {form.date_of_birth && (
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                        Date of Birth
                      </span>
                      <p style={{ margin: '4px 0 0' }}>
                        {(() => {
                          const age = calculateAge(form.date_of_birth);
                          return `${new Date(form.date_of_birth).toLocaleDateString()}${age !== null ? ` (${age} yr${age === 1 ? '' : 's'})` : ''}`;
                        })()}
                      </p>
                    </div>
                  )}
                  {form.gender && (
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                        Gender
                      </span>
                      <p style={{ margin: '4px 0 0', textTransform: 'capitalize' }}>
                        {form.gender}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-sage-cream)',
                  padding: 16,
                  borderRadius: 'var(--border-radius-md)',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Guardian Information
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                      Guardian(s)
                    </span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                      {guardian_name}
                      {guardian_name_2 && `, ${guardian_name_2}`}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                      {form.guardian_contact}
                      {form.guardian_contact_2 && `, ${form.guardian_contact_2}`}
                    </p>
                  </div>
                  {form.guardian_email && (
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                        Email
                      </span>
                      <p style={{ margin: '4px 0 0' }}>{form.guardian_email}</p>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--color-accent-teal-light)',
                  padding: 16,
                  borderRadius: 'var(--border-radius-md)',
                  border: '1px solid var(--color-accent-teal)',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--color-accent-teal)' }}>
                  Enrollment
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                      Academic Year
                    </span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{currentYear?.label}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-sage-placeholder)' }}>
                      Grade
                    </span>
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
      <div
        className="modal-content modal-lg"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 600 }}
      >
        <div className="modal-header">
            <h2>Add New Student</h2>
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

        {/* Progress Steps */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            backgroundColor: 'var(--color-sage-cream)',
            borderBottom: '1px solid var(--color-sage-border)',
            overflow: 'hidden',
          }}
        >
          {STEPS.map((step, index) => {
            const isActive = currentStepIndex === index;
            const isCompleted = currentStepIndex > index;

            return (
              <React.Fragment key={step.id}>
                {index > 0 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor: isCompleted
                        ? 'var(--color-accent-emerald)'
                        : 'var(--color-sage-border)',
                      margin: '0 8px',
                    }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: isActive
                      ? 'var(--color-accent-teal)'
                      : isCompleted
                        ? 'var(--color-accent-emerald)'
                        : 'var(--color-sage-placeholder)',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isActive
                        ? 'var(--color-accent-teal)'
                        : isCompleted
                          ? 'var(--color-accent-emerald)'
                          : 'var(--color-sage-cream)',
                      color: isActive || isCompleted ? 'white' : 'var(--color-sage-placeholder)',
                      border:
                        isActive || isCompleted ? 'none' : '1px solid var(--color-sage-border)',
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
                      step.icon
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      display: index < 2 || isActive ? 'block' : 'none',
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="modal-body">
          {error && <div className="error-message mb-4">{error}</div>}

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
            ) : currentStep === 'confirm' ? (
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
                  {isLoading ? 'Adding Student...' : 'Add Student'}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentWizard;
