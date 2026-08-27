import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';
import ChipSelector from './ui/ChipSelector';

interface EditStudentModalProps {
  studentId: number;
  yearId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({
  studentId,
  yearId,
  onClose,
  onSuccess,
}) => {
  const { user, canManageStudents } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [grades, setGrades] = useState<{ id: number; label: string }[]>([]);
  const [subsidyProviders, setSubsidyProviders] = useState<{ id: number; name: string; provider_type: string }[]>([]);

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
    grade_id: '',
    class_section_id: '',
    has_subsidy: false,
    subsidy_provider_id: '',
    subsidy_coverage_type: 'full_100',
    subsidy_coverage_value: '100',
    subsidy_ref: '',
    notes: '',
  });

  // Derived backwards-compat fields
  const full_name = `${form.first_name} ${form.surname}`.trim();
  const guardian_name = `${form.guardian_first_name} ${form.guardian_surname}`.trim();
  const guardian_name_2 = `${form.guardian_first_name_2} ${form.guardian_surname_2}`.trim();
  const [classSections, setClassSections] = useState<{ id: number; grade_id: number; label: string }[]>([]);
  const [newSectionLabel, setNewSectionLabel] = useState('');
  const [enableSubgrades, setEnableSubgrades] = useState(false);

  useEffect(() => {
    loadData();
  }, [studentId]);

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to manage learners.</p>
      </div>
    );
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const setting = await db.get("SELECT value FROM app_settings WHERE key = 'enable_subgrades'");
      const isSubgradesEnabled = setting?.value === 'true';
      setEnableSubgrades(isSubgradesEnabled);

      const [student, gradeList, sectionsData, enrollment, providers, existingSubsidy] = await Promise.all([
        db.get('SELECT * FROM students WHERE id = ?', [studentId]),
        db.all('SELECT id, label FROM grades ORDER BY id'),
        isSubgradesEnabled ? db.all('SELECT id, grade_id, label FROM class_sections ORDER BY label') : Promise.resolve([]),
        db.get(
          'SELECT grade_id, class_section_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
          [studentId, yearId]
        ),
        db.all('SELECT * FROM subsidy_providers ORDER BY name ASC').catch(() => []),
        db.get('SELECT * FROM student_subsidies WHERE student_id = ? AND year_id = ? AND is_active = 1', [studentId, yearId]).catch(() => null),
      ]);

      setSubsidyProviders(providers || []);

      if (student) {
        // Use first_name/surname if available, otherwise split full_name
        const fn = student.first_name || '';
        const sn = student.surname || '';
        setForm({
          first_name: fn || (student.full_name ? student.full_name.split(' ')[0] : ''),
          surname: sn || (student.full_name ? student.full_name.split(' ').slice(1).join(' ') : ''),
          date_of_birth: student.date_of_birth || '',
          gender: student.gender || '',
          is_vulnerable_child: Boolean(student.is_vulnerable_child),
          ovc_category: student.ovc_category || '',
          guardian_first_name: student.guardian_first_name || (student.guardian_name ? student.guardian_name.split(' ')[0] : ''),
          guardian_surname: student.guardian_surname || (student.guardian_name ? student.guardian_name.split(' ').slice(1).join(' ') : ''),
          guardian_contact: student.guardian_contact || '',
          guardian_first_name_2: student.guardian_first_name_2 || (student.guardian_name_2 ? student.guardian_name_2.split(' ')[0] : ''),
          guardian_surname_2: student.guardian_surname_2 || (student.guardian_name_2 ? student.guardian_name_2.split(' ').slice(1).join(' ') : ''),
          guardian_contact_2: student.guardian_contact_2 || '',
          guardian_email: student.guardian_email || '',
          grade_id: enrollment ? String(enrollment.grade_id) : '',
          class_section_id: enrollment && enrollment.class_section_id ? String(enrollment.class_section_id) : '',
          has_subsidy: Boolean(existingSubsidy),
          subsidy_provider_id: existingSubsidy ? String(existingSubsidy.provider_id) : '',
          subsidy_coverage_type: existingSubsidy ? existingSubsidy.coverage_type : 'full_100',
          subsidy_coverage_value: existingSubsidy ? String(existingSubsidy.coverage_value) : '100',
          subsidy_ref: existingSubsidy ? existingSubsidy.grant_reference_number || '' : '',
          notes: student.notes || '',
        });
      }
      setGrades(gradeList);
      setClassSections(sectionsData);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load learner data');
    } finally {
      setIsLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.surname || !form.guardian_first_name || !form.guardian_surname || !form.guardian_contact) {
      setError('Please fill in all required fields');
      return;
    }
    if (enableSubgrades && form.grade_id && !form.class_section_id) {
      setError('Please select a class section');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Update student details
      await db.run(
        `
        UPDATE students SET
          full_name = ?, first_name = ?, surname = ?,
          date_of_birth = ?, gender = ?,
          is_vulnerable_child = ?, ovc_category = ?,
          guardian_name = ?, guardian_first_name = ?, guardian_surname = ?, guardian_contact = ?,
          guardian_name_2 = ?, guardian_first_name_2 = ?, guardian_surname_2 = ?, guardian_contact_2 = ?,
          guardian_email = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
        [
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
          form.notes || null,
          studentId,
        ]
      );

      // Handle subsidy
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
            yearId,
            form.subsidy_coverage_type,
            coverageVal,
            form.is_vulnerable_child
              ? `OVC Category ${form.ovc_category || 'Safeguarded'}`
              : 'Educational Subsidy / Grant',
            form.subsidy_ref || '',
            user?.id ?? null,
          ]
        );
      } else {
        await db.run(
          'UPDATE student_subsidies SET is_active = 0 WHERE student_id = ? AND year_id = ?',
          [studentId, yearId]
        );
      }

      // Update enrollment if grade is provided
      if (form.grade_id) {
        const existingEnrollment = await db.get(
          'SELECT id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
          [studentId, yearId]
        );

        const classSectionValue = enableSubgrades && form.class_section_id ? Number(form.class_section_id) : null;

        if (existingEnrollment) {
          await db.run('UPDATE student_year_enrollment SET grade_id = ?, class_section_id = ? WHERE id = ?', [
            form.grade_id,
            classSectionValue,
            existingEnrollment.id,
          ]);
        } else {
          await db.run(
            'INSERT INTO student_year_enrollment (student_id, year_id, grade_id, class_section_id) VALUES (?, ?, ?, ?)',
            [studentId, yearId, form.grade_id, classSectionValue]
          );
        }
      }

      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          user?.id ?? null,
          user?.username ?? 'System',
          'student_updated',
          'students',
          studentId,
          `Updated student details for: ${full_name}`,
        ]
      );

      showToast('success', 'Learner Updated', `${full_name}'s details have been updated.`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update learner');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="modal-overlay">
        <div
          className="modal-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
          }}
        >
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-lg"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 700 }}
      >
        <div className="modal-header">
          <h2 className="text-display">Edit Learner Profile</h2>
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="error-message mb-4">{error}</div>}

            <div className="wizard-form">
              <h3
                className="text-display"
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  marginBottom: '16px',
                  color: 'var(--primary)',
                }}
              >
                Personal Information
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>
                    Name(s) <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-default"
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    placeholder="First name(s)"
                  />
                </div>
                <div className="wizard-field">
                  <label>
                    Surname <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-default"
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
                                  className="input-default"
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

              <div className="wizard-field">
                <ChipSelector
                  label="Grade Level *"
                  value={form.grade_id ? Number(form.grade_id) : null}
                  onChange={value => setForm({ ...form, grade_id: value ? String(value) : '', class_section_id: '' })}
                  options={grades.map(g => ({ value: g.id, label: g.label }))}
                />
              </div>

              {enableSubgrades && form.grade_id && (
                <div className="wizard-field">
                  <label>Class Section / Subgrade <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="input-default"
                      value={form.class_section_id}
                      onChange={e => setForm({ ...form, class_section_id: e.target.value })}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select Class Section</option>
                      {classSections
                        .filter(s => s.grade_id === Number(form.grade_id))
                        .map(section => (
                          <option key={section.id} value={section.id}>
                            {section.label}
                          </option>
                        ))}
                    </select>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        className="input-default"
                        style={{ width: '120px' }}
                        placeholder="New (e.g. A)"
                        value={newSectionLabel}
                        onChange={e => setNewSectionLabel(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddSection}
                        className="btn btn-outline"
                        style={{ padding: '0 12px' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Child Safeguarding & Subsidy Card */}
              <div
                style={{
                  marginTop: 20,
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 12,
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      🛡️ Child Safeguarding & Educational Subsidy
                    </span>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Flag students on government grants, bursaries, or scholarships to shield them from fee lockouts and exclusion.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="edit_has_subsidy_toggle"
                    checked={form.has_subsidy}
                    onChange={e => setForm({ ...form, has_subsidy: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                </div>

                {form.has_subsidy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <div className="wizard-field">
                      <label>Sponsoring Entity / Grant Provider</label>
                      <select
                        value={form.subsidy_provider_id}
                        onChange={e => setForm({ ...form, subsidy_provider_id: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
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
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
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
                          className="input-default"
                          placeholder="e.g. CDF/2026/042"
                          value={form.subsidy_ref}
                          onChange={e => setForm({ ...form, subsidy_ref: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <input
                        type="checkbox"
                        id="edit_is_vulnerable_child_toggle"
                        checked={form.is_vulnerable_child}
                        onChange={e => setForm({ ...form, is_vulnerable_child: e.target.checked })}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <label htmlFor="edit_is_vulnerable_child_toggle" style={{ fontSize: 13, cursor: 'pointer', color: '#065f46', fontWeight: 600 }}>
                        Mark as Vulnerable Child / OVC (Enforce permanent anti-exclusion protocol)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <h3
                className="text-display"
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  margin: '24px 0 16px',
                  color: 'var(--primary)',
                }}
              >
                Guardian Information
              </h3>

              <div
                style={{
                  backgroundColor: 'var(--secondary)',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>
                      Guardian Name(s) <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_first_name}
                      onChange={e => setForm({ ...form, guardian_first_name: e.target.value })}
                      placeholder="First name(s)"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>
                      Guardian Surname <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_surname}
                      onChange={e => setForm({ ...form, guardian_surname: e.target.value })}
                      placeholder="Surname"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>
                      Contact Number <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      className="input-default"
                      value={form.guardian_contact}
                      onChange={e => setForm({ ...form, guardian_contact: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--secondary)',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>Secondary Guardian Name(s)</label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_first_name_2}
                      onChange={e => setForm({ ...form, guardian_first_name_2: e.target.value })}
                      placeholder="First name(s)"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Secondary Guardian Surname</label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_surname_2}
                      onChange={e => setForm({ ...form, guardian_surname_2: e.target.value })}
                      placeholder="Surname"
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Secondary Contact</label>
                    <input
                      type="tel"
                      className="input-default"
                      value={form.guardian_contact_2}
                      onChange={e => setForm({ ...form, guardian_contact_2: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="wizard-field">
                <label>Guardian Email</label>
                <input
                  type="email"
                  className="input-default"
                  value={form.guardian_email}
                  onChange={e => setForm({ ...form, guardian_email: e.target.value })}
                />
              </div>

              <div className="wizard-field">
                <label>Internal Notes</label>
                <textarea
                  className="input-default"
                  style={{ minHeight: '80px', paddingTop: '8px' }}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional information about the learner..."
                />
              </div>
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              padding: '20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Update Learner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStudentModal;
