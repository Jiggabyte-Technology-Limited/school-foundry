import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';

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
  period_type?: string;
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
}

interface MatrixCell {
  id: number | null;
  amount: string;
  isUnsaved: boolean;
  isSaving: boolean;
}

const FeeStructureManager: React.FC = () => {
  const { user, canManageFees } = useAuth();
  const { showToast } = useToast();
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
  const [termForm, setTermForm] = useState({
    term_number: '',
    label: '',
    start_date: '',
    end_date: '',
  });
  const [editingTermId, setEditingTermId] = useState<number | null>(null);

  // Auto-generate state
  const [autoGenType, setAutoGenType] = useState<'monthly' | 'quarterly' | 'half_year' | 'custom'>(
    'quarterly'
  );
  const [customPeriodCount, setCustomPeriodCount] = useState<number>(3);

  // Same amount per grade state: [gradeId] = boolean
  const [sameAmountPerGrade, setSameAmountPerGrade] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadInitialData();
  }, []);
  useEffect(() => {
    if (selectedYear) loadYearData(selectedYear);
  }, [selectedYear]);

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
      db.all('SELECT * FROM fee_structure WHERE year_id = ?', [yearId]),
    ]);
    setTerms(termList);

    // Build Matrix
    const newMatrix: Record<number, Record<number, MatrixCell>> = {};
    const newSameAmount: Record<number, boolean> = {};
    grades.forEach(g => {
      newMatrix[g.id] = {};
      const gradeFees = feeList.filter(f => f.grade_id === g.id);
      const sameAmount =
        gradeFees.length > 0 && gradeFees.every(f => f.same_amount_all_periods === 1);
      newSameAmount[g.id] = sameAmount;
      termList.forEach(t => {
        const existingFee = feeList.find(f => f.grade_id === g.id && f.term_id === t.id);
        newMatrix[g.id][t.id] = {
          id: existingFee?.id || null,
          amount: existingFee ? (existingFee.amount_cents / 100).toFixed(2) : '0.00',
          isUnsaved: false,
          isSaving: false,
        };
      });
    });
    setMatrix(newMatrix);
    setSameAmountPerGrade(newSameAmount);
  };

  const handleMatrixChange = (gradeId: number, termId: number, value: string) => {
    const isSameAmount = sameAmountPerGrade[gradeId];
    const termIndex = terms.findIndex(t => t.id === termId);

    setMatrix(prev => {
      const newMatrix = { ...prev };
      newMatrix[gradeId] = { ...prev[gradeId] };

      if (isSameAmount && termIndex === 0) {
        // When "Same All" is enabled and editing first period, update all periods
        terms.forEach(t => {
          newMatrix[gradeId][t.id] = {
            ...prev[gradeId][t.id],
            amount: value,
            isUnsaved: true,
          };
        });
      } else {
        newMatrix[gradeId][termId] = {
          ...prev[gradeId][termId],
          amount: value,
          isUnsaved: true,
        };
      }
      return newMatrix;
    });
  };

  const saveCell = async (gradeId: number, termId: number) => {
    const cell = matrix[gradeId][termId];
    if (!cell.isUnsaved || !selectedYear) return;

    if (!canManageFees) {
      alert('You do not have permission to modify the fee structure.');
      return;
    }

    const isSameAmount = sameAmountPerGrade[gradeId];
    const termIndex = terms.findIndex(t => t.id === termId);

    // If "Same All" is enabled and editing first period, save all periods
    if (isSameAmount && termIndex === 0) {
      const amountCents = Math.round(parseFloat(cell.amount || '0') * 100);

      // Set all to saving
      setMatrix(prev => {
        const newMatrix = { ...prev };
        newMatrix[gradeId] = { ...prev[gradeId] };
        terms.forEach(t => {
          newMatrix[gradeId][t.id] = { ...prev[gradeId][t.id], isSaving: true };
        });
        return newMatrix;
      });

      try {
        // Save each period
        for (const t of terms) {
          const tCell = matrix[gradeId][t.id];
          const tAmountCents = Math.round(parseFloat(cell.amount || '0') * 100);
          if (tCell?.id) {
            await db.run(
              'UPDATE fee_structure SET amount_cents = ?, updated_at = datetime("now") WHERE id = ?',
              [tAmountCents, tCell.id]
            );
          } else {
            await db.run(
              'INSERT INTO fee_structure (year_id, term_id, grade_id, amount_cents, same_amount_all_periods) VALUES (?, ?, ?, ?, 1)',
              [selectedYear, t.id, gradeId, tAmountCents]
            );
          }
        }

        // Reload to get proper IDs
        loadYearData(selectedYear);
      } catch (err) {
        console.error('Failed to save fees:', err);
        loadYearData(selectedYear);
      }
      return;
    }

    // Original single cell save logic
    setMatrix(prev => ({
      ...prev,
      [gradeId]: { ...prev[gradeId], [termId]: { ...prev[gradeId][termId], isSaving: true } },
    }));

    try {
      const amountCents = Math.round(parseFloat(cell.amount || '0') * 100);
      if (cell.id) {
        await db.run(
          'UPDATE fee_structure SET amount_cents = ?, updated_at = datetime("now") WHERE id = ?',
          [amountCents, cell.id]
        );
      } else {
        const result = await db.run(
          'INSERT INTO fee_structure (year_id, term_id, grade_id, amount_cents) VALUES (?, ?, ?, ?)',
          [selectedYear, termId, gradeId, amountCents]
        );
        handleMatrixChange(gradeId, termId, cell.amount);
        setMatrix(prev => ({
          ...prev,
          [gradeId]: {
            ...prev[gradeId],
            [termId]: {
              ...prev[gradeId][termId],
              id: result.lastInsertRowid || result.lastID,
              isUnsaved: false,
              isSaving: false,
            },
          },
        }));
        return;
      }

      setMatrix(prev => ({
        ...prev,
        [gradeId]: {
          ...prev[gradeId],
          [termId]: { ...prev[gradeId][termId], isUnsaved: false, isSaving: false },
        },
      }));
    } catch (err) {
      console.error('Failed to save fee:', err);
      setMatrix(prev => ({
        ...prev,
        [gradeId]: { ...prev[gradeId], [termId]: { ...prev[gradeId][termId], isSaving: false } },
      }));
    }
  };

  // Config Actions
  const addYear = async () => {
    if (!yearLabel.trim()) return;
    await db.run('INSERT INTO academic_years (label) VALUES (?)', [yearLabel]);
    showToast('success', 'Year Added', `Academic year ${yearLabel} has been added.`);
    setYearLabel('');
    loadInitialData();
  };

  const addGrade = async () => {
    if (!gradeLabel.trim()) return;
    await db.run('INSERT INTO grades (label) VALUES (?)', [gradeLabel]);
    showToast('success', 'Grade Added', `Grade ${gradeLabel} has been added.`);
    setGradeLabel('');
    loadInitialData();
  };

  const saveTerm = async () => {
    if (!selectedYear || !termForm.label) return;
    if (editingTermId) {
      await db.run(
        'UPDATE terms SET term_number = ?, label = ?, start_date = ?, end_date = ? WHERE id = ?',
        [
          termForm.term_number,
          termForm.label,
          termForm.start_date || null,
          termForm.end_date || null,
          editingTermId,
        ]
      );
    } else {
      await db.run(
        'INSERT INTO terms (year_id, term_number, label, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        [
          selectedYear,
          termForm.term_number,
          termForm.label,
          termForm.start_date || null,
          termForm.end_date || null,
        ]
      );
    }
    showToast(
      'success',
      editingTermId ? 'Period Updated' : 'Period Added',
      `Payment period ${termForm.label} has been ${editingTermId ? 'updated' : 'added'}.`
    );
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
    if (!window.confirm('Delete this payment period and all associated fees?')) return;
    await db.run('DELETE FROM terms WHERE id = ?', [id]);
    if (selectedYear) loadYearData(selectedYear);
  };

  // Auto-generate payment periods
  const generatePaymentPeriods = async () => {
    if (!selectedYear) return;

    let periodLabels: string[] = [];
    let count = 0;
    let periodType = autoGenType;
    const yearLabel =
      years.find(y => y.id === selectedYear)?.label || new Date().getFullYear().toString();
    const baseYear = parseInt(yearLabel) || new Date().getFullYear();

    if (autoGenType === 'monthly') {
      periodLabels = [
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
        'December',
      ];
      count = 12;
    } else if (autoGenType === 'quarterly') {
      periodLabels = ['Term 1', 'Term 2', 'Term 3', 'Term 4'];
      count = 4;
    } else if (autoGenType === 'half_year') {
      periodLabels = ['Half 1', 'Half 2'];
      count = 2;
    } else {
      count = customPeriodCount;
      for (let i = 1; i <= count; i++) {
        periodLabels.push(`Period ${i}`);
      }
    }

    // Clear existing terms for this year
    await db.run('DELETE FROM terms WHERE year_id = ?', [selectedYear]);

    // Calculate dates based on period type
    const getDatesForPeriod = (index: number): { start: string; end: string } => {
      if (autoGenType === 'monthly') {
        const startMonth = index;
        const startDate = new Date(baseYear, startMonth, 1);
        const endDate = new Date(baseYear, startMonth + 1, 0);
        return {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        };
      } else if (autoGenType === 'quarterly') {
        const monthsPerQuarter = 3;
        const startMonth = index * monthsPerQuarter;
        const startDate = new Date(baseYear, startMonth, 1);
        const endDate = new Date(baseYear, startMonth + monthsPerQuarter, 0);
        return {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        };
      } else if (autoGenType === 'half_year') {
        const monthsPerHalf = 6;
        const startMonth = index * monthsPerHalf;
        const startDate = new Date(baseYear, startMonth, 1);
        const endDate = new Date(baseYear, startMonth + monthsPerHalf, 0);
        return {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        };
      } else {
        // Custom - assume equal distribution across 12 months
        const monthsPerPeriod = Math.floor(12 / count);
        const startMonth = index * monthsPerPeriod;
        const startDate = new Date(baseYear, startMonth, 1);
        const endDate =
          index === count - 1
            ? new Date(baseYear, 11, 31)
            : new Date(baseYear, startMonth + monthsPerPeriod, 0);
        return {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        };
      }
    };

    // Insert new periods with calculated dates
    for (let i = 0; i < count; i++) {
      const { start, end } = getDatesForPeriod(i);
      await db.run(
        'INSERT INTO terms (year_id, term_number, label, period_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
        [selectedYear, i + 1, periodLabels[i], periodType, start, end]
      );
    }

    // Set "Same All" to true by default for all grades
    const newSameAmount: Record<number, boolean> = {};
    grades.forEach(g => {
      newSameAmount[g.id] = true;
    });
    setSameAmountPerGrade(newSameAmount);

    showToast(
      'success',
      'Payment Periods Generated',
      `${count} payment periods have been created.`
    );
    loadYearData(selectedYear);
  };

  // Toggle same amount for all periods for a grade
  const toggleSameAmount = async (gradeId: number) => {
    if (!canManageFees) {
      alert('You do not have permission to modify the fee structure.');
      return;
    }

    const newValue = !sameAmountPerGrade[gradeId];
    setSameAmountPerGrade(prev => ({ ...prev, [gradeId]: newValue }));

    // Update all fee_structure records for this grade/year
    await db.run(
      'UPDATE fee_structure SET same_amount_all_periods = ? WHERE year_id = ? AND grade_id = ?',
      [newValue ? 1 : 0, selectedYear, gradeId]
    );

    // If turning on, copy first period's amount to all other periods
    if (newValue && terms.length > 1) {
      const firstTermId = terms[0].id;
      const firstCell = matrix[gradeId]?.[firstTermId];
      if (firstCell?.id) {
        const amountCents = Math.round(parseFloat(firstCell.amount || '0') * 100);
        for (let i = 1; i < terms.length; i++) {
          const termId = terms[i].id;
          const existingCell = matrix[gradeId]?.[termId];
          if (existingCell?.id) {
            await db.run(
              'UPDATE fee_structure SET amount_cents = ?, same_amount_all_periods = 1 WHERE id = ?',
              [amountCents, existingCell.id]
            );
          } else {
            await db.run(
              'INSERT INTO fee_structure (year_id, term_id, grade_id, amount_cents, same_amount_all_periods) VALUES (?, ?, ?, ?, 1)',
              [selectedYear, termId, gradeId, amountCents]
            );
          }
        }
        // Reload to reflect changes
        if (selectedYear) {
          loadYearData(selectedYear);
        }
      }
    }
  };

  return (
    <div className="page-content">
      <div className="flex-between mb-4">
        <div className="flex-col" style={{ gap: 4 }}>
          <h1 style={{ margin: 0 }}>Fee Structure</h1>
          <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>
            Manage and automate tuition fees across all grades.
          </p>
        </div>
        <div className="flex-row gap-3">
          <div
            className="flex-row gap-2"
            style={{
              backgroundColor: 'white',
              padding: '4px 12px',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid var(--color-sage-border)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-sage-placeholder)' }}>
              YEAR:
            </span>
            <select
              value={selectedYear || ''}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{
                border: 'none',
                fontWeight: 700,
                color: 'var(--primary)',
                outline: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
          {canManageFees && (
            <button
              className={`config-toggle-btn ${showConfig ? 'active' : ''}`}
              onClick={() => setShowConfig(!showConfig)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Configuration
            </button>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      <div
        className={`config-panel ${showConfig ? 'open' : ''}`}
        style={{
          backgroundColor: 'var(--color-sage-cream)',
          borderRadius: 'var(--border-radius-xl)',
          padding: showConfig ? '32px' : '0 32px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px',
            maxWidth: '1400px',
            margin: '0 auto',
          }}
        >
          <div className="card" style={{ padding: '24px', height: '100%' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
                <path d="M8 7h6" />
                <path d="M8 11h8" />
              </svg>
              Academic Years
            </h4>
            <div className="flex-row gap-2 mb-3">
              <input
                className="input-default"
                placeholder="e.g. 2026"
                value={yearLabel}
                onChange={e => setYearLabel(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addYear}>
                Add
              </button>
            </div>
            <div className="chip-list">
              {years.map(y => (
                <span key={y.id} className="chip">
                  {y.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', height: '100%' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg
                width="18"
                height="18"
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
              Grades/Forms
            </h4>
            <div className="flex-row gap-2 mb-3">
              <input
                className="input-default"
                placeholder="e.g. Form 1"
                value={gradeLabel}
                onChange={e => setGradeLabel(e.target.value)}
              />
              <button className="btn btn-primary" onClick={addGrade}>
                Add
              </button>
            </div>
            <div className="chip-list">
              {grades.map(g => (
                <span key={g.id} className="chip">
                  {g.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', height: '100%' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Payment Periods Setup
            </h4>

            {/* Auto-generate section */}
            <div
              className="flex-col gap-2 mb-3"
              style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8 }}
            >
              <span
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-sage-placeholder)' }}
              >
                Auto-generate Periods:
              </span>
              <div className="flex-row gap-2">
                <select
                  className="input-default"
                  value={autoGenType}
                  onChange={e => setAutoGenType(e.target.value as any)}
                  style={{ flex: 1 }}
                >
                  <option value="monthly">Monthly (12)</option>
                  <option value="quarterly">Quarterly (4)</option>
                  <option value="half_year">Half Year (2)</option>
                  <option value="custom">Custom</option>
                </select>
                {autoGenType === 'custom' && (
                  <input
                    className="input-default"
                    type="number"
                    min="1"
                    max="12"
                    value={customPeriodCount}
                    onChange={e => setCustomPeriodCount(Number(e.target.value))}
                    style={{ width: 60 }}
                    placeholder="#"
                  />
                )}
                <button className="btn btn-primary" onClick={generatePaymentPeriods}>
                  Generate
                </button>
              </div>
            </div>

            <div className="flex-col gap-2">
              <div className="flex-row gap-2">
                <input
                  className="input-default"
                  style={{ width: 60 }}
                  type="number"
                  placeholder="#"
                  value={termForm.term_number}
                  onChange={e => setTermForm({ ...termForm, term_number: e.target.value })}
                />
                <input
                  className="input-default flex-1"
                  placeholder="Period Name"
                  value={termForm.label}
                  onChange={e => setTermForm({ ...termForm, label: e.target.value })}
                />
              </div>
              <div className="flex-row gap-2">
                <input
                  className="input-default flex-1"
                  type="date"
                  value={termForm.start_date}
                  onChange={e => setTermForm({ ...termForm, start_date: e.target.value })}
                />
                <input
                  className="input-default flex-1"
                  type="date"
                  value={termForm.end_date}
                  onChange={e => setTermForm({ ...termForm, end_date: e.target.value })}
                />
              </div>
              <div className="flex-row gap-2">
                <button className="btn btn-primary flex-1" onClick={saveTerm}>
                  {editingTermId ? 'Update Period' : 'Add Period'}
                </button>
                {editingTermId && (
                  <button
                    className="btn btn-sage"
                    onClick={() => {
                      setEditingTermId(null);
                      setTermForm({ term_number: '', label: '', start_date: '', end_date: '' });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 chip-list">
            {terms.map(t => (
              <div key={t.id} className="chip flex-between gap-2" style={{ minWidth: '100%' }}>
                <div className="flex-col" style={{ gap: 0 }}>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  {t.start_date && (
                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                      {new Date(t.start_date).toLocaleDateString()} -{' '}
                      {t.end_date ? new Date(t.end_date).toLocaleDateString() : '...'}
                    </span>
                  )}
                </div>
                <div className="flex-row gap-2">
                  <button
                    onClick={() => startEditTerm(t)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--color-accent-teal)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteTerm(t.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--color-posthog-orange)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {/* Manual Debit Button */}
            <div
              className="mt-3"
              style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8 }}
            >
              <button
                className="btn btn-sage"
                onClick={async () => {
                  try {
                    const result = await window.api.autoDebitFees();
                    if (result.success) {
                      showToast(
                        'success',
                        'Debit Complete',
                        'Check console (F12) for details. Fees should now appear on student accounts.'
                      );
                    } else {
                      showToast(
                        'info',
                        'No Fees Debited',
                        'No pending fees found. Make sure: 1) Students are enrolled, 2) Fee structure is set, 3) Payment periods have start dates.'
                      );
                    }
                  } catch (err) {
                    console.error('Auto-debit error:', err);
                    showToast('error', 'Error', 'Failed to debit fees. Check console for details.');
                  }
                }}
                style={{ width: '100%' }}
              >
                Apply Fees to Students
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Matrix View */}
      <div className="fee-matrix-container">
        <div
          className="fee-matrix-grid"
          style={{ gridTemplateColumns: `200px 80px repeat(${terms.length}, 1fr) 160px` }}
        >
          {/* Header Row */}
          <div className="fee-matrix-header">
            <div className="fee-matrix-cell fee-matrix-header-cell">Grade / Form</div>
            <div
              className="fee-matrix-cell fee-matrix-header-cell text-center"
              style={{ fontSize: '0.7rem' }}
            >
              Same All?
            </div>
            {terms.map(t => (
              <div key={t.id} className="fee-matrix-cell fee-matrix-header-cell text-center">
                <div className="flex-col items-center" style={{ gap: 2 }}>
                  <span>{t.label}</span>
                  {(t.start_date || t.end_date) && (
                    <span style={{ fontSize: 9, opacity: 0.6, whiteSpace: 'nowrap' }}>
                      {t.start_date
                        ? new Date(t.start_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No start'}
                      {' - '}
                      {t.end_date
                        ? new Date(t.end_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No end'}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div className="fee-matrix-cell fee-matrix-header-cell text-right">Total</div>
          </div>

          {/* Data Rows */}
          {grades.map(g => {
            let gradeTotal = 0;
            return (
              <div key={g.id} className="fee-matrix-row">
                <div className="fee-matrix-cell fee-matrix-grade-cell">
                  <span className="fee-grade-badge">{g.label}</span>
                </div>
                <div className="fee-matrix-cell" style={{ justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={sameAmountPerGrade[g.id] || false}
                    onChange={() => toggleSameAmount(g.id)}
                    disabled={!canManageFees}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: canManageFees ? 'pointer' : 'not-allowed',
                    }}
                    title={
                      sameAmountPerGrade[g.id]
                        ? 'Same amount for all payment periods'
                        : 'Click to set same amount for all periods'
                    }
                  />
                </div>
                {terms.map(t => {
                  const cell = matrix[g.id]?.[t.id];
                  if (!cell) return <div key={t.id} className="fee-matrix-cell" />;
                  gradeTotal += parseFloat(cell.amount || '0');
                  const isSameAmount = sameAmountPerGrade[g.id];
                  return (
                    <div key={t.id} className="fee-matrix-cell">
                      <div className="fee-input-wrapper">
                        <span className="fee-input-currency">$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="fee-input-matrix"
                          value={cell.amount}
                          onChange={e => handleMatrixChange(g.id, t.id, e.target.value)}
                          onBlur={() => saveCell(g.id, t.id)}
                          readOnly={!canManageFees || (isSameAmount && terms.indexOf(t) > 0)}
                          style={{
                            cursor: !canManageFees
                              ? 'default'
                              : isSameAmount && terms.indexOf(t) > 0
                                ? 'not-allowed'
                                : 'text',
                            backgroundColor:
                              isSameAmount && terms.indexOf(t) > 0 ? 'rgba(0,0,0,0.05)' : 'white',
                          }}
                        />
                        {cell.isUnsaved && (
                          <div
                            className="matrix-status-indicator matrix-status-unsaved"
                            style={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                            }}
                          />
                        )}
                        {cell.isSaving && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 12,
                              height: 12,
                              border: '2px solid #ccc',
                              borderTopColor: 'var(--color-accent-teal)',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="fee-matrix-cell fee-matrix-total-cell">
                  $
                  {gradeTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {grades.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-sage-placeholder)' }}>
            No grades defined. Use the Configuration panel to add grades and payment periods.
          </div>
        )}
      </div>

      <div className="mt-4 flex-row justify-end no-print">
        <button className="btn btn-sage" onClick={() => window.print()}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginRight: 8 }}
          >
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
