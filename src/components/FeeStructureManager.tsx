import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

interface AcademicYear {
  id: number;
  label: string;
}

interface Term {
  id: number;
  year_id: number;
  term_number: number;
  label: string;
}

interface Grade {
  id: number;
  label: string;
}

interface FeeStructure {
  id: number;
  year_id: number;
  term_id: number;
  grade_id: number;
  fee_type: string;
  amount_cents: number;
  is_locked: number;
  year_label: string;
  term_label: string;
  grade_label: string;
}

const FeeStructureManager: React.FC = () => {
  const { user } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  
  // Add forms
  const [yearLabel, setYearLabel] = useState('');
  const [gradeLabel, setGradeLabel] = useState('');
  const [termForm, setTermForm] = useState({ term_number: '', label: '' });
  
  // Fee form
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({
    year_id: '',
    term_id: '',
    grade_id: '',
    fee_type: 'tuition',
    amount: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadTerms(selectedYear);
      loadFees();
    }
  }, [selectedYear]);

  const loadData = async () => {
    const [yearList, gradeList] = await Promise.all([
      db.all('SELECT * FROM academic_years ORDER BY label DESC'),
      db.all('SELECT * FROM grades ORDER BY id'),
    ]);
    setYears(yearList);
    setGrades(gradeList);
    
    if (yearList.length > 0) {
      setSelectedYear(yearList[0].id);
    }
  };

  const loadTerms = async (yearId: number) => {
    const termList = await db.all(
      'SELECT * FROM terms WHERE year_id = ? ORDER BY term_number',
      [yearId]
    );
    setTerms(termList);
  };

  const loadFees = async () => {
    const feeList = await db.all(`
      SELECT f.*, y.label as year_label, t.label as term_label, g.label as grade_label
      FROM fee_structure f
      JOIN academic_years y ON f.year_id = y.id
      JOIN terms t ON f.term_id = t.id
      JOIN grades g ON f.grade_id = g.id
      ORDER BY y.label DESC, g.id, t.term_number
    `);
    setFees(feeList);
  };

  const addYear = async () => {
    if (!yearLabel.trim()) return;
    const result = await db.run('INSERT INTO academic_years (label) VALUES (?)', [yearLabel]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user?.id ?? null, user?.username ?? 'System', 'year_added', 'academic_years', result.lastInsertRowid || result.lastID, `Added academic year: ${yearLabel}`]
    );
    setYearLabel('');
    loadData();
  };

  const addGrade = async () => {
    if (!gradeLabel.trim()) return;
    const result = await db.run('INSERT INTO grades (label) VALUES (?)', [gradeLabel]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user?.id ?? null, user?.username ?? 'System', 'grade_added', 'grades', result.lastInsertRowid || result.lastID, `Added grade: ${gradeLabel}`]
    );
    setGradeLabel('');
    loadData();
  };

  const addTerm = async () => {
    if (!selectedYear || !termForm.term_number || !termForm.label) return;
    const result = await db.run(
      'INSERT INTO terms (year_id, term_number, label) VALUES (?, ?, ?)',
      [selectedYear, termForm.term_number, termForm.label]
    );
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user?.id ?? null, user?.username ?? 'System', 'term_added', 'terms', result.lastInsertRowid || result.lastID, `Added term: ${termForm.label}`]
    );
    setTermForm({ term_number: '', label: '' });
    loadTerms(selectedYear);
  };

  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeForm.year_id || !feeForm.term_id || !feeForm.grade_id || !feeForm.amount) return;
    
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(feeForm.amount) * 100);
      
      const result = await db.run(`
        INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents)
        VALUES (?, ?, ?, ?, ?)
      `, [feeForm.year_id, feeForm.term_id, feeForm.grade_id, feeForm.fee_type, amountCents]);
      
      const grade = grades.find(g => g.id === Number(feeForm.grade_id));
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'fee_added', 'fee_structure', result.lastInsertRowid || result.lastID, `Added ${feeForm.fee_type} fee of $${feeForm.amount} for ${grade?.label}`]
      );
      
      setShowFeeModal(false);
      setFeeForm({ year_id: '', term_id: '', grade_id: '', fee_type: 'tuition', amount: '' });
      loadFees();
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter fees by selected year
  const filteredFees = selectedYear 
    ? fees.filter(f => f.year_id === selectedYear)
    : fees;

  // Group fees by grade for display
  const feesByGrade = grades.map(grade => ({
    grade,
    fees: filteredFees.filter(f => f.grade_id === grade.id),
    total: filteredFees.filter(f => f.grade_id === grade.id).reduce((sum, f) => sum + f.amount_cents, 0),
  })).filter(g => g.fees.length > 0);

  return (
    <div>
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Fee Structure</h2>
        <div className="flex-row gap-2">
          <button className="btn btn-sage" onClick={handlePrint}>Print</button>
          <button className="btn btn-primary" onClick={() => setShowFeeModal(true)}>+ Add Fee</button>
        </div>
      </div>

      {/* Setup Section */}
      <div className="fee-setup-grid no-print">
        <div className="card-surface">
          <h4 className="mb-2">Academic Years</h4>
          <div className="flex-row gap-2 mb-2">
            <input
              className="input-default"
              placeholder="Year (e.g. 2026)"
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addYear}>Add</button>
          </div>
          <div className="chip-list">
            {years.map((y) => (
              <span
                key={y.id}
                className={`chip ${selectedYear === y.id ? 'chip-active' : ''}`}
                onClick={() => setSelectedYear(y.id)}
              >
                {y.label}
              </span>
            ))}
          </div>
        </div>

        <div className="card-surface">
          <h4 className="mb-2">Grades</h4>
          <div className="flex-row gap-2 mb-2">
            <input
              className="input-default"
              placeholder="Grade (e.g. Grade 7)"
              value={gradeLabel}
              onChange={(e) => setGradeLabel(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addGrade}>Add</button>
          </div>
          <div className="chip-list">
            {grades.map((g) => (
              <span key={g.id} className="chip">{g.label}</span>
            ))}
          </div>
        </div>

        <div className="card-surface">
          <h4 className="mb-2">Terms ({years.find(y => y.id === selectedYear)?.label || 'Select year'})</h4>
          <div className="flex-row gap-2 mb-2">
            <input
              className="input-default"
              type="number"
              placeholder="#"
              style={{ width: 60 }}
              value={termForm.term_number}
              onChange={(e) => setTermForm({ ...termForm, term_number: e.target.value })}
            />
            <input
              className="input-default flex-1"
              placeholder="Term 1"
              value={termForm.label}
              onChange={(e) => setTermForm({ ...termForm, label: e.target.value })}
            />
            <button className="btn btn-primary" onClick={addTerm} disabled={!selectedYear}>Add</button>
          </div>
          <div className="chip-list">
            {terms.map((t) => (
              <span key={t.id} className="chip">{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Fee Structure Table */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 style={{ margin: 0 }}>
            Fee Structure - {years.find(y => y.id === selectedYear)?.label || 'All Years'}
          </h3>
        </div>

        {feesByGrade.length === 0 ? (
          <div className="table-empty">No fees defined for this year. Add fees to get started.</div>
        ) : (
          <div className="fee-table-container">
            {feesByGrade.map(({ grade, fees: gradeFees, total }) => (
              <div key={grade.id} className="fee-grade-section">
                <div className="fee-grade-header">
                  <span className="fee-grade-name">{grade.label}</span>
                  <span className="fee-grade-total">Total: {formatCurrency(total)}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Fee Type</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeFees.map((f) => (
                      <tr key={f.id}>
                        <td>{f.term_label}</td>
                        <td style={{ textTransform: 'capitalize' }}>{f.fee_type}</td>
                        <td className="td-amount">{formatCurrency(f.amount_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Fee Modal */}
      {showFeeModal && (
        <div className="modal-overlay" onClick={() => setShowFeeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Fee</h2>
              <button className="modal-close" onClick={() => setShowFeeModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddFee} className="modal-body">
              <div className="flex-col gap-4">
                <div className="flex-row gap-2">
                  <div className="flex-col flex-1">
                    <label className="settings-label">Academic Year *</label>
                    <select
                      className="input-default"
                      value={feeForm.year_id}
                      onChange={(e) => {
                        setFeeForm({ ...feeForm, year_id: e.target.value, term_id: '' });
                        if (e.target.value) loadTerms(Number(e.target.value));
                      }}
                      required
                    >
                      <option value="">Select Year</option>
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>{y.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-col flex-1">
                    <label className="settings-label">Term *</label>
                    <select
                      className="input-default"
                      value={feeForm.term_id}
                      onChange={(e) => setFeeForm({ ...feeForm, term_id: e.target.value })}
                      required
                      disabled={!feeForm.year_id}
                    >
                      <option value="">Select Term</option>
                      {terms.filter(t => t.year_id === Number(feeForm.year_id)).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-row gap-2">
                  <div className="flex-col flex-1">
                    <label className="settings-label">Grade *</label>
                    <select
                      className="input-default"
                      value={feeForm.grade_id}
                      onChange={(e) => setFeeForm({ ...feeForm, grade_id: e.target.value })}
                      required
                    >
                      <option value="">Select Grade</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-col flex-1">
                    <label className="settings-label">Fee Type *</label>
                    <select
                      className="input-default"
                      value={feeForm.fee_type}
                      onChange={(e) => setFeeForm({ ...feeForm, fee_type: e.target.value })}
                      required
                    >
                      <option value="tuition">Tuition</option>
                      <option value="registration">Registration</option>
                      <option value="levy">Levy</option>
                      <option value="exam">Exam</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex-col">
                  <label className="settings-label">Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-default"
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="flex-row gap-2" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sage" onClick={() => setShowFeeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Add Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeStructureManager;
