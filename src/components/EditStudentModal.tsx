import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

interface EditStudentModalProps {
  studentId: number;
  yearId: number;
  onClose: () => void;
  onSuccess: () => void;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({ studentId, yearId, onClose, onSuccess }) => {
  const { user, canManageStudents } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [grades, setGrades] = useState<{ id: number; label: string }[]>([]);
  
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    guardian_name: '',
    guardian_contact: '',
    guardian_name_2: '',
    guardian_contact_2: '',
    guardian_email: '',
    grade_id: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [studentId]);

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to manage students.</p>
      </div>
    );
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [student, gradeList, enrollment] = await Promise.all([
        db.get('SELECT * FROM students WHERE id = ?', [studentId]),
        db.all('SELECT id, label FROM grades ORDER BY id'),
        db.get('SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?', [studentId, yearId])
      ]);

      if (student) {
        setForm({
          full_name: student.full_name || '',
          date_of_birth: student.date_of_birth || '',
          gender: student.gender || '',
          guardian_name: student.guardian_name || '',
          guardian_contact: student.guardian_contact || '',
          guardian_name_2: student.guardian_name_2 || '',
          guardian_contact_2: student.guardian_contact_2 || '',
          guardian_email: student.guardian_email || '',
          grade_id: enrollment ? String(enrollment.grade_id) : '',
          notes: student.notes || ''
        });
      }
      setGrades(gradeList);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load student data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.guardian_name || !form.guardian_contact) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Update student details
      await db.run(`
        UPDATE students SET
          full_name = ?, date_of_birth = ?, gender = ?,
          guardian_name = ?, guardian_contact = ?,
          guardian_name_2 = ?, guardian_contact_2 = ?,
          guardian_email = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [
        form.full_name, form.date_of_birth || null, form.gender || null,
        form.guardian_name, form.guardian_contact,
        form.guardian_name_2 || null, form.guardian_contact_2 || null,
        form.guardian_email || null, form.notes || null, studentId
      ]);

      // Update enrollment if grade is provided
      if (form.grade_id) {
        const existingEnrollment = await db.get(
          'SELECT id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
          [studentId, yearId]
        );

        if (existingEnrollment) {
          await db.run(
            'UPDATE student_year_enrollment SET grade_id = ? WHERE id = ?',
            [form.grade_id, existingEnrollment.id]
          );
        } else {
          await db.run(
            'INSERT INTO student_year_enrollment (student_id, year_id, grade_id) VALUES (?, ?, ?)',
            [studentId, yearId, form.grade_id]
          );
        }
      }

      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'student_updated', 'students', studentId, `Updated student details for: ${form.full_name}`]
      );

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update student');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2 className="text-display">Edit Student Profile</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="error-message mb-4">{error}</div>}

            <div className="wizard-form">
              <h3 className="text-display" style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>Personal Information</h3>
              
              <div className="wizard-field">
                <label>Full Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="input-default"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Enter student's full name"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="wizard-field">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    className="input-default"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  />
                </div>
                <div className="wizard-field">
                  <label>Gender</label>
                  <select
                    className="input-default"
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

              <div className="wizard-field">
                <label>Grade Level <span className="required">*</span></label>
                <select
                  className="input-default"
                  value={form.grade_id}
                  onChange={(e) => setForm({ ...form, grade_id: e.target.value })}
                >
                  <option value="">Select grade</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <h3 className="text-display" style={{ fontSize: '16px', fontWeight: 700, margin: '24px 0 16px', color: 'var(--primary)' }}>Guardian Information</h3>
              
              <div style={{ backgroundColor: 'var(--secondary)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>Primary Guardian Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_name}
                      onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Contact Number <span className="required">*</span></label>
                    <input
                      type="tel"
                      className="input-default"
                      value={form.guardian_contact}
                      onChange={(e) => setForm({ ...form, guardian_contact: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--secondary)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="wizard-field">
                    <label>Secondary Guardian Name</label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_name_2}
                      onChange={(e) => setForm({ ...form, guardian_name_2: e.target.value })}
                    />
                  </div>
                  <div className="wizard-field">
                    <label>Secondary Contact</label>
                    <input
                      type="tel"
                      className="input-default"
                      value={form.guardian_contact_2}
                      onChange={(e) => setForm({ ...form, guardian_contact_2: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                />
              </div>

              <div className="wizard-field">
                <label>Internal Notes</label>
                <textarea
                  className="input-default"
                  style={{ minHeight: '80px', paddingTop: '8px' }}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional information about the student..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Update Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStudentModal;
