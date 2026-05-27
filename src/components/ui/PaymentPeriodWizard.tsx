import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db-client';
import { useToast } from '../Toast';
import ConfirmDialog from './ConfirmDialog';

interface Term {
  id?: number;
  year_id: number;
  term_number: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  period_type?: string;
}

interface PaymentPeriodWizardProps {
  yearId: number;
  yearLabel: string;
  existingTerms: Term[];
  onComplete: () => void;
  onCancel: () => void;
}

type PeriodType = 'month' | 'quarter' | 'half_year' | 'custom';

interface PeriodDraft {
  term_number: number;
  label: string;
  start_date: string;
  end_date: string;
}

const PaymentPeriodWizard: React.FC<PaymentPeriodWizardProps> = ({
  yearId,
  yearLabel,
  existingTerms,
  onComplete,
  onCancel,
}) => {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [periodType, setPeriodType] = useState<PeriodType>('quarter');
  const [customCount, setCustomCount] = useState(3);
  const [periods, setPeriods] = useState<PeriodDraft[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const baseYear = parseInt(yearLabel) || new Date().getFullYear();

  const generatePeriods = (type: PeriodType, customNum?: number): PeriodDraft[] => {
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
      labels.push('Term 1', 'Term 2', 'Term 3', 'Term 4');
      count = 4;
    } else if (type === 'half_year') {
      labels.push('Half 1', 'Half 2');
      count = 2;
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

  useEffect(() => {
    if (existingTerms.length > 0) {
      setPeriods(
        existingTerms.map(t => ({
          term_number: t.term_number,
          label: t.label,
          start_date: t.start_date || '',
          end_date: t.end_date || '',
        }))
      );
      if (existingTerms.length === 12) setPeriodType('month');
      else if (existingTerms.length === 4) setPeriodType('quarter');
      else if (existingTerms.length === 2) setPeriodType('half_year');
      else setPeriodType('custom');
    } else {
      setPeriods(generatePeriods(periodType, customCount));
    }
  }, []);

  const handleTypeChange = (type: PeriodType) => {
    setPeriodType(type);
    setPeriods(generatePeriods(type, type === 'custom' ? customCount : undefined));
  };

  const handleCustomCountChange = (count: number) => {
    setCustomCount(count);
    setPeriods(generatePeriods('custom', count));
  };

  const handlePeriodChange = (index: number, field: keyof PeriodDraft, value: string) => {
    setPeriods(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeletePeriod = (index: number) => {
    setDeletingIndex(index);
    setShowConfirmDelete(true);
  };

  const confirmDelete = () => {
    if (deletingIndex !== null) {
      setPeriods(prev => prev.filter((_, i) => i !== deletingIndex));
      setDeletingIndex(null);
    }
    setShowConfirmDelete(false);
  };

  const handleAddPeriod = () => {
    const newNum = periods.length + 1;
    const monthsPer = Math.floor(12 / newNum);
    const startMonth = periods.length * monthsPer;
    const start = new Date(baseYear, startMonth, 1);
    const end = new Date(baseYear, startMonth + monthsPer, 0);
    setPeriods(prev => [
      ...prev,
      {
        term_number: newNum,
        label: `Period ${newNum}`,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
      },
    ]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.run('DELETE FROM terms WHERE year_id = ?', [yearId]);
      for (const p of periods) {
        await db.run(
          'INSERT INTO terms (year_id, term_number, label, period_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
          [yearId, p.term_number, p.label, periodType, p.start_date || null, p.end_date || null]
        );
      }
      showToast(
        'success',
        'Payment Periods Saved',
        `${periods.length} periods have been created for ${yearLabel}.`
      );
      onComplete();
    } catch (err) {
      console.error('Failed to save periods:', err);
      showToast('error', 'Error', 'Failed to save payment periods.');
    } finally {
      setIsSaving(false);
    }
  };

  const periodTypeOptions = [
    {
      value: 'month',
      label: 'Monthly',
      description: '12 periods (January - December)',
      color: '#3b82f6',
    },
    { value: 'quarter', label: 'Quarterly', description: '4 terms per year', color: '#10b981' },
    { value: 'half_year', label: 'Half Year', description: '2 semesters', color: '#8b5cf6' },
    { value: 'custom', label: 'Custom', description: 'Set your own number', color: '#f59e0b' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: step >= 1 ? 'var(--primary)' : 'var(--color-sage-border)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            1
          </div>
          <span
            style={{
              color: step >= 1 ? 'var(--text-primary)' : 'var(--color-sage-placeholder)',
              fontWeight: 500,
            }}
          >
            Choose Type
          </span>
          <div
            style={{
              flex: 1,
              height: 2,
              background: step >= 2 ? 'var(--primary)' : 'var(--color-sage-border)',
              margin: '0 12px',
            }}
          />
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: step >= 2 ? 'var(--primary)' : 'var(--color-sage-border)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            2
          </div>
          <span
            style={{
              color: step >= 2 ? 'var(--text-primary)' : 'var(--color-sage-placeholder)',
              fontWeight: 500,
            }}
          >
            Customize Dates
          </span>
          <div
            style={{
              flex: 1,
              height: 2,
              background: step >= 3 ? 'var(--primary)' : 'var(--color-sage-border)',
              margin: '0 12px',
            }}
          />
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: step >= 3 ? 'var(--primary)' : 'var(--color-sage-border)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            3
          </div>
          <span
            style={{
              color: step >= 3 ? 'var(--text-primary)' : 'var(--color-sage-placeholder)',
              fontWeight: 500,
            }}
          >
            Confirm
          </span>
        </div>
      </div>

      {step === 1 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>How would you like to split the year?</h3>
          <p style={{ color: 'var(--color-sage-placeholder)', marginBottom: 24 }}>
            Select how many payment periods you want to create for {yearLabel}.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {periodTypeOptions.map(opt => (
              <div
                key={opt.value}
                onClick={() => handleTypeChange(opt.value as PeriodType)}
                style={{
                  padding: 20,
                  borderRadius: 12,
                  border: `2px solid ${periodType === opt.value ? opt.color : 'var(--color-sage-border)'}`,
                  background: periodType === opt.value ? `${opt.color}10` : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>
                  {opt.description}
                </div>
              </div>
            ))}
          </div>
          {periodType === 'custom' && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontWeight: 500 }}>Number of periods:</label>
              <input
                type="number"
                min={1}
                max={12}
                value={customCount}
                onChange={e => handleCustomCountChange(Number(e.target.value))}
                className="input-default"
                style={{ width: 80 }}
              />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ marginBottom: 4 }}>Review and customize dates</h3>
              <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>
                Adjust the start and end dates for each period as needed.
              </p>
            </div>
            <button className="btn btn-sage" onClick={handleAddPeriod}>
              + Add Period
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            {periods.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: 'var(--background)',
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 40,
                    textAlign: 'center',
                    fontWeight: 600,
                    color: 'var(--color-sage-placeholder)',
                  }}
                >
                  #{i + 1}
                </div>
                <input
                  className="input-default"
                  value={p.label}
                  onChange={e => handlePeriodChange(i, 'label', e.target.value)}
                  style={{ flex: 1 }}
                  placeholder="Period name"
                />
                <input
                  className="input-default"
                  type="date"
                  value={p.start_date}
                  onChange={e => handlePeriodChange(i, 'start_date', e.target.value)}
                  style={{ width: 150 }}
                />
                <span style={{ color: 'var(--color-sage-placeholder)' }}>to</span>
                <input
                  className="input-default"
                  type="date"
                  value={p.end_date}
                  onChange={e => handlePeriodChange(i, 'end_date', e.target.value)}
                  style={{ width: 150 }}
                />
                <button
                  onClick={() => handleDeletePeriod(i)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--color-posthog-orange)',
                    cursor: 'pointer',
                    padding: 8,
                  }}
                  title="Delete period"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Confirm your payment periods</h3>
          <p style={{ color: 'var(--color-sage-placeholder)', marginBottom: 24 }}>
            Review the summary below before saving.
          </p>

          <div
            style={{
              background: 'var(--color-sage-cream)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Summary for {yearLabel}</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                fontSize: 14,
              }}
            >
              <div>
                <div style={{ color: 'var(--color-sage-placeholder)', marginBottom: 4 }}>
                  Period Type
                </div>
                <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                  {periodType === 'custom' ? `Custom (${periods.length})` : periodType}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--color-sage-placeholder)', marginBottom: 4 }}>
                  Number of Periods
                </div>
                <div style={{ fontWeight: 500 }}>{periods.length}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-sage-placeholder)', marginBottom: 4 }}>
                  Date Range
                </div>
                <div style={{ fontWeight: 500 }}>
                  {periods[0]?.start_date
                    ? new Date(periods[0].start_date).toLocaleDateString()
                    : '...'}{' '}
                  -{' '}
                  {periods[periods.length - 1]?.end_date
                    ? new Date(periods[periods.length - 1].end_date).toLocaleDateString()
                    : '...'}
                </div>
              </div>
            </div>
          </div>

          {existingTerms.length > 0 && (
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span style={{ fontWeight: 600, color: '#92400e' }}>Warning</span>
              </div>
              <p style={{ margin: 0, color: '#92400e', fontSize: 14 }}>
                This will replace {existingTerms.length} existing payment period(s). Any fees
                associated with the old periods will need to be re-applied.
              </p>
            </div>
          )}

          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-sage-border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Period Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>Start Date</th>
                  <th style={{ textAlign: 'left', padding: '8px 0' }}>End Date</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-sage-border)' }}>
                    <td style={{ padding: '8px 0' }}>{i + 1}</td>
                    <td style={{ padding: '8px 0', fontWeight: 500 }}>{p.label}</td>
                    <td style={{ padding: '8px 0' }}>
                      {p.start_date ? new Date(p.start_date).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '8px 0' }}>
                      {p.end_date ? new Date(p.end_date).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid var(--color-sage-border)',
        }}
      >
        {step > 1 ? (
          <button className="btn btn-sage" onClick={() => setStep(s => s - 1)}>
            Back
          </button>
        ) : (
          <button className="btn btn-sage" onClick={onCancel}>
            Cancel
          </button>
        )}
        {step < 3 ? (
          <button className="btn btn-primary" onClick={() => setStep(s => s + 1)}>
            Next
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : `Save ${periods.length} Periods`}
          </button>
        )}
      </div>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Period"
        message={`Are you sure you want to delete "${periods[deletingIndex ?? 0]?.label}"? This will remove it from the payment schedule.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowConfirmDelete(false);
          setDeletingIndex(null);
        }}
      />
    </div>
  );
};

export default PaymentPeriodWizard;
