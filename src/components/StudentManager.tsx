import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import StudentWizard from './StudentWizard';
import ChipSelector from './ui/ChipSelector';

interface Student {
  id: number;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  guardian_name: string;
  guardian_contact: string;
  guardian_name_2: string | null;
  guardian_contact_2: string | null;
  guardian_email: string | null;
  is_active: number;
  grade_id?: number;
  grade_label?: string;
}

interface Grade {
  id: number;
  label: string;
}

interface AcademicYear {
  id: number;
  label: string;
}

interface FinancialHistory {
  year_label: string;
  grade_label: string;
  fees: number;
  paid: number;
  balance: number;
  transactions: any[];
}

const StudentManager: React.FC = () => {
  const { user, canManageStudents } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  
  // Selected student
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [financialHistory, setFinancialHistory] = useState<FinancialHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
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
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentYear) {
      loadStudents();
    }
  }, [currentYear, selectedGradeFilter, statusFilter, searchQuery]);

  useEffect(() => {
    if (selectedStudent) {
      loadFinancialHistory(selectedStudent.id);
    }
  }, [selectedStudent]);

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to manage learners.</p>
      </div>
    );
  }

  const loadInitialData = async () => {
    const [gradeList, yearList] = await Promise.all([
      db.all('SELECT id, label FROM grades ORDER BY id'),
      db.all('SELECT id, label FROM academic_years ORDER BY label DESC'),
    ]);
    
    setGrades(gradeList);
    setAcademicYears(yearList);
    
    if (yearList.length > 0) {
      setCurrentYear(yearList[0]);
    }
  };

  const loadStudents = async () => {
    if (!currentYear) return;

    let query = `
      SELECT s.*,
        CASE
          WHEN cs.label IS NULL OR cs.label = '' THEN g.label
          ELSE g.label || ' - ' || cs.label
        END as grade_label,
        sye.grade_id
      FROM students s
      LEFT JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
      LEFT JOIN grades g ON sye.grade_id = g.id
      LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
      WHERE 1=1
    `;
    const params: any[] = [currentYear.id];

    if (statusFilter === 'active') {
      query += ' AND s.is_active = 1';
    } else if (statusFilter === 'inactive') {
      query += ' AND s.is_active = 0';
    }

    if (selectedGradeFilter) {
      query += ' AND sye.grade_id = ?';
      params.push(selectedGradeFilter);
    }

    if (searchQuery.trim()) {
      query += ' AND (s.full_name LIKE ? OR s.id = ?)';
      params.push(`%${searchQuery}%`);
      params.push(parseInt(searchQuery) || 0);
    }

    query += ' ORDER BY s.full_name';

    const result = await db.all(query, params);
    setStudents(result);
  };

  const loadFinancialHistory = async (studentId: number) => {
    setLoadingHistory(true);
    try {
      const history: FinancialHistory[] = [];
      
      for (const year of academicYears) {
        // Get enrollment for this year
        const enrollment = await db.get(`
          SELECT sye.grade_id,
                 CASE
                   WHEN cs.label IS NULL OR cs.label = '' THEN g.label
                   ELSE g.label || ' - ' || cs.label
                 END as grade_label
          FROM student_year_enrollment sye
          JOIN grades g ON sye.grade_id = g.id
          LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
          WHERE sye.student_id = ? AND sye.year_id = ?
        `, [studentId, year.id]);
        
        if (!enrollment) continue;
        
        // Get fees for this grade/year
        const fees = await db.get(`
          SELECT SUM(amount_cents) as total
          FROM fee_structure
          WHERE year_id = ? AND grade_id = ?
        `, [year.id, enrollment.grade_id]);
        
        // Get payments for this year
        const payments = await db.all(`
          SELECT p.*, t.label as term_label
          FROM payments p
          JOIN terms t ON p.term_id = t.id
          WHERE p.student_id = ? AND p.year_id = ?
          ORDER BY p.payment_date DESC
        `, [studentId, year.id]);
        
        const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid_cents, 0);
        
        history.push({
          year_label: year.label,
          grade_label: enrollment.grade_label,
          fees: fees?.total || 0,
          paid: totalPaid,
          balance: (fees?.total || 0) - totalPaid,
          transactions: payments,
        });
      }
      
      setFinancialHistory(history);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openAddModal = () => {
    // Use wizard for adding new students
    setShowWizard(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setForm({
      full_name: student.full_name,
      date_of_birth: student.date_of_birth || '',
      gender: student.gender || '',
      guardian_name: student.guardian_name,
      guardian_contact: student.guardian_contact,
      guardian_name_2: student.guardian_name_2 || '',
      guardian_contact_2: student.guardian_contact_2 || '',
      guardian_email: student.guardian_email || '',
      grade_id: student.grade_id ? String(student.grade_id) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.guardian_name || !form.guardian_contact) return;
    
    setSaving(true);
    try {
      if (editingStudent) {
        // Update existing student
        await db.run(`
          UPDATE students SET
            full_name = ?, date_of_birth = ?, gender = ?,
            guardian_name = ?, guardian_contact = ?,
            guardian_name_2 = ?, guardian_contact_2 = ?,
            guardian_email = ?
          WHERE id = ?
        `, [
          form.full_name, form.date_of_birth || null, form.gender || null,
          form.guardian_name, form.guardian_contact,
          form.guardian_name_2 || null, form.guardian_contact_2 || null,
          form.guardian_email || null, editingStudent.id
        ]);
        
        // Update enrollment if grade changed
        if (form.grade_id && currentYear) {
          const existingEnrollment = await db.get(
            'SELECT id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
            [editingStudent.id, currentYear.id]
          );
          
          if (existingEnrollment) {
            await db.run(
              'UPDATE student_year_enrollment SET grade_id = ? WHERE id = ?',
              [form.grade_id, existingEnrollment.id]
            );
          } else {
            await db.run(
              'INSERT INTO student_year_enrollment (student_id, year_id, grade_id) VALUES (?, ?, ?)',
              [editingStudent.id, currentYear.id, form.grade_id]
            );
          }
        }
        
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user?.id ?? null, user?.username ?? 'System', 'student_updated', 'students', editingStudent.id, `Updated student: ${form.full_name}`]
        );
      } else {
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
      }
      
      setShowModal(false);
      loadStudents();
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGradeFilter(null);
    setStatusFilter('active');
  };

  return (
    <div className="students-page">
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Enrolled Learners</h2>
        <div className="flex-row gap-2">
          <button className="btn btn-sage" onClick={handlePrint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Learner
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 no-print">
        <div className="flex-row gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex-col" style={{ minWidth: 200, flex: 1 }}>
            <label className="settings-label">Search</label>
            <input
              type="text"
              className="input-default"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <ChipSelector
            label="Grade"
            value={selectedGradeFilter}
            onChange={value => setSelectedGradeFilter(typeof value === 'number' ? value : null)}
            options={grades.map(g => ({ value: g.id, label: g.label }))}
            allowAll
            allLabel="All Grades"
          />
          
          <ChipSelector
            label="Status"
            value={statusFilter === 'all' ? null : statusFilter}
            onChange={value => setStatusFilter((value as any) || 'all')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            allowAll
            allLabel="All"
          />
          
          <div className="flex-col" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-sage" onClick={clearFilters}>Clear Filters</button>
          </div>
        </div>
      </div>

      <div className="students-layout">
        {/* Student List */}
        <div className="card students-list">
          <div className="flex-between mb-2">
            <h3 style={{ margin: 0, fontSize: 14 }}>
              {selectedGradeFilter 
                ? `${grades.find(g => g.id === selectedGradeFilter)?.label} - ${students.length} learners`
                : `All Learners - ${students.length} total`}
            </h3>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Grade</th>
                <th>Guardian</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr 
                  key={s.id} 
                  className={`student-row ${selectedStudent?.id === s.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStudent(s)}
                >
                  <td className="td-id">#{s.id}</td>
                  <td className="td-bold">{s.full_name}</td>
                  <td>{s.grade_label || '-'}</td>
                  <td>{s.guardian_name}</td>
                  <td>
                    <span className={`status-badge ${s.is_active ? 'status-active' : 'status-outstanding'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">No learners found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Student Detail Panel */}
        {selectedStudent && (
          <div className="card student-detail">
            <div className="flex-between mb-4">
              <div>
                <h3 style={{ margin: 0 }}>{selectedStudent.full_name}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-sage-placeholder)', fontSize: 14 }}>
                  #{selectedStudent.id} - {selectedStudent.grade_label || 'No grade assigned'}
                </p>
              </div>
              <div className="flex-row gap-2">
                <button className="btn btn-sage" onClick={() => openEditModal(selectedStudent)}>Edit</button>
                <button className="btn btn-sage" onClick={handlePrint}>Print</button>
              </div>
            </div>

            <div className="student-info-grid">
              <div className="info-item">
                <span className="info-label">Guardian</span>
                <span className="info-value">{selectedStudent.guardian_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Contact</span>
                <span className="info-value">{selectedStudent.guardian_contact}</span>
              </div>
              {selectedStudent.guardian_email && (
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <span className="info-value">{selectedStudent.guardian_email}</span>
                </div>
              )}
              {selectedStudent.date_of_birth && (
                <div className="info-item">
                  <span className="info-label">Date of Birth</span>
                  <span className="info-value">{formatDate(selectedStudent.date_of_birth)}</span>
                </div>
              )}
            </div>

            <div className="student-balance-summary">
              {financialHistory.length > 0 && (
                <div className="balance-card">
                  <span className="balance-label">Current Balance</span>
                  <span className={`balance-value ${financialHistory[0].balance > 0 ? 'outstanding' : 'paid'}`}>
                    {formatCurrency(financialHistory[0].balance)}
                  </span>
                </div>
              )}
            </div>

            <h4>Financial History</h4>
            {loadingHistory ? (
              <p style={{ color: 'var(--color-sage-placeholder)' }}>Loading...</p>
            ) : financialHistory.length === 0 ? (
              <p style={{ color: 'var(--color-sage-placeholder)' }}>No financial history</p>
            ) : (
              <div className="financial-history">
                {financialHistory.map((fh, idx) => (
                  <div key={idx} className="history-year">
                    <div className="history-year-header">
                      <span className="history-year-label">{fh.year_label} ({fh.grade_label})</span>
                      <span className={`history-year-balance ${fh.balance > 0 ? 'outstanding' : 'paid'}`}>
                        {fh.balance > 0 ? `Outstanding: ${formatCurrency(fh.balance)}` : 'Paid'}
                      </span>
                    </div>
                    <div className="history-summary">
                      <span>Fees: {formatCurrency(fh.fees)}</span>
                      <span>Paid: {formatCurrency(fh.paid)}</span>
                    </div>
                    {fh.transactions.length > 0 && (
                      <div className="history-transactions">
                        {fh.transactions.map((t: any, i: number) => (
                          <div key={i} className="transaction-row">
                            <span className="transaction-date">{formatDate(t.payment_date)}</span>
                            <span className="transaction-desc">{t.receipt_number} - {t.term_label}</span>
                            <span className="transaction-amount">{formatCurrency(t.amount_paid_cents)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingStudent ? 'Edit Learner' : 'Add New Learner'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-section">
                <h4 className="form-section-title">Personal Information</h4>
                <div className="flex-row gap-4 mb-2" style={{ flexWrap: 'wrap' }}>
                  <div className="flex-col flex-1" style={{ minWidth: 200 }}>
                    <label className="settings-label">Full Name *</label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex-col" style={{ minWidth: 140 }}>
                    <label className="settings-label">Date of Birth</label>
                    <input
                      type="date"
                      className="input-default"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="flex-col" style={{ minWidth: 120 }}>
                    <label className="settings-label">Gender</label>
                    <select
                      className="input-default"
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4 className="form-section-title">Enrollment Information</h4>
                <div className="flex-row gap-4 mb-2">
                  <div className="flex-col flex-1">
                    <label className="settings-label">Enrolling Grade *</label>
                    <select
                      className="input-default"
                      value={form.grade_id}
                      onChange={(e) => setForm({ ...form, grade_id: e.target.value })}
                      required
                    >
                      <option value="">Select Grade</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-col flex-1">
                    <label className="settings-label">Academic Year</label>
                    <input
                      type="text"
                      className="input-default"
                      value={currentYear?.label || ''}
                      readOnly
                      style={{ backgroundColor: 'var(--color-light-sage)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4 className="form-section-title">Guardian Information</h4>
                <div className="flex-row gap-4 mb-2" style={{ flexWrap: 'wrap' }}>
                  <div className="flex-col flex-1" style={{ minWidth: 200 }}>
                    <label className="settings-label">Guardian Name *</label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_name}
                      onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex-col flex-1" style={{ minWidth: 150 }}>
                    <label className="settings-label">Contact Number *</label>
                    <input
                      type="tel"
                      className="input-default"
                      value={form.guardian_contact}
                      onChange={(e) => setForm({ ...form, guardian_contact: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex-row gap-4 mb-2" style={{ flexWrap: 'wrap' }}>
                  <div className="flex-col flex-1" style={{ minWidth: 200 }}>
                    <label className="settings-label">Secondary Guardian</label>
                    <input
                      type="text"
                      className="input-default"
                      value={form.guardian_name_2}
                      onChange={(e) => setForm({ ...form, guardian_name_2: e.target.value })}
                    />
                  </div>
                  <div className="flex-col flex-1" style={{ minWidth: 150 }}>
                    <label className="settings-label">Secondary Contact</label>
                    <input
                      type="tel"
                      className="input-default"
                      value={form.guardian_contact_2}
                      onChange={(e) => setForm({ ...form, guardian_contact_2: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex-col">
                  <label className="settings-label">Email</label>
                  <input
                    type="email"
                    className="input-default"
                    value={form.guardian_email}
                    onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex-row gap-2" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sage" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingStudent ? 'Save Changes' : 'Add Learner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Learner Wizard */}
      {showWizard && (
        <StudentWizard 
          onClose={() => setShowWizard(false)} 
          onSuccess={() => {
            setShowWizard(false);
            loadStudents();
          }}
          currentYearId={currentYear?.id}
          preSelectedGrade={selectedGradeFilter || undefined}
        />
      )}
    </div>
  );
};

export default StudentManager;
