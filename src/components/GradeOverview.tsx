import React from 'react';
import { printDocument, generateOverviewHtml } from '../lib/print-service';

interface OverviewRow {
  name: string;
  studentId?: number;
  balance: number;
  status: string;
}

interface CurrentOverview {
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  isGrade: boolean;
  rows: OverviewRow[];
}

interface Grade {
  id: number;
  label: string;
}

interface Term {
  id: number;
  label: string;
}

interface GradeOverviewProps {
  currentOverview: CurrentOverview | null;
  selectedGrade: number | null;
  grades: Grade[];
  schoolName: string;
  schoolLogo?: string;
  schoolContact?: string;
  termsList: Term[];
}

const GradeOverview: React.FC<GradeOverviewProps> = ({
  currentOverview,
  selectedGrade,
  grades,
  schoolName,
  schoolLogo,
  schoolContact,
  termsList,
}) => {
  const handlePrint = async () => {
    if (!currentOverview) return;
    const currentTerm = termsList.length > 0 ? termsList[0].label : '';

    const html = generateOverviewHtml({
      schoolName,
      schoolLogo: schoolLogo || undefined,
      schoolContact: schoolContact || undefined,
      reportTitle: currentOverview.isGrade
        ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}`
        : 'Master Financial Overview',
      currentTerm: currentTerm || undefined,
      generatedAt: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      totalInvoiced: (currentOverview.totalInvoiced / 100).toFixed(2),
      totalPaid: (currentOverview.totalPaid / 100).toFixed(2),
      balance: (currentOverview.balance / 100).toFixed(2),
      rows: currentOverview.rows.map((r: any) => ({
        name: r.name,
        studentId: r.studentId,
        balance: (r.balance / 100).toFixed(2),
        status: r.status,
      })),
    });
    await printDocument({
      html,
      filename: currentOverview.isGrade
        ? `grade_report_${grades.find(g => g.id === selectedGrade)?.label?.replace(/\s+/g, '_')}`
        : 'financial_overview',
      title: currentOverview.isGrade
        ? `Grade Report - ${grades.find(g => g.id === selectedGrade)?.label}`
        : 'Financial Overview',
    });
  };

  if (!currentOverview) return null;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button className="btn btn-primary" onClick={handlePrint}>
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
          Print Overview
        </button>
      </div>
      <div
        className="a4-page"
        style={{
          position: 'relative',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          border: '1px solid var(--border)',
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
                style={{ maxHeight: '60px', maxWidth: '150px' }}
              />
            </div>
          )}
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#1f2937' }}>
            {schoolName}
          </h2>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f97316', marginBottom: '8px' }}>
            {currentOverview.isGrade
              ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}`
              : 'Master Financial Overview'}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {termsList.length > 0 && <span>Term: {termsList[0].label}</span>}
            <span style={{ margin: '0 8px' }}>|</span>
            <span>
              Generated:{' '}
              {new Date().toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {schoolContact && (
              <>
                <span style={{ margin: '0 8px' }}>|</span>
                <span>Contact: {schoolContact}</span>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '4px',
              }}
            >
              Total Fees Charged
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#374151' }}>
              ${(currentOverview.totalInvoiced / 100).toFixed(2)}
            </div>
          </div>
          <div
            style={{
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '4px',
              }}
            >
              Total Paid
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#059669' }}>
              ${(currentOverview.totalPaid / 100).toFixed(2)}
            </div>
          </div>
          <div
            style={{
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: '4px',
              }}
            >
              Amount Outstanding
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: currentOverview.balance > 0 ? '#dc2626' : '#10B981',
              }}
            >
              {currentOverview.balance > 0 ? '+$' : '-$'}
              {Math.abs(currentOverview.balance / 100).toFixed(2)}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          {currentOverview.isGrade ? 'Student Details' : 'Grade Details'}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th>Name</th>
                {currentOverview.isGrade && <th>ID</th>}
                <th style={{ textAlign: 'right' }}>Amount Owing</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentOverview.rows.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-secondary">
                  <td style={{ fontWeight: 600 }} className="text-display">
                    {row.name}
                  </td>
                  {currentOverview.isGrade && <td style={{ color: '#6b7280' }}>{row.studentId}</td>}
                  <td
                    className="text-mono"
                    style={{
                      fontWeight: 700,
                      textAlign: 'right',
                      color: row.balance > 0 ? '#dc2626' : row.balance < 0 ? '#10B981' : '#059669',
                    }}
                  >
                    {row.balance > 0 ? '+$' : row.balance < 0 ? '+$' : ''}
                    {Math.abs(row.balance / 100).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: row.status === 'Paid' ? '#D1FAE5' : '#FEE2E2',
                        color: row.status === 'Paid' ? '#065F46' : '#991B1B',
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            border: '2px solid #374151',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f9fafb',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            Total Outstanding Balance
          </span>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: currentOverview.balance > 0 ? '#dc2626' : '#10B981',
            }}
          >
            {currentOverview.balance > 0 ? '+$' : currentOverview.balance < 0 ? '+$' : ''}
            {Math.abs(currentOverview.balance / 100).toFixed(2)}
          </span>
        </div>

        <div
          style={{
            marginTop: '30px',
            paddingTop: '16px',
            borderTop: '2px dashed #e5e7eb',
            textAlign: 'center',
            fontSize: '11px',
            color: '#6b7280',
          }}
        >
          <div>
            This report was generated using{' '}
            <span style={{ fontWeight: 600, color: '#f97316' }}>FeesFoundry</span> - a product of{' '}
            <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
          </div>
          <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
            For support, contact your school administrator or visit www.jiggabyte.co.zm
          </div>
        </div>
      </div>
    </>
  );
};

export default GradeOverview;
