import React from 'react';
import { generateClassListHtml, printDocument } from '../lib/print-service';
import { useToast } from './Toast';

interface ClassListPreviewStudent {
  id: number;
  student_number: string;
  full_name: string;
  gender: string;
}

interface ClassListPrintPreviewProps {
  title: string;
  academicYear: string;
  generatedAt: string;
  schoolName: string;
  schoolLogo: string | null;
  schoolContact: string;
  students: ClassListPreviewStudent[];
  onSelectStudent?: (studentId: number) => void;
}

const ClassListPrintPreview: React.FC<ClassListPrintPreviewProps> = ({
  title,
  academicYear,
  generatedAt,
  schoolName,
  schoolLogo,
  schoolContact,
  students,
  onSelectStudent,
}) => {
  const { showToast } = useToast();
  const [printStatus, setPrintStatus] = React.useState<
    'idle' | 'generating' | 'opening' | 'ready' | 'error'
  >('idle');
  const [printMessage, setPrintMessage] = React.useState('');
  const [exportingExcel, setExportingExcel] = React.useState(false);

  const printData = React.useMemo(
    () => ({
      schoolName,
      schoolLogo: schoolLogo || undefined,
      schoolContact: schoolContact || undefined,
      title,
      academicYear,
      generatedAt,
      students: students.map(student => ({
        studentNumber: student.student_number,
        fullName: student.full_name,
        gender: student.gender,
      })),
    }),
    [academicYear, generatedAt, schoolContact, schoolLogo, schoolName, students, title]
  );

  const handlePrint = async () => {
    setPrintStatus('generating');
    setPrintMessage('Generating class list document...');

    try {
      const html = generateClassListHtml(printData);

      setPrintStatus('opening');
      setPrintMessage('Opening Document...');

      const filePath = await printDocument({
        html,
        filename: `classlist_${title.replace(/\s+/g, '_')}`,
        title: `Class List - ${title}`,
      });

      if (filePath) {
        setPrintStatus('ready');
        setPrintMessage('Document generated and ready to print. Opening Document complete.');
      } else {
        setPrintStatus('error');
        setPrintMessage('The document could not be opened. Please try again.');
      }
    } catch (err) {
      setPrintStatus('error');
      setPrintMessage(err instanceof Error ? err.message : 'The document could not be generated.');
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const result = await window.api.exportXlsxReport({
        suggestedFileName: `class-list-${title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')}`,
        workbook: {
          sheetName: 'Class List',
          topRows: [
            { value: schoolName, mergeAcross: 3 },
            { value: `Class List: ${title}`, mergeAcross: 3 },
            { value: `Academic Year: ${academicYear}`, mergeAcross: 3 },
            {
              value:
                [generatedAt, schoolContact].filter(Boolean).join(' | ') ||
                'Class list export',
              mergeAcross: 3,
            },
          ],
          columns: [
            { key: 'index', header: '#', width: 8, type: 'integer' },
            { key: 'studentNumber', header: 'Learner Number', width: 18 },
            { key: 'fullName', header: 'Learner Name', width: 30 },
            { key: 'gender', header: 'Gender', width: 14 },
          ],
          rows: students.map((student, index) => ({
            index: index + 1,
            studentNumber: student.student_number,
            fullName: student.full_name,
            gender: student.gender || '',
          })),
          summaryRows: [
            {
              label: 'Total Learners',
              value: students.length,
              valueType: 'integer',
            },
          ],
          freezeRows: 5,
          autoFilter: true,
        },
      });

      if (result.success) {
        showToast('success', 'Excel Exported', `Saved to ${result.filePath}`);
      } else if (!result.canceled) {
        showToast('error', 'Export Failed', result.error || 'Could not export class list.');
      }
    } catch (err) {
      showToast(
        'error',
        'Export Failed',
        err instanceof Error ? err.message : 'Could not export class list.'
      );
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
        <button
          className="btn btn-primary"
          onClick={handlePrint}
          disabled={
            students.length === 0 || printStatus === 'generating' || printStatus === 'opening'
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
          {printStatus === 'generating' || printStatus === 'opening'
            ? 'Opening Document...'
            : 'Print Class List'}
        </button>
        <button className="btn btn-outline" onClick={handleExportExcel} disabled={exportingExcel}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exportingExcel ? 'Exporting Excel...' : 'Export Excel'}
        </button>
      </div>

      {printStatus !== 'idle' && (
        <div
          className="card-surface"
          style={{
            borderColor: printStatus === 'error' ? '#FCA5A5' : '#FDBA74',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            width: '100%',
            maxWidth: '210mm',
            marginTop: '16px',
          }}
        >
          <div>
            <div
              style={{ fontWeight: 700, color: printStatus === 'error' ? '#991B1B' : '#9A3412' }}
            >
              {printStatus === 'ready'
                ? 'Document ready'
                : printStatus === 'error'
                  ? 'Document failed'
                  : 'Preparing document'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {printMessage}
            </div>
          </div>
          {(printStatus === 'ready' || printStatus === 'error') && (
            <button className="btn btn-outline" onClick={() => setPrintStatus('idle')}>
              Close
            </button>
          )}
        </div>
      )}

      <div
        className="a4-page"
        style={{
          position: 'relative',
          margin: '16px 0 24px auto',
          minHeight: 'auto',
          height: 'auto',
          maxHeight: 'none',
          overflow: 'visible',
          cursor: onSelectStudent ? 'default' : 'default',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            borderBottom: '2px solid #f97316',
            paddingBottom: '20px',
            marginBottom: '24px',
          }}
        >
          {schoolLogo && (
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
              <img
                src={schoolLogo}
                alt="School Logo"
                style={{ maxHeight: '60px', maxWidth: '150px', objectFit: 'contain' }}
              />
            </div>
          )}
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#1f2937' }}>
            {schoolName}
          </h2>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#f97316',
              marginBottom: '8px',
              textTransform: 'uppercase',
            }}
          >
            Class List: {title}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            <span>Academic Year: {academicYear}</span>
            <span style={{ margin: '0 8px' }}>|</span>
            <span>Generated: {generatedAt}</span>
            {schoolContact && (
              <>
                <span style={{ margin: '0 8px' }}>|</span>
                <span>{schoolContact}</span>
              </>
            )}
          </div>
        </div>

        <table
          style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', fontSize: '13px' }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 10px',
                  borderBottom: '2px solid #374151',
                  fontWeight: 600,
                  color: '#374151',
                  backgroundColor: '#f9fafb',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  width: '10%',
                }}
              >
                #
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 10px',
                  borderBottom: '2px solid #374151',
                  fontWeight: 600,
                  color: '#374151',
                  backgroundColor: '#f9fafb',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  width: '25%',
                }}
              >
                Learner Number
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 10px',
                  borderBottom: '2px solid #374151',
                  fontWeight: 600,
                  color: '#374151',
                  backgroundColor: '#f9fafb',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  width: '50%',
                }}
              >
                Name
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 10px',
                  borderBottom: '2px solid #374151',
                  fontWeight: 600,
                  color: '#374151',
                  backgroundColor: '#f9fafb',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  width: '15%',
                }}
              >
                Gender
              </th>
              {onSelectStudent && (
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 10px',
                    borderBottom: '2px solid #374151',
                    fontWeight: 600,
                    color: '#374151',
                    backgroundColor: '#f9fafb',
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    width: '18%',
                  }}
                >
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr
                key={student.id}
                style={{
                  backgroundColor: index % 2 === 1 ? '#f9fafb' : 'transparent',
                }}
              >
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #e5e7eb',
                    color: '#6b7280',
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #e5e7eb',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                >
                  {student.student_number || ''}
                </td>
                <td style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                  {student.full_name}
                </td>
                <td
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #e5e7eb',
                    textTransform: 'capitalize',
                  }}
                >
                  {student.gender || '-'}
                </td>
                {onSelectStudent && (
                  <td
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'right',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectStudent(student.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '999px',
                        border: '1px solid #f97316',
                        background: '#fff7ed',
                        color: '#c2410c',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      View
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            textAlign: 'right',
            marginTop: '20px',
            fontWeight: 700,
            fontSize: '14px',
            color: '#1f2937',
          }}
        >
          Total Learners: {students.length}
        </div>

        <div
          style={{
            marginTop: '40px',
            paddingTop: '16px',
            borderTop: '2px dashed #e5e7eb',
            textAlign: 'center',
            fontSize: '11px',
            color: '#6b7280',
          }}
        >
          This class list was generated using{' '}
          <span style={{ fontWeight: 600, color: '#f97316' }}>SchoolFoundry</span>
        </div>
      </div>
    </div>
  );
};

export default ClassListPrintPreview;
