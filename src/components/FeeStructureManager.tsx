import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

interface AcademicYear { id: number; label: string; }
interface Term { id: number; year_id: number; term_number: number; label: string; start_date: string | null; end_date: string | null; }
interface Grade { id: number; label: string; }
interface FeeStructure { id: number; year_id: number; term_id: number; grade_id: number; fee_type: string; amount_cents: number; description: string | null; }

interface MatrixCell {
  id: number | null;
  amount: string;
  isUnsaved: boolean;
  isSaving: boolean;
}

const FeeStructureManager: React.FC = () => {
  const { user, canManageFees } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  // Matrix State: [gradeId][termId] = MatrixCell
  const [matrix, setMatrix] = useState<Record<number, Record<number, MatrixCell>>>({});
  
  // Form states for Config
  const [yearLabel, setYearLabel] = useState('');
  const [gradeLabel, setGradeLabel] = useState('');
  const [termForm, setTermForm] = useState({ term_number: '', label: '', start_date: '', end_date: '' });
  const [editingTermId, setEditingTermId] = useState<number | null>(null);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (selectedYear) loadYearData(selectedYear); }, [selectedYear]);

  const loadInitialData = async () => {
    const [yearList, gradeList] = await Promise.all([
      db.all('SELECT * FROM academic_years ORDER BY label DESC'),
      db.all('SELECT * FROM grades ORDER BY id'),
    ]);
    setYears(yearList);
    setGrades(gradeList);
    if (yearList.length > 0 && !selectedYear) setSelectedYear(yearList[0].id);
  };

  const loadYearData = async (yearId: number) => {
    const [termList, feeList] = await Promise.all([
      db.all('SELECT * FROM terms WHERE year_id = ? ORDER BY term_number', [yearId]),
      db.all('SELECT * FROM fee_structure WHERE year_id = ?', [yearId])
    ]);
    setTerms(termList);
    
    // Build Matrix
    const newMatrix: Record<number, Record<number, MatrixCell>> = {};
    grades.forEach(g => {
      newMatrix[g.id] = {};
      termList.forEach(t => {
        const existingFee = feeList.find(f => f.grade_id === g.id && f.term_id === t.id);
        newMatrix[g.id][t.id] = {
          id: existingFee?.id || null,
          amount: existingFee ? (existingFee.amount_cents / 100).toFixed(2) : '0.00',
          isUnsaved: false,
          isSaving: false
        };
      });
    });
    setMatrix(newMatrix);
  };

  const handleMatrixChange = (gradeId: number, termId: number, value: string) => {
    setMatrix(prev => ({
      ...prev,
      [gradeId]: {
        ...prev[gradeId],
        [termId]: { ...prev[gradeId][termId], amount: value, isUnsaved: true }
      }
    }));
  };

  const saveCell = async (gradeId: number, termId: number) => {
    const cell = matrix[gradeId][termId];
    if (!cell.isUnsaved || !selectedYear) return;

    if (!canManageFees) {
      alert('You do not have permission to modify the fee structure.');
      return;
    }

    setMatrix(prev => ({
      ...prev,
      [gradeId]: { ...prev[gradeId], [termId]: { ...prev[gradeId][termId], isSaving: true } }
    }));

    try {
      const amountCents = Math.round(parseFloat(cell.amount || '0') * 100);
      if (cell.id) {
        await db.run('UPDATE fee_structure SET amount_cents = ?, updated_at = datetime("now") WHERE id = ?', [amountCents, cell.id]);
      } else {
        const result = await db.run(
          'INSERT INTO fee_structure (year_id, term_id, grade_id, amount_cents) VALUES (?, ?, ?, ?)',
          [selectedYear, termId, gradeId, amountCents]
        );
        handleMatrixChange(gradeId, termId, cell.amount); // Triggers update to cell ID
        setMatrix(prev => ({
            ...prev,
            [gradeId]: { 
                ...prev[gradeId], 
                [termId]: { ...prev[gradeId][termId], id: result.lastInsertRowid || result.lastID, isUnsaved: false, isSaving: false } 
            }
        }));
        return;
      }

      setMatrix(prev => ({
        ...prev,
        [gradeId]: { ...prev[gradeId], [termId]: { ...prev[gradeId][termId], isUnsaved: false, isSaving: false } }
      }));
    } catch (err) {
      console.error('Failed to save fee:', err);
      setMatrix(prev => ({
        ...prev,
        [gradeId]: { ...prev[gradeId], [termId]: { ...prev[gradeId][termId], isSaving: false } }
      }));
    }
  };

  // Config Actions
  const addYear = async () => {
    if (!yearLabel.trim()) return;
    await db.run('INSERT INTO academic_years (label) VALUES (?)', [yearLabel]);
    setYearLabel('');
    loadInitialData();
  };

  const addGrade = async () => {
    if (!gradeLabel.trim()) return;
    await db.run('INSERT INTO grades (label) VALUES (?)', [gradeLabel]);
    setGradeLabel('');
    loadInitialData();
  };

  const saveTerm = async () => {
    if (!selectedYear || !termForm.label) return;
    if (editingTermId) {
      await db.run('UPDATE terms SET term_number = ?, label = ?, start_date = ?, end_date = ? WHERE id = ?', 
        [termForm.term_number, termForm.label, termForm.start_date || null, termForm.end_date || null, editingTermId]);
    } else {
      await db.run('INSERT INTO terms (year_id, term_number, label, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        [selectedYear, termForm.term_number, termForm.label, termForm.start_date || null, termForm.end_date || null]);
    }
    setTermForm({ term_number: '', label: '', start_date: '', end_date: '' });
    setEditingTermId(null);
    loadYearData(selectedYear);
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

  const deleteTerm = async (id: number) => {
    if (!window.confirm('Delete this term and all associated fees?')) return;
    await db.run('DELETE FROM terms WHERE id = ?', [id]);
    if (selectedYear) loadYearData(selectedYear);
  };

  return (
    <div className="page-content">
      <div className="flex-between mb-4">
        <div className="flex-col" style={{ gap: 4 }}>
          <h1 style={{ margin: 0 }}>Fee Structure</h1>
          <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>Manage and automate tuition fees across all grades.</p>
        </div>
        <div className="flex-row gap-3">
          <div className="flex-row gap-2" style={{ backgroundColor: 'white', padding: '4px 12px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--color-sage-border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-sage-placeholder)' }}>YEAR:</span>
            <select 
              value={selectedYear || ''} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ border: 'none', fontWeight: 700, color: 'var(--primary)', outline: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          {canManageFees && (
            <button className={`config-toggle-btn ${showConfig ? 'active' : ''}`} onClick={() => setShowConfig(!showConfig)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Configuration
            </button>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      <div className={`config-panel ${showConfig ? 'open' : ''}`} style={{ backgroundColor: 'var(--color-sage-cream)', borderRadius: 'var(--border-radius-xl)', padding: showConfig ? '32px' : '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '1400px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '24px', height: '100%' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
              Academic Years
            </h4>
            <div className="flex-row gap-2 mb-3">
              <input className="input-default" placeholder="e.g. 2026" value={yearLabel} onChange={e => setYearLabel(e.target.value)} />
              <button className="btn btn-primary" onClick={addYear}>Add</button>
            </div>
            <div className="chip-list">
              {years.map(y => <span key={y.id} className="chip">{y.label}</span>)}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', height: '100%' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Grades/Forms
            </h4>
            <div className="flex-row gap-2 mb-3">
              <input className="input-default" placeholder="e.g. Form 1" value={gradeLabel} onChange={e => setGradeLabel(e.target.value)} />
              <button className="btn btn-primary" onClick={addGrade}>Add</button>
            </div>
            <div className="chip-list">
              {grades.map(g => <span key={g.id} className="chip">{g.label}</span>)}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', height: '100%' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Terms Setup
            </h4>
            <div className="flex-col gap-2">
              <div className="flex-row gap-2">
                <input className="input-default" style={{ width: 60 }} type="number" placeholder="#" value={termForm.term_number} onChange={e => setTermForm({...termForm, term_number: e.target.value})} />
                <input className="input-default flex-1" placeholder="Term Name" value={termForm.label} onChange={e => setTermForm({...termForm, label: e.target.value})} />
              </div>
              <div className="flex-row gap-2">
                <input className="input-default flex-1" type="date" value={termForm.start_date} onChange={e => setTermForm({...termForm, start_date: e.target.value})} />
                <input className="input-default flex-1" type="date" value={termForm.end_date} onChange={e => setTermForm({...termForm, end_date: e.target.value})} />
              </div>
              <div className="flex-row gap-2">
                <button className="btn btn-primary flex-1" onClick={saveTerm}>{editingTermId ? 'Update Term' : 'Add Term'}</button>
                {editingTermId && (
                  <button className="btn btn-sage" onClick={() => {
                    setEditingTermId(null);
                    setTermForm({ term_number: '', label: '', start_date: '', end_date: '' });
                  }}>Cancel</button>
                )}
              </div>
            </div>
            <div className="mt-3 chip-list">
              {terms.map(t => (
                <div key={t.id} className="chip flex-between gap-2" style={{ minWidth: '100%' }}>
                  <div className="flex-col" style={{ gap: 0 }}>
                    <span style={{ fontWeight: 600 }}>{t.label}</span>
                    {t.start_date && <span style={{ fontSize: 10, opacity: 0.6 }}>{new Date(t.start_date).toLocaleDateString()} - {t.end_date ? new Date(t.end_date).toLocaleDateString() : '...'}</span>}
                  </div>
                  <div className="flex-row gap-2">
                    <button onClick={() => startEditTerm(t)} style={{ border: 'none', background: 'none', color: 'var(--color-accent-teal)', cursor: 'pointer', padding: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => deleteTerm(t.id)} style={{ border: 'none', background: 'none', color: 'var(--color-posthog-orange)', cursor: 'pointer', padding: 4 }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Matrix View */}
      <div className="fee-matrix-container">
        <div className="fee-matrix-grid" style={{ gridTemplateColumns: `240px repeat(${terms.length}, 1fr) 180px` }}>
          {/* Header Row */}
          <div className="fee-matrix-header">
            <div className="fee-matrix-cell fee-matrix-header-cell">Grade / Form</div>
            {terms.map(t => (
              <div key={t.id} className="fee-matrix-cell fee-matrix-header-cell text-center">
                <div className="flex-col items-center" style={{ gap: 2 }}>
                  <span>{t.label}</span>
                  {t.start_date && <span style={{ fontSize: 10, opacity: 0.6 }}>Starts: {new Date(t.start_date).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
            <div className="fee-matrix-cell fee-matrix-header-cell text-right">Annual Total</div>
          </div>

          {/* Data Rows */}
          {grades.map(g => {
            let gradeTotal = 0;
            return (
              <div key={g.id} className="fee-matrix-row">
                <div className="fee-matrix-cell fee-matrix-grade-cell">
                  <span className="fee-grade-badge">{g.label}</span>
                </div>
                {terms.map(t => {
                  const cell = matrix[g.id]?.[t.id];
                  if (!cell) return <div key={t.id} className="fee-matrix-cell" />;
                  gradeTotal += parseFloat(cell.amount || '0');
                  return (
                    <div key={t.id} className="fee-matrix-cell">
                      <div className="fee-input-wrapper">
                        <span className="fee-input-currency">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          className="fee-input-matrix"
                          value={cell.amount}
                          onChange={(e) => handleMatrixChange(g.id, t.id, e.target.value)}
                          onBlur={() => saveCell(g.id, t.id)}
                          readOnly={!canManageFees}
                          style={{ cursor: !canManageFees ? 'default' : 'text' }}
                        />
                        {cell.isUnsaved && <div className="matrix-status-indicator matrix-status-unsaved" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} />}
                        {cell.isSaving && <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, border: '2px solid #ccc', borderTopColor: 'var(--color-accent-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
                      </div>
                    </div>
                  );
                })}
                <div className="fee-matrix-cell fee-matrix-total-cell">
                  ${gradeTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            );
          })}
        </div>

        {grades.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-sage-placeholder)' }}>
            No grades defined. Use the Configuration panel to add grades and terms.
          </div>
        )}
      </div>

      <div className="mt-4 flex-row justify-end no-print">
        <button className="btn btn-sage" onClick={() => window.print()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print Fee Structure
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FeeStructureManager;
