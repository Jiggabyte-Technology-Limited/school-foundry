import React from 'react';
import { generateOverviewHtml, printDocument } from '../../lib/print-service';
import { formatCurrencyCents, getBalanceColor } from './formatters';
import { getCurrencySymbol } from '../../lib/currency';
import type { Grade, OverviewData, Term } from './types';

interface FinancialOverviewPanelProps {
  overview: OverviewData;
  grades: Grade[];
  selectedGrade: number | null;
  schoolName: string;
  schoolLogo: string | null;
  schoolContact: string;
  currentPeriod: Term | null;
  termsList: Term[];
}

const getReportTitle = (overview: OverviewData, grades: Grade[], selectedGrade: number | null) =>
  overview.isGrade
    ? `Grade Report: ${grades.find(grade => grade.id === selectedGrade)?.label}`
    : 'Master Financial Overview';

const FinancialOverviewPanel: React.FC<FinancialOverviewPanelProps> = ({
  overview,
  grades,
  selectedGrade,
  schoolName,
  schoolLogo,
  schoolContact,
  currentPeriod,
  termsList,
}) => {
  const currentTerm = currentPeriod?.label || (termsList.length > 0 ? termsList[0].label : '');
  const reportTitle = getReportTitle(overview, grades, selectedGrade);

  const printOverview = async () => {
    try {
      const html = generateOverviewHtml({
        schoolName,
        schoolLogo: schoolLogo || undefined,
        schoolContact: schoolContact || undefined,
        reportTitle,
        currentTerm: currentTerm || undefined,
        generatedAt: new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        currencySymbol: getCurrencySymbol(),
        totalInvoiced: (overview.totalInvoiced / 100).toFixed(2),
        totalPaid: (overview.totalPaid / 100).toFixed(2),
        balance: (overview.balance / 100).toFixed(2),
        rows: overview.rows.map(row => ({
          name: row.name,
          studentId: row.studentId,
          balance: (row.balance / 100).toFixed(2),
          status: row.status,
        })),
      });

      const result = await printDocument({
        html,
        filename: overview.isGrade
          ? `grade_report_${grades.find(grade => grade.id === selectedGrade)?.label?.replace(/\s+/g, '_')}`
          : 'financial_overview',
        title: overview.isGrade
          ? `Grade Report - ${grades.find(grade => grade.id === selectedGrade)?.label}`
          : 'Financial Overview',
      });

      if (!result) {
        console.error('Print failed - no result returned');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Print overview error:', err);
      alert(`Failed to print overview: ${errorMsg}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button className="btn btn-primary" onClick={printOverview}>
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
          marginTop: '24px',
          minHeight: 'auto',
          height: 'auto',
          maxHeight: 'none',
          overflow: 'visible',
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
            {reportTitle}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {currentTerm && <span>Period: {currentTerm}</span>}
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
          <SummaryCard
            label="Total Fees Charged"
            amount={`${getCurrencySymbol()}${(overview.totalInvoiced / 100).toFixed(2)}`}
            color="#374151"
          />
          <SummaryCard
            label="Total Paid"
            amount={`${getCurrencySymbol()}${(overview.totalPaid / 100).toFixed(2)}`}
            color="#059669"
          />
          <SummaryCard
            label="Amount Outstanding"
            amount={formatCurrencyCents(overview.balance)}
            color={getBalanceColor(overview.balance)}
          />
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
          {overview.isGrade ? 'Learner Details' : 'Grade Details'}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr>
              <th>Name</th>
              {overview.isGrade && <th>ID</th>}
              <th style={{ textAlign: 'right' }}>Amount Owing</th>
              <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {overview.rows.map((row, idx) => (
              <tr key={`${row.name}-${idx}`} className="hover:bg-secondary">
                <td style={{ fontWeight: 600 }} className="text-display">
                  {row.name}
                </td>
                {overview.isGrade && <td style={{ color: '#6b7280' }}>{row.studentId}</td>}
                <td
                  className="text-mono"
                  style={{
                    fontWeight: 700,
                    textAlign: 'right',
                    color: getBalanceColor(row.balance),
                  }}
                >
                  {formatCurrencyCents(row.balance)}
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
            style={{ fontSize: '24px', fontWeight: 700, color: getBalanceColor(overview.balance) }}
          >
            {formatCurrencyCents(overview.balance)}
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
            <span style={{ fontWeight: 600, color: '#f97316' }}>SchoolFoundry</span> - a product of{' '}
            <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
          </div>
          <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
            For support, contact your school administrator or visit www.jiggabyte.co.zm
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; amount: string; color: string }> = ({
  label,
  amount,
  color,
}) => (
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
      {label}
    </div>
    <div style={{ fontSize: '22px', fontWeight: 700, color }}>{amount}</div>
  </div>
);

export default FinancialOverviewPanel;
