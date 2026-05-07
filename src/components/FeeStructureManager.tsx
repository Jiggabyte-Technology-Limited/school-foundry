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
  start_date: string | null;
  end_date: string | null;
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
  description: string | null;
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
  const [termForm, setTermForm] = useState({ term_number: '', label: '', start_date: '', end_date: '' });
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  
  // Fee form
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<number | null>(null);
  const [feeForm, setFeeForm] = useState({
    year_id: '',
    term_id: '',
    grade_id: '',
    fee_type: 'tuition',
    amount: '',
    description: '',
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
    
    if (yearList.length > 0 && !selectedYear) {
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

  const handleSaveTerm = async () => {
    if (!selectedYear || !termForm.term_number || !termForm.label) return;
    
    if (editingTermId) {
      await db.run(
        'UPDATE terms SET term_number = ?, label = ?, start_date = ?, end_date = ? WHERE id = ?',
        [termForm.term_number, termForm.label, termForm.start_date || null, termForm.end_date || null, editingTermId]
      );
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'term_updated', 'terms', editingTermId, `Updated term: ${termForm.label}`]
      );
    } else {
      const result = await db.run(
        'INSERT INTO terms (year_id, term_number, label, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        [selectedYear, termForm.term_number, termForm.label, termForm.start_date || null, termForm.end_date || null]
      );
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'term_added', 'terms', result.lastInsertRowid || result.lastID, `Added term: ${termForm.label}`]
      );
    }
    
    setTermForm({ term_number: '', label: '', start_date: '', end_date: '' });
    setEditingTermId(null);
    loadTerms(selectedYear);
  };

  const deleteTerm = async (id: number, label: string) => {
    if (!window.confirm(`Are you sure you want to delete ${label}? This will also delete any associated fees.`)) return;
    await db.run('DELETE FROM terms WHERE id = ?', [id]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user?.id ?? null, user?.username ?? 'System', 'term_deleted', 'terms', id, `Deleted term: ${label}`]
    );
    if (selectedYear) loadTerms(selectedYear);
    loadFees();
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeForm.year_id || !feeForm.term_id || !feeForm.grade_id || !feeForm.amount) return;
    
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(feeForm.amount) * 100);
      const grade = grades.find(g => g.id === Number(feeForm.grade_id));
      
      if (editingFeeId) {
        await db.run(`
          UPDATE fee_structure 
          SET year_id = ?, term_id = ?, grade_id = ?, fee_type = ?, amount_cents = ?, description = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [feeForm.year_id, feeForm.term_id, feeForm.grade_id, feeForm.fee_type, amountCents, feeForm.description || null, editingFeeId]);
        
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user?.id ?? null, user?.username ?? 'System', 'fee_updated', 'fee_structure', editingFeeId, `Updated ${feeForm.fee_type} fee to $${feeForm.amount} for ${grade?.label}`]
        );
      } else {
        const result = await db.run(`
          INSERT INTO fee_structure (year_id, term_id, grade_id, fee_type, amount_cents, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [feeForm.year_id, feeForm.term_id, feeForm.grade_id, feeForm.fee_type, amountCents, feeForm.description || null]);
        
        await db.run(
          'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
          [user?.id ?? null, user?.username ?? 'System', 'fee_added', 'fee_structure', result.lastInsertRowid || result.lastID, `Added ${feeForm.fee_type} fee of $${feeForm.amount} for ${grade?.label}`]
        );
      }
      
      setShowFeeModal(false);
      setEditingFeeId(null);
      setFeeForm({ year_id: '', term_id: '', grade_id: '', fee_type: 'tuition', amount: '', description: '' });
      loadFees();
    } finally {
      setSaving(false);
    }
  };

  const deleteFee = async (id: number, type: string, amount: number, grade: string) => {
    if (!window.confirm(`Are you sure you want to delete this ${type} fee of ${formatCurrency(amount)} for ${grade}?`)) return;
    await db.run('DELETE FROM fee_structure WHERE id = ?', [id]);
    await db.run(
      'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [user?.id ?? null, user?.username ?? 'System', 'fee_deleted', 'fee_structure', id, `Deleted ${type} fee for ${grade}`]
    );
    loadFees();
  };

  const startEditFee = (fee: FeeStructure) => {
    setEditingFeeId(fee.id);
    setFeeForm({
      year_id: String(fee.year_id),
      term_id: String(fee.term_id),
      grade_id: String(fee.grade_id),
      fee_type: fee.fee_type,
      amount: (fee.amount_cents / 100).toFixed(2),
      description: fee.description || '',
    });
    setShowFeeModal(true);
  };

  const startEditTerm = (term: Term) => {
    setEditingTermId(term.id);
    setTermForm({
      term_number: String(term.term_number),
      label: term.label,
      start_date: term.start_date || '',
      end_date: term.end_date || '',
    });
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
          <button className="btn btn-primary" onClick={() => {
            setEditingFeeId(null);
            setFeeForm({ year_id: String(selectedYear || ''), term_id: '', grade_id: '', fee_type: 'tuition', amount: '', description: '' });
            setShowFeeModal(true);
          }}>+ Add Fee</button>
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

        <div className="card-surface" style={{ gridColumn: 'span 2' }}>
          <h4 className="mb-2">Terms ({years.find(y => y.id === selectedYear)?.label || 'Select year'})</h4>
          <div className="flex-row gap-2 mb-3">
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
              placeholder="Term Name (e.g. Term 1)"
              value={termForm.label}
              onChange={(e) => setTermForm({ ...termForm, label: e.target.value })}
            />
            <div className="flex-row gap-2 flex-1">
              <input
                className="input-default flex-1"
                type="date"
                title="Start Date"
                value={termForm.start_date}
                onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
              />
              <input
                className="input-default flex-1"
                type="date"
                title="End Date"
                value={termForm.end_date}
                onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
              />
            </div>
            <button className="btn btn-primary" onClick={handleSaveTerm} disabled={!selectedYear}>
              {editingTermId ? 'Update' : 'Add'}
            </button>
            {editingTermId && (
              <button className="btn btn-sage" onClick={() => {
                setEditingTermId(null);
                setTermForm({ term_number: '', label: '', start_date: '', end_date: '' });
              }}>Cancel</button>
            )}
          </div>
          
          <div className="chip-list" style={{ flexWrap: 'wrap' }}>
            {terms.map((t) => (
              <div key={t.id} className="chip flex-row gap-2 items-center" style={{ height: 'auto', padding: '6px 12px' }}>
                <div className="flex-col" style={{ lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  {t.start_date && (
                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                      {t.start_date} to {t.end_date || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-row gap-1">
                  <button 
                    onClick={() => startEditTerm(t)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--color-accent-teal)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => deleteTerm(t.id, t.label)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: 'var(--color-posthog-orange)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
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
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th className="no-print" style={{ width: 80, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeFees.map((f) => (
                      <tr key={f.id}>
                        <td>{f.term_label}</td>
                        <td style={{ textTransform: 'capitalize' }}>{f.fee_type}</td>
                        <td style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>{f.description || '-'}</td>
                        <td className="td-amount">{formatCurrency(f.amount_cents)}</td>
                        <td className="no-print" style={{ textAlign: 'center' }}>
                          <div className="flex-row gap-2 justify-center">
                            <button 
                              className="btn-icon" 
                              onClick={() => startEditFee(f)}
                              title="Edit Fee"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button 
                              className="btn-icon" 
                              onClick={() => deleteFee(f.id, f.fee_type, f.amount_cents, f.grade_label)}
                              title="Delete Fee"
                              style={{ color: 'var(--color-posthog-orange)' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Fee Modal */}
      {showFeeModal && (
        <div className="modal-overlay" onClick={() => setShowFeeModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingFeeId ? 'Edit Fee' : 'Add Fee'}</h2>
              <button className="modal-close" onClick={() => setShowFeeModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveFee} className="modal-body">
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

                <div className="flex-row gap-2">
                  <div className="flex-col flex-1">
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
                  <div className="flex-col flex-1">
                    <label className="settings-label">Description (Optional)</label>
                    <input
                      className="input-default"
                      value={feeForm.description}
                      onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })}
                      placeholder="e.g. First Term Tuition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-row gap-2" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-sage" onClick={() => setShowFeeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingFeeId ? 'Update Fee' : 'Add Fee')}
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
