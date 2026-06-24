import React, { useState, useCallback } from 'react';
import { useToast } from './Toast';
import * as XLSX from 'xlsx';

// ── Types ──

interface SheetPreview {
  sheetName: string;
  headers: string[];
  rowCount: number;
  sample: Record<string, any>[];
}

interface ParsedWorkbook {
  fileName: string;
  sheets: SheetPreview[];
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  tableType: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: ImportError[];
  warnings: string[];
  error?: string;
}

type TableType = 'students' | 'payments';

// ── Field definitions for column mapping ──

const STUDENT_FIELDS = [
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'student_number', label: 'Student Number', required: false },
  { key: 'date_of_birth', label: 'Date of Birth', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'guardian_name', label: 'Guardian Name', required: true },
  { key: 'guardian_contact', label: 'Guardian Contact', required: true },
  { key: 'guardian_name_2', label: 'Guardian Name 2', required: false },
  { key: 'guardian_contact_2', label: 'Guardian Contact 2', required: false },
  { key: 'guardian_email', label: 'Guardian Email', required: false },
  { key: 'grade_label', label: 'Grade', required: false },
];

const PAYMENT_FIELDS = [
  { key: 'student_number', label: 'Student Number', required: false },
  { key: 'full_name', label: 'Student Name', required: false },
  { key: 'amount_paid_cents', label: 'Amount Paid (cents)', required: true },
  { key: 'payment_date', label: 'Payment Date', required: true },
  { key: 'receipt_number', label: 'Receipt Number', required: true },
  { key: 'payment_method', label: 'Payment Method', required: false },
];

// ── Template generation ──

const TEMPLATE_SAMPLE_STUDENTS: Record<string, string> = {
  'Full Name': 'Jane Moyo',
  'Student Number': 'STU2026001',
  'Date of Birth': '2010-05-15',
  'Gender': 'female',
  'Guardian Name': 'Grace Moyo',
  'Guardian Contact': '263778888888',
  'Guardian Name 2': '',
  'Guardian Contact 2': '',
  'Guardian Email': 'grace@email.com',
  'Grade': 'Grade 5',
};

const TEMPLATE_SAMPLE_PAYMENTS: Record<string, string> = {
  'Student Number': 'STU2026001',
  'Student Name': 'Jane Moyo',
  'Amount Paid (cents)': '50000',
  'Payment Date': '2026-03-15',
  'Receipt Number': 'RCP-001',
  'Payment Method': 'cash',
};

function buildTemplate(tableType: TableType): void {
  const sample = tableType === 'students' ? TEMPLATE_SAMPLE_STUDENTS : TEMPLATE_SAMPLE_PAYMENTS;
  const fields = tableType === 'students' ? STUDENT_FIELDS : PAYMENT_FIELDS;

  // Header row + sample row
  const headers = fields.map(f => f.label);
  const sampleRow: Record<string, any> = {};
  for (const f of fields) {
    // Find the matching sample key by label
    const sampleEntry = Object.entries(sample).find(([_, label]) => label === f.label || label === f.key);
    if (sampleEntry) {
      sampleRow[sampleEntry[0]] = '';
    }
  }

  // Build rows: [headers], [sample values]
  const rows = [headers, { ...sample }];

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths based on content
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tableType === 'students' ? 'Students' : 'Payments');

  const fileName = `SchoolFoundry_${tableType}_template.xlsx`;
  XLSX.writeFile(wb, fileName);
}

const ImportWizard: React.FC = () => {
  const { showToast } = useToast();

  // Step state
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload');
  const [tableType, setTableType] = useState<TableType>('students');

  // File state
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [filePath, setFilePath] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');

  // Column mapping: excelHeader → dbField (or '' to skip)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation / result
  const [previewResult, setPreviewResult] = useState<{
    totalRows: number;
    validRows: number;
    errors: ImportError[];
    sampleRows: Record<string, any>[];
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fields = tableType === 'students' ? STUDENT_FIELDS : PAYMENT_FIELDS;

  // ── Step 1: Open file dialog ──
  const handleOpenFile = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await (window as any).api.openImportFileDialog();
      if (result.canceled) {
        setIsProcessing(false);
        return;
      }
      if (!result.success) {
        showToast('error', 'Import Failed', result.error || 'Could not open file');
        setIsProcessing(false);
        return;
      }

      setFilePath(result.filePath);
      setParsed(result.parsed);

      // Auto-select first sheet
      const firstSheet = result.parsed.sheets[0]?.sheetName || '';
      setSelectedSheet(firstSheet);

      // Initialize empty mapping
      const initialMapping: Record<string, string> = {};
      result.parsed.sheets[0]?.headers.forEach((h: string) => {
        initialMapping[h] = '';
      });
      setColumnMapping(initialMapping);

      setStep('mapping');
    } catch (err: any) {
      showToast('error', 'Import Failed', err.message || 'Unexpected error');
    } finally {
      setIsProcessing(false);
    }
  }, [showToast]);

  // ── Step 2: Run validation preview ──
  const handlePreview = useCallback(async () => {
    if (!selectedSheet) {
      showToast('error', 'Validation Error', 'Please select a sheet');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await (window as any).api.getImportPreview({
        filePath,
        sheetName: selectedSheet,
        columnMapping,
        tableType,
      });

      if (!result.success) {
        showToast('error', 'Validation Failed', result.error);
        setIsProcessing(false);
        return;
      }

      setPreviewResult(result);
      setStep('preview');
    } catch (err: any) {
      showToast('error', 'Validation Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [filePath, selectedSheet, columnMapping, tableType, showToast]);

  // ── Step 3: Commit import ──
  const handleCommit = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await (window as any).api.commitImport({
        filePath,
        sheetName: selectedSheet,
        columnMapping,
        tableType,
      });

      setImportResult(result);
      setStep('result');

      if (result.success) {
        showToast('success', 'Import Complete', `${result.importedRows} ${tableType} imported successfully`);
      } else {
        showToast('error', 'Import Failed', result.error || 'Import could not be completed');
      }
    } catch (err: any) {
      showToast('error', 'Import Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [filePath, selectedSheet, columnMapping, tableType, showToast]);

  // ── Reset ──
  const handleReset = () => {
    setStep('upload');
    setParsed(null);
    setFilePath('');
    setSelectedSheet('');
    setColumnMapping({});
    setPreviewResult(null);
    setImportResult(null);
  };

  // ── Change sheet → re-init mapping ──
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    const sheet = parsed?.sheets.find(s => s.sheetName === sheetName);
    if (sheet) {
      const newMapping: Record<string, string> = {};
      sheet.headers.forEach(h => { newMapping[h] = columnMapping[h] || ''; });
      setColumnMapping(newMapping);
    }
  };

  // ── Update a single mapping ──
  const handleMappingChange = (excelHeader: string, dbField: string) => {
    setColumnMapping(prev => ({ ...prev, [excelHeader]: dbField }));
  };

  // ── Render ──

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Excel Import</h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          Import {tableType === 'students' ? 'student records' : 'payment records'} from an Excel workbook.
          Upload a file, map columns, preview validation, then commit.
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {(['upload', 'mapping', 'preview', 'result'] as const).map((s, i) => (
          <div key={s} style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 8,
            background: step === s ? 'var(--color-accent-teal)' : 'var(--color-surface-secondary)',
            color: step === s ? '#fff' : 'var(--color-text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            {i + 1}. {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Columns' : s === 'preview' ? 'Preview' : 'Done'}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          {/* Table type selector */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
            {(['students', 'payments'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTableType(t)}
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  border: '2px solid',
                  borderColor: tableType === t ? 'var(--color-accent-teal)' : 'var(--color-border)',
                  background: tableType === t ? 'var(--color-accent-teal)' : 'transparent',
                  color: tableType === t ? '#fff' : 'var(--color-text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {t === 'students' ? 'Import Students' : 'Import Payments'}
              </button>
            ))}
          </div>

          <div
            onClick={handleOpenFile}
            style={{
              border: '2px dashed var(--color-border)',
              borderRadius: 16,
              padding: '48px 32px',
              cursor: isProcessing ? 'wait' : 'pointer',
              background: 'var(--color-surface-secondary)',
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
              {isProcessing ? 'Opening file...' : 'Click to select Excel file'}
            </p>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 13 }}>
              Supports .xlsx and .xls formats
            </p>
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>or</span>
            <button
              onClick={() => buildTemplate(tableType)}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-accent-teal)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download {tableType === 'students' ? 'Student' : 'Payment'} Template
            </button>
          </div>
        </div>
      )}

      {/* Step: Mapping */}
      {step === 'mapping' && parsed && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 4px' }}>
              File: <strong style={{ color: 'var(--color-text-primary)' }}>{parsed.fileName}</strong>
            </p>
          </div>

          {/* Sheet selector */}
          {parsed.sheets.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Select Sheet
              </label>
              <select
                value={selectedSheet}
                onChange={e => handleSheetChange(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 14,
                  minWidth: 200,
                }}
              >
                {parsed.sheets.map(s => (
                  <option key={s.sheetName} value={s.sheetName}>
                    {s.sheetName} ({s.rowCount} rows)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Column mapping table */}
          <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 12, padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
              Map Excel columns to database fields
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Excel Column
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    → Database Field
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Required
                  </th>
                </tr>
              </thead>
              <tbody>
                {(parsed.sheets.find(s => s.sheetName === selectedSheet)?.headers || []).map(header => (
                  <tr key={header} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontFamily: 'monospace' }}>{header}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={columnMapping[header] || ''}
                        onChange={e => handleMappingChange(header, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface-primary)',
                          color: 'var(--color-text-primary)',
                          fontSize: 13,
                          width: '100%',
                          maxWidth: 260,
                        }}
                      >
                        <option value="">— Skip this column —</option>
                        {fields.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12 }}>
                      {fields.find(f => f.key === columnMapping[header])?.required ? (
                        <span style={{ color: 'var(--color-accent-amber)' }}>Required</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)' }}>Optional</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample data preview */}
          {parsed.sheets.find(s => s.sheetName === selectedSheet)?.sample && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sample data (first 5 rows)</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {(parsed.sheets.find(s => s.sheetName === selectedSheet)?.headers || []).map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(parsed.sheets.find(s => s.sheetName === selectedSheet)?.sample || []).map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {(parsed.sheets.find(s => s.sheetName === selectedSheet)?.headers || []).map(h => (
                          <td key={h} style={{ padding: '6px 10px', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button
              onClick={handleReset}
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
              disabled={isProcessing || !Object.values(columnMapping).some(v => v)}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-accent-teal)',
                color: '#fff',
                cursor: isProcessing || !Object.values(columnMapping).some(v => v) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: isProcessing || !Object.values(columnMapping).some(v => v) ? 0.5 : 1,
              }}
            >
              {isProcessing ? 'Validating...' : 'Validate & Preview'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && previewResult && (
        <div>
          {/* Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}>
            <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {previewResult.totalRows}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Total Rows</div>
            </div>
            <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success, #10b981)' }}>
                {previewResult.validRows}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Valid Rows</div>
            </div>
            <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: previewResult.errors.length > 0 ? 'var(--color-danger, #ef4444)' : 'var(--color-text-primary)' }}>
                {previewResult.errors.length}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Errors</div>
            </div>
          </div>

          {/* Errors */}
          {previewResult.errors.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger, #ef4444)', marginBottom: 8 }}>
                Validation Errors ({previewResult.errors.length})
              </p>
              <div style={{ maxHeight: 240, overflowY: 'auto', background: 'var(--color-surface-secondary)', borderRadius: 8, padding: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-secondary)' }}>Row</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-secondary)' }}>Field</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-secondary)' }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.errors.slice(0, 50).map((err, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '6px 10px' }}>{err.row}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{err.field}</td>
                        <td style={{ padding: '6px 10px' }}>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewResult.errors.length > 50 && (
                  <p style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    ...and {previewResult.errors.length - 50} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Sample valid rows */}
          {previewResult.sampleRows.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Preview: first {Math.min(previewResult.sampleRows.length, 10)} valid rows
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {Object.keys(previewResult.sampleRows[0]).map(k => (
                        <th key={k} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.sampleRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} style={{ padding: '6px 10px', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(v ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setStep('mapping')}
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
              ← Back to Mapping
            </button>
            <button
              onClick={handleCommit}
              disabled={isProcessing || previewResult.validRows === 0}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-accent-teal)',
                color: '#fff',
                cursor: isProcessing || previewResult.validRows === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                opacity: isProcessing || previewResult.validRows === 0 ? 0.5 : 1,
              }}
            >
              {isProcessing ? 'Importing...' : `Import ${previewResult.validRows} ${tableType}`}
            </button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && importResult && (
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {importResult.success ? '✅' : '❌'}
          </div>
          <h2 style={{ margin: '0 0 8px' }}>
            {importResult.success ? 'Import Complete' : 'Import Failed'}
          </h2>
          {importResult.success ? (
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
              Successfully imported <strong>{importResult.importedRows}</strong> {importResult.tableType} records.
              {importResult.warnings.length > 0 && (
                <span style={{ color: 'var(--color-accent-amber)' }}>
                  {' '}({importResult.warnings.length} warnings)
                </span>
              )}
            </p>
          ) : (
            <p style={{ color: 'var(--color-danger, #ef4444)', marginBottom: 24 }}>
              {importResult.error}
            </p>
          )}

          {importResult.warnings.length > 0 && (
            <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto 24px', background: 'var(--color-surface-secondary)', borderRadius: 8, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-amber)', marginBottom: 8 }}>
                Warnings ({importResult.warnings.length})
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                {importResult.warnings.slice(0, 10).map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{w}</li>
                ))}
                {importResult.warnings.length > 10 && (
                  <li style={{ color: 'var(--color-text-secondary)' }}>...and {importResult.warnings.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          <button
            onClick={handleReset}
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
            Start New Import
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportWizard;
