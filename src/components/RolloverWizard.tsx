/**
 * RolloverWizard — 4-step Year-End Rollover UI
 *
 * Steps:
 *   1. Configure (year label, options)
 *   2. Preview & Exceptions (promote/graduate/repeater)
 *   3. Confirm & Execute
 *   4. Result
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/db-client';
import { useToast } from './Toast';
import { previewRollover, executeRollover, type RolloverPreview, type RolloverOptions, type RolloverResult } from '../lib/fees/rollover';

interface RolloverWizardProps {
  onClose: () => void;
}

type Step = 'configure' | 'preview' | 'confirm' | 'result';

const RolloverWizard: React.FC<RolloverWizardProps> = ({ onClose }) => {
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>('configure');
  const [preview, setPreview] = useState<RolloverPreview | null>(null);
  const [result, setResult] = useState<RolloverResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Step 1 state
  const [currentYearId, setCurrentYearId] = useState<number | null>(null);
  const [currentYearLabel, setCurrentYearLabel] = useState('');
  const [newYearLabel, setNewYearLabel] = useState('');
  const [copyFeeStructure, setCopyFeeStructure] = useState(true);
  const [copyClassSections, setCopyClassSections] = useState(true);
  const [promoteAutomatically, setPromoteAutomatically] = useState(true);
  const [repeaterIds, setRepeaterIds] = useState<number[]>([]);
  const [finalGradeOverride, setFinalGradeOverride] = useState<number | null>(null);

  // Load current year on mount
  useEffect(() => {
    (async () => {
      const year = await db.get('SELECT * FROM academic_years WHERE is_current = 1');
      if (year) {
        setCurrentYearId(year.id);
        setCurrentYearLabel(year.label);
        const nextYear = String(parseInt(year.label, 10) + 1);
        setNewYearLabel(nextYear);
      }
    })();
  }, []);

  // Step 1: Preview
  const handlePreview = useCallback(async () => {
    if (!currentYearId) {
      setError('No current academic year found');
      return;
    }
    if (!newYearLabel.trim()) {
      setError('Please enter a label for the new academic year');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const options: RolloverOptions = {
        userId: 1, // admin
        oldYearId: currentYearId,
        newYearLabel: newYearLabel.trim(),
        copyFeeStructure,
        copyClassSections,
        promoteAutomatically,
        repeaterStudentIds: repeaterIds,
        finalGradeOverride: finalGradeOverride || undefined,
      };

      const prev = await previewRollover(db, options);
      setPreview(prev);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Preview failed');
    } finally {
      setIsProcessing(false);
    }
  }, [currentYearId, newYearLabel, copyFeeStructure, copyClassSections, promoteAutomatically, repeaterIds, finalGradeOverride]);

  // Step 2: Toggle repeater
  const toggleRepeater = (studentId: number) => {
    setRepeaterIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Step 3: Execute
  const handleExecute = useCallback(async () => {
    if (!preview) return;

    setIsProcessing(true);
    setError('');

    try {
      const options: RolloverOptions = {
        userId: 1,
        oldYearId: preview.oldYearId,
        newYearLabel: preview.newYearLabel,
        copyFeeStructure,
        copyClassSections,
        promoteAutomatically,
        repeaterStudentIds: repeaterIds,
        finalGradeOverride: finalGradeOverride || undefined,
      };

      const res = await executeRollover(db, options);
      setResult(res);

      if (res.success) {
        showToast('success', 'Rollover Complete', `${res.promotedCount} promoted, ${res.graduatedCount} graduated, ${res.repeaterCount} repeating`);
      } else {
        showToast('error', 'Rollover Failed', res.error || 'Unknown error');
      }

      setStep('result');
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsProcessing(false);
    }
  }, [preview, copyFeeStructure, copyClassSections, promoteAutomatically, repeaterIds, finalGradeOverride, showToast]);

  // ── Render ──

  return (
    <div style={{ padding: '32px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
          Year-End Rollover
        </h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Move students to the next academic year. Previous year data is preserved.
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['configure', 'preview', 'confirm', 'result'] as const).map((s, i) => (
          <div key={s} style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: 8,
            background: step === s ? 'var(--color-accent-teal)' : 'var(--color-surface-secondary)',
            color: step === s ? '#fff' : 'var(--color-text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            {i + 1}. {s === 'configure' ? 'Configure' : s === 'preview' ? 'Preview' : s === 'confirm' ? 'Execute' : 'Done'}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          color: '#dc2626',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Step: Configure */}
      {step === 'configure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Current Academic Year
              </label>
              <input
                type="text"
                value={currentYearLabel}
                disabled
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                New Academic Year <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={newYearLabel}
                onChange={e => setNewYearLabel(e.target.value)}
                placeholder="e.g. 2027"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={copyFeeStructure}
                onChange={e => setCopyFeeStructure(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Copy fee structure from {currentYearLabel}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={copyClassSections}
                onChange={e => setCopyClassSections(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Copy class sections
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={promoteAutomatically}
                onChange={e => setPromoteAutomatically(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Promote students automatically
            </label>
          </div>

          {/* Summary box */}
          <div style={{
            background: 'var(--color-surface-secondary)',
            borderRadius: 12,
            padding: 16,
            fontSize: 13,
            lineHeight: 1.6,
          }}>
            <strong>What this does:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>Creates {newYearLabel || '___'} as the new current year</li>
              <li>Promotes active students to the next grade (Grade 7 students graduate)</li>
              <li>Preserves all historical data — nothing is deleted</li>
              <li>Old year statements remain accessible</li>
            </ul>
            <strong style={{ display: 'block', marginTop: 12 }}>What this does NOT do:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>Does NOT copy payments or debits to the new year</li>
              <li>Does NOT set term dates (you do that after)</li>
              <li>Does NOT affect inactive students</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handlePreview}
              disabled={isProcessing || !newYearLabel.trim()}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-accent-teal)',
                color: '#fff',
                cursor: isProcessing || !newYearLabel.trim() ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: isProcessing || !newYearLabel.trim() ? 0.5 : 1,
              }}
            >
              {isProcessing ? 'Loading...' : 'Preview Rollover'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Promote', value: preview.promotedCount, color: 'var(--color-accent-teal)' },
              { label: 'Graduate', value: preview.graduatedCount, color: 'var(--color-accent-amber)' },
              { label: 'Repeat', value: preview.repeaterCount, color: 'var(--color-text-secondary)' },
              { label: 'With Debt', value: preview.studentsWithDebt, color: '#dc2626' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'var(--color-surface-secondary)',
                borderRadius: 10,
                padding: 14,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Final grade info */}
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Final grade: <strong style={{ color: 'var(--color-text-primary)' }}>{preview.finalGradeLabel}</strong>
            {finalGradeOverride && (
              <span style={{ marginLeft: 8, color: 'var(--color-accent-amber)' }}>(admin override)</span>
            )}
          </div>

          {/* Student lists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Promoted */}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
                Students to Promote ({preview.actions.filter(a => a.action === 'promote').length})
              </h4>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--color-surface-secondary)', borderRadius: 8, padding: 8 }}>
                {preview.actions.filter(a => a.action === 'promote').map(a => (
                  <div
                    key={a.studentId}
                    onClick={() => toggleRepeater(a.studentId)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      background: repeaterIds.includes(a.studentId) ? 'var(--color-accent-amber)' : 'transparent',
                    }}
                  >
                    <span>
                      <strong>{a.studentNumber}</strong> {a.fullName}
                      {a.hasOutstandingBalance && (
                        <span style={{ marginLeft: 8, color: '#dc2626', fontSize: 11 }}>(owes ${(a.outstandingBalanceCents / 100).toFixed(0)})</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {a.currentGradeLabel} → {a.targetGradeLabel}
                    </span>
                  </div>
                ))}
                {preview.actions.filter(a => a.action === 'promote').length === 0 && (
                  <div style={{ padding: 12, color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' }}>
                    No students to promote
                  </div>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                Click a student to mark them as a repeater (they stay in the same grade)
              </p>
            </div>

            {/* Graduated */}
            {preview.actions.filter(a => a.action === 'graduate').length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
                  Graduating ({preview.actions.filter(a => a.action === 'graduate').length})
                </h4>
                <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 8, padding: 8 }}>
                  {preview.actions.filter(a => a.action === 'graduate').map(a => (
                    <div key={a.studentId} style={{ padding: '6px 12px', fontSize: 13 }}>
                      <strong>{a.studentNumber}</strong> {a.fullName} — {a.currentGradeLabel}
                      {a.hasOutstandingBalance && (
                        <span style={{ marginLeft: 8, color: '#dc2626', fontSize: 11 }}>(owes ${(a.outstandingBalanceCents / 100).toFixed(0)})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Repeaters */}
            {repeaterIds.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
                  Repeaters ({repeaterIds.length})
                </h4>
                <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 8, padding: 8 }}>
                  {preview.actions.filter(a => repeaterIds.includes(a.studentId)).map(a => (
                    <div
                      key={a.studentId}
                      onClick={() => toggleRepeater(a.studentId)}
                      style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--color-accent-amber)' }}
                    >
                      <strong>{a.studentNumber}</strong> {a.fullName} — stays in {a.currentGradeLabel}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep('configure')}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={isProcessing}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-accent-teal)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Continue to Confirmation
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560, margin: '0 auto' }}>
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px' }}>Ready to Execute</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              This will create <strong>{preview.newYearLabel}</strong> as the new current academic year.
              This action cannot be undone (but your old data is preserved).
            </p>
          </div>

          <div style={{
            background: 'var(--color-surface-secondary)',
            borderRadius: 12,
            padding: 20,
            fontSize: 14,
            lineHeight: 2,
          }}>
            <div>📅 New year: <strong>{preview.newYearLabel}</strong> (current)</div>
            <div>📤 Old year: <strong>{preview.oldYearLabel}</strong> (archived)</div>
            <div>👥 {preview.promotedCount} students promoted</div>
            <div>🎓 {preview.graduatedCount} students graduated (set inactive)</div>
            <div>🔁 {repeaterIds.length} students repeating</div>
            <div>💰 {preview.studentsWithDebt} students with outstanding balance</div>
            <div>📋 {preview.feeStructureRowsToCopy} fee rows copied</div>
            <div>🏫 {preview.classSectionsToCopy} class sections created</div>
            <div>📝 {preview.termsToCopy} terms created (dates TBD)</div>
          </div>

          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            color: '#166534',
          }}>
            💡 <strong>Tip:</strong> Consider opening Backup Manager to create a backup before proceeding.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep('preview')}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleExecute}
              disabled={isProcessing}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              {isProcessing ? 'Executing...' : 'Execute Rollover'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>{result.success ? '✅' : '❌'}</div>
          <h3>{result.success ? 'Rollover Complete!' : 'Rollover Failed'}</h3>

          {result.success ? (
            <>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                <strong>{preview?.newYearLabel}</strong> is now the current academic year.
              </p>
              <div style={{
                background: 'var(--color-surface-secondary)',
                borderRadius: 12,
                padding: 20,
                fontSize: 14,
                lineHeight: 2,
                textAlign: 'left',
              }}>
                <div>👥 {result.promotedCount} students promoted</div>
                <div>🎓 {result.graduatedCount} students graduated</div>
                <div>🔁 {result.repeaterCount} students repeating</div>
                <div>📋 {result.feeStructureRowsCopied} fee rows copied</div>
                <div>🏫 {result.classSectionsCopied} class sections created</div>
                <div>📝 {result.termsToCopy} terms created</div>
              </div>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                color: '#166534',
                textAlign: 'left',
              }}>
                <strong>Next steps:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  <li>Set term dates for {preview?.newYearLabel} (Settings → School Structure)</li>
                  <li>Review fee amounts if needed (Fee Structure Manager)</li>
                  <li>Run auto-debit when Term 1 starts</li>
                </ul>
              </div>
            </>
          ) : (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: 16,
              fontSize: 14,
              color: '#dc2626',
            }}>
              {result.error || 'An unexpected error occurred. Your data is unchanged.'}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-accent-teal)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              marginTop: 8,
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default RolloverWizard;
