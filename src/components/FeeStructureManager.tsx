import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';
import ConfigWizard from './ui/ConfigWizard';
import ChipSelector from './ui/ChipSelector';
import { generateFeeStructureHtml, printDocument } from '../lib/print-service';
import { getCurrencySymbol, getCurrencies, loadCurrency, setCurrency } from '../lib/currency';
import {
  validateGradeName,
  nextSortOrder,
  computeMoveUp,
  computeMoveDown,
  buildGradeActivityEntry,
  SUGGESTED_GRADES,
  type GradeRow,
} from './setup-wizard/school-structure-actions';

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
  sort_order: number;
  is_active: number; // 0 or 1
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
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false); // Legacy - keeping for backward compat
  const [showWizard, setShowWizard] = useState(false);
  const [schoolName, setSchoolName] = useState('School Management');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolContact, setSchoolContact] = useState('');
  const [schoolFeesTerms, setSchoolFeesTerms] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');

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
    const [
      yearList,
      gradeList,
      nameSetting,
      logoSetting,
      phoneSetting,
      emailSetting,
      feesTermsSetting,
    ] = await Promise.all([
      db.all('SELECT * FROM academic_years ORDER BY label DESC'),
      db.all('SELECT * FROM grades ORDER BY sort_order, label'),
      db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
      db.get("SELECT value FROM app_settings WHERE key = 'school_logo'"),
      db.get("SELECT value FROM app_settings WHERE key = 'school_phone'"),
      db.get("SELECT value FROM app_settings WHERE key = 'school_email'"),
      db.get("SELECT value FROM app_settings WHERE key = 'school_fees_terms'"),
    ]);
    setYears(yearList);
    setGrades(gradeList);
    if (yearList.length > 0 && !selectedYear) setSelectedYear(yearList[0].id);

    // Set school settings
    setSchoolName(nameSetting?.value || 'School Management');
    setSchoolLogo(logoSetting?.value || null);
    const phone = phoneSetting?.value || '';
    const email = emailSetting?.value || '';
    setSchoolContact([phone, email].filter(Boolean).join(' | '));
    setSchoolFeesTerms(feesTermsSetting?.value || '');

    // Load currency from global utility
    const curr = await loadCurrency();
    setCurrencyCode(curr);
    setLoading(false);
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
      // Default to true (Copy to All checked by default)
      const sameAmount = true;
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
      alert('You do not have permission to modify the school fees.');
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

  const saveAllChanges = async () => {
    if (!selectedYear || !canManageFees) return;

    const unsavedCells: { gradeId: number; termId: number; cell: MatrixCell }[] = [];
    Object.entries(matrix).forEach(([gradeId, termCells]) => {
      Object.entries(termCells).forEach(([termId, cell]) => {
        if (cell.isUnsaved) {
          unsavedCells.push({ gradeId: Number(gradeId), termId: Number(termId), cell });
        }
      });
    });

    if (unsavedCells.length === 0) {
      showToast('info', 'No Changes', 'All fee amounts are already saved.');
      return;
    }

    // Mark all as saving
    setMatrix(prev => {
      const newMatrix = { ...prev };
      unsavedCells.forEach(({ gradeId, termId }) => {
        newMatrix[gradeId] = { ...newMatrix[gradeId] };
        newMatrix[gradeId][termId] = { ...newMatrix[gradeId][termId], isSaving: true };
      });
      return newMatrix;
    });

    let savedCount = 0;
    let errorCount = 0;

    for (const { gradeId, termId, cell } of unsavedCells) {
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
          setMatrix(prev => ({
            ...prev,
            [gradeId]: {
              ...prev[gradeId],
              [termId]: { ...prev[gradeId][termId], id: result.lastInsertRowid || result.lastID },
            },
          }));
        }
        savedCount++;
      } catch (err) {
        console.error('Failed to save fee:', err);
        errorCount++;
      }
    }

    // Mark all as saved
    setMatrix(prev => {
      const newMatrix = { ...prev };
      unsavedCells.forEach(({ gradeId, termId }) => {
        newMatrix[gradeId] = { ...newMatrix[gradeId] };
        newMatrix[gradeId][termId] = {
          ...newMatrix[gradeId][termId],
          isUnsaved: false,
          isSaving: false,
        };
      });
      return newMatrix;
    });

    if (errorCount > 0) {
      showToast('error', 'Save Incomplete', `${savedCount} saved, ${errorCount} failed.`);
    } else {
      showToast('success', 'Fees Saved', `${savedCount} fee amount(s) have been saved.`);
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

  // -------------------------------------------------------------------------
  // School Structure — grade CRUD + audit
  // -------------------------------------------------------------------------

  // Local edit/rename buffer; key=grade.id, value=current typed label.
  const [editingGradeId, setEditingGradeId] = useState<number | null>(null);
  const [editingGradeLabel, setEditingGradeLabel] = useState('');
  const [showArchivedGrades, setShowArchivedGrades] = useState(false);

  const wrapGradeActivity = async (
    grade: GradeRow,
    action:
      | 'GRADE_CREATED'
      | 'GRADE_RENAMED'
      | 'GRADE_ARCHIVED'
      | 'GRADE_RESTORED'
      | 'GRADE_REORDERED',
    extra?: Record<string, unknown>
  ) => {
    const entry = buildGradeActivityEntry(action, grade, extra);
    try {
      await db.run(
        'INSERT INTO activity_log (action, entity, entity_id, details) VALUES (?, ?, ?, ?)',
        [entry.action, 'grades', grade.id, entry.details]
      );
    } catch (e) {
      console.warn('[activity_log] grade mutation not recorded:', e);
    }
  };

  const addGrade = async () => {
    const r = validateGradeName(grades, gradeLabel);
    if (!r.ok) {
      showToast('error', 'Cannot add grade', r.reason);
      return;
    }
    const sortOrder = nextSortOrder(grades);
    const result = await db.run(
      'INSERT INTO grades (label, sort_order, is_active) VALUES (?, ?, 1)',
      [r.label, sortOrder]
    );
    const newId: number =
      (result as any).lastInsertRowid ?? (result as any).lastID ?? 0;
    await wrapGradeActivity(
      { id: newId, label: r.label, sort_order: sortOrder, is_active: 1 },
      'GRADE_CREATED'
    );
    showToast('success', 'Grade added', `"${r.label}" is now in your structure.`);
    setGradeLabel('');
    loadInitialData();
  };

  const startRenameGrade = (g: GradeRow) => {
    setEditingGradeId(g.id);
    setEditingGradeLabel(g.label);
  };

  const cancelRenameGrade = () => {
    setEditingGradeId(null);
    setEditingGradeLabel('');
  };

  const commitRenameGrade = async (g: GradeRow) => {
    const r = validateGradeName(grades, editingGradeLabel, g.id);
    if (!r.ok) {
      showToast('error', 'Cannot rename', r.reason);
      return;
    }
    if (r.label === g.label) {
      cancelRenameGrade();
      return;
    }
    await db.run('UPDATE grades SET label = ? WHERE id = ?', [r.label, g.id]);
    await wrapGradeActivity(g, 'GRADE_RENAMED', { from: g.label, to: r.label });
    showToast('success', 'Grade renamed', `"${g.label}" -> "${r.label}".`);
    cancelRenameGrade();
    loadInitialData();
  };

  const archiveGrade = async (g: GradeRow) => {
    await db.run('UPDATE grades SET is_active = 0 WHERE id = ?', [g.id]);
    await wrapGradeActivity(g, 'GRADE_ARCHIVED', { was_active: g.is_active });
    showToast('info', 'Grade archived', `"${g.label}" is now read-only.`);
    loadInitialData();
  };

  const restoreGrade = async (g: GradeRow) => {
    await db.run('UPDATE grades SET is_active = 1 WHERE id = ?', [g.id]);
    await wrapGradeActivity(g, 'GRADE_RESTORED', { is_active: 1 });
    showToast('success', 'Grade restored', `"${g.label}" is active again.`);
    loadInitialData();
  };

  const moveGrade = async (g: GradeRow, index: number, direction: 'up' | 'down') => {
    const orderedActive = grades.filter(x => x.is_active === 1);
    const reorderFn = direction === 'up'
      ? computeMoveUp(orderedActive, index)
      : computeMoveDown(orderedActive, index);
    if (!reorderFn) return; // boundary
    await db.run('BEGIN');
    try {
      for (const r of reorderFn) {
        await db.run('UPDATE grades SET sort_order = ? WHERE id = ?', [
          r.sort_order,
          r.id,
        ]);
      }
      await db.run('COMMIT');
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }
    await wrapGradeActivity(g, 'GRADE_REORDERED', {
      direction,
      from_position: index,
      to_position: direction === 'up' ? index - 1 : index + 1,
    });
    showToast('success', 'Grades reordered', `"${g.label}" moved ${direction}.`);
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
      alert('You do not have permission to modify the school fees.');
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

  const buildFeeExportData = () => {
    const selectedYearLabel = years.find(y => y.id === selectedYear)?.label || '';
    const rows: Array<{ gradeLabel: string; termLabel: string; amount: number }> = [];
    const gradeTotals: Array<{ label: string; total: number }> = [];
    let overallTotal = 0;

    grades.forEach(g => {
      let gradeTotal = 0;
      terms.forEach(t => {
        const cell = matrix[g.id]?.[t.id];
        const amount = cell ? parseFloat(cell.amount) : 0;
        if (amount > 0) {
          rows.push({
            gradeLabel: g.label,
            termLabel: t.label,
            amount,
          });
          gradeTotal += amount;
          overallTotal += amount;
        }
      });
      if (gradeTotal > 0) {
        gradeTotals.push({ label: g.label, total: gradeTotal });
      }
    });

    return { selectedYearLabel, rows, gradeTotals, overallTotal };
  };

  const handleExportFees = async () => {
    const { selectedYearLabel, rows, gradeTotals, overallTotal } = buildFeeExportData();

    if (rows.length === 0) {
      showToast('info', 'No Fees', 'No fee amounts have been set. Please enter fees first.');
      return;
    }

    try {
      const result = await window.api.exportXlsxReport({
        suggestedFileName: `school-fees-${selectedYearLabel || 'export'}`,
        workbook: {
          sheetName: 'School Fees',
          topRows: [
            { value: schoolName, mergeAcross: 2 },
            { value: 'School Fees Structure', mergeAcross: 2 },
            { value: `Academic Year: ${selectedYearLabel || '-'}`, mergeAcross: 2 },
            {
              value:
                [new Date().toLocaleDateString(), schoolContact].filter(Boolean).join(' | ') ||
                'School fees export',
              mergeAcross: 2,
            },
          ],
          columns: [
            { key: 'gradeLabel', header: 'Grade/Form', width: 24 },
            { key: 'termLabel', header: 'Payment Period', width: 24 },
            { key: 'amount', header: 'Amount', width: 16, type: 'currency' },
          ],
          rows,
          summaryRows: [
            ...gradeTotals.map(entry => ({
              label: `${entry.label} Total`,
              value: entry.total,
              valueType: 'currency',
            })),
            {
              label: 'Overall Total',
              value: overallTotal,
              valueType: 'currency',
            },
          ],
          freezeRows: 5,
          autoFilter: true,
        },
      });

      if (result.success) {
        showToast('success', 'Excel Exported', `Saved to ${result.filePath}`);
      } else if (!result.canceled) {
        showToast('error', 'Export Failed', result.error || 'Could not export school fees.');
      }
    } catch (err) {
      showToast(
        'error',
        'Export Failed',
        err instanceof Error ? err.message : 'Could not export school fees.'
      );
    }
  };

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 40px',
          gap: '16px',
        }}
        className="text-display"
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
        </svg>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading fees...</span>
      </div>
    );

  return (
    <div className="page-content">
      <div className="flex-between mb-4">
        <div className="flex-col" style={{ gap: 4 }}>
          <h1 style={{ margin: 0 }}>School Fees</h1>
          <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>
            Manage and automate tuition fees across all grades/forms.
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
              CURRENCY:
            </span>
            <select
              value={currencyCode}
              onChange={async e => {
                const newCode = e.target.value;
                setCurrencyCode(newCode);
                await setCurrency(newCode);
              }}
              style={{
                border: 'none',
                fontWeight: 700,
                color: 'var(--primary)',
                outline: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {getCurrencies().map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Setup Card */}
      {canManageFees && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            background: 'linear-gradient(135deg, var(--color-sage-cream) 0%, #f0fdf4 100%)',
            borderRadius: 12,
            border: '1px solid var(--color-accent-teal)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--color-accent-teal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>
                School Setup
              </h4>
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: 13,
                  color: 'var(--color-sage-placeholder)',
                }}
              >
                Add or edit academic years, grades/forms, and payment periods
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowWizard(true)}
            style={{ padding: '12px 24px' }}
          >
            Open Setup
          </button>
        </div>
      )}

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
              School Structure
            </h4>
            <p className="text-secondary" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
              Add, rename, archive, and reorder the grades your school runs.
              Archived grades are kept in the database so historical
              payments still resolve.
            </p>

            <div className="flex-row gap-2 mb-3">
              <input
                className="input-default"
                placeholder="e.g. Senior Infants"
                value={gradeLabel}
                onChange={e => setGradeLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGrade();
                  }
                }}
                aria-label="New grade name"
              />
              <button className="btn btn-primary" onClick={addGrade}>
                Add
              </button>
            </div>

            {/* Palette hint — guided pick. Pure palette mention only; admin clicks the input above. */}
            <div
              className="chip-list"
              style={{ marginBottom: 14, alignItems: 'center' }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  marginRight: 4,
                }}
              >
                Suggested:
              </span>
              {SUGGESTED_GRADES.slice(0, 6).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeLabel(g)}
                  className="chip"
                  style={{
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                  }}
                >
                  + {g}
                </button>
              ))}
              {SUGGESTED_GRADES.length > 6 && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                  }}
                >
                  +{SUGGESTED_GRADES.length - 6} more
                </span>
              )}
            </div>

            {/* Active grade list */}
            <div style={{ marginBottom: 12 }}>
              {(() => {
                const active = grades.filter(g => g.is_active === 1);
                if (active.length === 0) {
                  return (
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                      }}
                    >
                      No active grades yet. Add one above.
                    </span>
                  );
                }
                return active.map((g, idx) => {
                  const isEditing = editingGradeId === g.id;
                  return (
                    <div
                      key={g.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        marginBottom: 6,
                      }}
                    >
                      {isEditing ? (
                        <>
                          <input
                            className="input-default"
                            value={editingGradeLabel}
                            onChange={e => setEditingGradeLabel(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitRenameGrade(g);
                              } else if (e.key === 'Escape') {
                                cancelRenameGrade();
                              }
                            }}
                            autoFocus
                            aria-label={`Rename grade ${g.label}`}
                            style={{ flex: 1, padding: '4px 8px' }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => commitRenameGrade(g)}
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={cancelRenameGrade}
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                            {g.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => moveGrade(g, idx, 'up')}
                            disabled={idx === 0}
                            aria-label={`Move ${g.label} up`}
                            className="btn"
                            style={{
                              padding: '2px 8px',
                              fontSize: 12,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                              opacity: idx === 0 ? 0.4 : 1,
                              cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveGrade(g, idx, 'down')}
                            disabled={idx === active.length - 1}
                            aria-label={`Move ${g.label} down`}
                            className="btn"
                            style={{
                              padding: '2px 8px',
                              fontSize: 12,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                              opacity: idx === active.length - 1 ? 0.4 : 1,
                              cursor:
                                idx === active.length - 1
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => startRenameGrade(g)}
                            aria-label={`Rename ${g.label}`}
                            className="btn"
                            style={{
                              padding: '2px 10px',
                              fontSize: 12,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => archiveGrade(g)}
                            aria-label={`Archive ${g.label}`}
                            className="btn"
                            style={{
                              padding: '2px 10px',
                              fontSize: 12,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Archived section */}
            {(() => {
              const archived = grades.filter(g => g.is_active === 0);
              if (archived.length === 0) return null;
              return (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowArchivedGrades(s => !s)}
                    className="btn"
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {showArchivedGrades ? 'Hide' : 'Show'} archived ({archived.length})
                  </button>
                  {showArchivedGrades && (
                    <div style={{ marginTop: 8 }}>
                      {archived.map(g => (
                        <div
                          key={g.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(0,0,0,0.03)',
                            marginBottom: 6,
                            opacity: 0.7,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              textDecoration: 'line-through',
                            }}
                          >
                            {g.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              marginRight: 4,
                            }}
                          >
                            archived
                          </span>
                          <button
                            type="button"
                            onClick={() => restoreGrade(g)}
                            aria-label={`Restore ${g.label}`}
                            className="btn btn-primary"
                            style={{
                              padding: '2px 10px',
                              fontSize: 12,
                            }}
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
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
              <ChipSelector
                label="Auto-generate Periods"
                value={autoGenType}
                onChange={value => setAutoGenType((value as any) || 'monthly')}
                options={[
                  { value: 'monthly', label: 'Monthly (12)' },
                  { value: 'quarterly', label: 'Quarterly (4)' },
                  { value: 'half_year', label: 'Half Year (2)' },
                  { value: 'custom', label: 'Custom' },
                ]}
              />
              <div className="flex-row gap-2">
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
                        'Check console (F12) for details. Fees should now appear on learner accounts.'
                      );
                    } else {
                      showToast(
                        'info',
                        'No Fees Debited',
                        'No pending fees found. Make sure: 1) Learners are enrolled, 2) School fees are set, 3) Payment periods have start dates.'
                      );
                    }
                  } catch (err) {
                    console.error('Auto-debit error:', err);
                    showToast('error', 'Error', 'Failed to debit fees. Check console for details.');
                  }
                }}
                style={{ width: '100%' }}
              >
                Apply Fees to Learners
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Matrix View */}
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Fee Amounts by Grade/Form</h3>
            <p
              style={{ margin: '4px 0 0 0', color: 'var(--color-sage-placeholder)', fontSize: 13 }}
            >
              Enter the tuition fee for each grade/form. Use "Copy to All" to apply one amount to
              every period, or uncheck it to set different amounts per period.
            </p>
          </div>
          {canManageFees &&
            (() => {
              const unsavedCount = Object.values(matrix).flatMap(
                termCells => Object.values(termCells).filter(cell => cell.isUnsaved).length
              );
              const hasChanges = unsavedCount > 0;
              return (
                <button
                  className={hasChanges ? 'btn btn-primary' : 'btn'}
                  onClick={saveAllChanges}
                  disabled={!hasChanges}
                  style={{
                    position: 'relative',
                    opacity: hasChanges ? 1 : 0.5,
                    cursor: hasChanges ? 'pointer' : 'not-allowed',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ marginRight: 8 }}
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  {hasChanges ? 'Save Changes' : 'Auto-Save On'}
                  {hasChanges && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        background: 'var(--color-posthog-orange)',
                        color: 'white',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {unsavedCount}
                    </span>
                  )}
                </button>
              );
            })()}
        </div>
      </div>
      <div className="fee-matrix-container">
        <div
          className="fee-matrix-grid"
          style={{
            gridTemplateColumns: `200px 80px repeat(${terms.length}, minmax(120px, 1fr)) 160px`,
            minWidth: 'max-content',
          }}
        >
          {/* Header Row */}
          <div className="fee-matrix-header">
            <div
              className="fee-matrix-cell fee-matrix-header-cell text-center"
              style={{
                fontWeight: 700,
                fontSize: 14,
                position: 'sticky',
                left: 0,
                zIndex: 20,
                backgroundColor: 'var(--secondary)',
                boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
              }}
            >
              Grade / Form
            </div>
            <div
              className="fee-matrix-cell fee-matrix-header-cell text-center"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--color-sage-placeholder)',
                position: 'sticky',
                left: 200,
                zIndex: 20,
                backgroundColor: 'var(--secondary)',
                boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
              }}
              title="When enabled, enter the fee in the first period and it copies to all other periods"
            >
              Copy to All
            </div>
            {terms.map(t => (
              <div
                key={t.id}
                className="fee-matrix-cell fee-matrix-header-cell text-center"
                style={{ fontWeight: 600, fontSize: 13 }}
              >
                <div className="flex-col items-center" style={{ gap: 2 }}>
                  <span style={{ color: 'var(--primary)' }}>{t.label}</span>
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
            <div
              className="fee-matrix-cell fee-matrix-header-cell text-right"
              style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-sage-placeholder)' }}
            >
              Year Total
            </div>
          </div>

          {/* Data Rows */}
          {grades.map(g => {
            let gradeTotal = 0;
            return (
              <div key={g.id} className="fee-matrix-row">
                <div className="fee-matrix-cell fee-matrix-grade-cell">
                  <span className="fee-grade-badge">{g.label}</span>
                </div>
                <div
                  className="fee-matrix-cell fee-matrix-cell-copy-all"
                  style={{
                    justifyContent: 'center',
                    backgroundColor: sameAmountPerGrade[g.id] ? '#d1fae5' : 'var(--surface)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sameAmountPerGrade[g.id] || false}
                    onChange={() => toggleSameAmount(g.id)}
                    disabled={!canManageFees}
                    style={{
                      width: 18,
                      height: 18,
                      cursor: canManageFees ? 'pointer' : 'not-allowed',
                      accentColor: 'var(--color-accent-teal)',
                    }}
                    title={
                      sameAmountPerGrade[g.id]
                        ? 'Copy to All is ON. Enter the fee in the first period column and it applies to all periods. Click to disable.'
                        : 'Click to enable Copy to All: enter the fee once in the first period and it applies to all periods.'
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
                        <span className="fee-input-currency">{getCurrencySymbol()}</span>
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
                  {getCurrencySymbol()}
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
            No grades/forms defined. Use the Setup button to add grades/forms and payment periods.
          </div>
        )}
      </div>

      {grades.length > 0 && terms.length > 0 && null}

      <div className="mt-4 flex-row justify-end no-print">
        <button
          className="btn btn-sage"
          onClick={async () => {
            const { selectedYearLabel, rows, gradeTotals } = buildFeeExportData();

            if (rows.length === 0) {
              showToast(
                'info',
                'No Fees',
                'No fee amounts have been set. Please enter fees first.'
              );
              return;
            }

            const html = generateFeeStructureHtml({
              schoolName,
              schoolLogo: schoolLogo || undefined,
              schoolContact: schoolContact || undefined,
              academicYear: selectedYearLabel,
              generatedAt: new Date().toLocaleDateString(),
              currencySymbol: getCurrencySymbol(),
              rows: rows.map(row => ({
                ...row,
                amount: row.amount.toFixed(2),
              })),
              gradeTotals: gradeTotals.reduce<Record<string, string>>((acc, entry) => {
                acc[entry.label] = entry.total.toFixed(2);
                return acc;
              }, {}),
              feesTerms: schoolFeesTerms || undefined,
            });

            await printDocument({
              html,
              filename: `school-fees-${selectedYearLabel}.pdf`,
              title: 'School Fees Structure',
            });
          }}
        >
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
          Print School Fees
        </button>
        <button className="btn btn-outline" onClick={handleExportFees} style={{ marginLeft: 12 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginRight: 8 }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Excel
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>

      <ConfigWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onDataChange={() => {
          loadInitialData();
          if (selectedYear) loadYearData(selectedYear);
        }}
      />
    </div>
  );
};

export default FeeStructureManager;
