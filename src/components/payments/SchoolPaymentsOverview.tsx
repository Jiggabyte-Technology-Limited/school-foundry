import React from 'react';
import { printDocument, generatePaymentsOverviewHtml } from '../../lib/print-service';
import { getCurrencySymbol } from '../../lib/currency';

interface PaymentStats {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  yearTotal: number;
  todayCount: number;
  weekCount: number;
  expectedTermTotal: number;
  paidTermTotal: number;
  expectedYearTotal: number;
  paidYearTotal: number;
  outstandingTerm: number;
  outstandingYear: number;
}

interface SchoolPaymentsOverviewProps {
  stats: PaymentStats;
  schoolName: string;
  schoolLogo: string | null;
  schoolContact: string;
  currentTerm: string;
}

const SchoolPaymentsOverview: React.FC<SchoolPaymentsOverviewProps> = ({
  stats,
  schoolName,
  schoolLogo,
  schoolContact,
  currentTerm,
}) => {
  const formatCurrency = (cents: number) =>
    `${getCurrencySymbol()}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handlePrint = async () => {
    try {
      const html = generatePaymentsOverviewHtml({
        schoolName,
        schoolLogo: schoolLogo || undefined,
        currentTerm: currentTerm || '',
        generatedAt: new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        currencySymbol: getCurrencySymbol(),
        todayTotal: stats.todayTotal,
        todayCount: stats.todayCount,
        weekTotal: stats.weekTotal,
        weekCount: stats.weekCount,
        monthTotal: stats.monthTotal,
        yearTotal: stats.yearTotal,
        expectedTermTotal: stats.expectedTermTotal,
        paidTermTotal: stats.paidTermTotal,
        outstandingTerm: stats.outstandingTerm,
        expectedYearTotal: stats.expectedYearTotal,
        paidYearTotal: stats.paidYearTotal,
        outstandingYear: stats.outstandingYear,
      });

      await printDocument({
        html,
        filename: 'school_payments_overview',
        title: 'School Payments Overview',
      });
    } catch (err) {
      console.error('Error printing overview:', err);
    }
  };

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}
      >
        <button className="btn btn-primary" onClick={handlePrint}>
          Print
        </button>
      </div>

      {/* Thermal Receipt Style */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#1f2937',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: 'center',
            paddingTop: '16px',
            marginBottom: '16px',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            SCHOOL PAYMENTS OVERVIEW
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{schoolName}</div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>
            {currentTerm} • {new Date().toLocaleDateString()}
          </div>
          <div style={{ fontSize: '9px', marginTop: '2px' }}>Powered by SchoolFoundry</div>
        </div>

        {/* Daily Stats */}
        <div style={{ padding: '12px 16px', borderBottom: '1px dashed #333' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 600,
              marginBottom: '8px',
              borderBottom: '1px solid #333',
              paddingBottom: '2px',
            }}
          >
            DAILY TOTALS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>Today:</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              {formatCurrency(stats.todayTotal)}{' '}
              <span style={{ color: '#6b7280', fontWeight: 400 }}>
                ({stats.todayCount} payments)
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>This Week:</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              {formatCurrency(stats.weekTotal)}{' '}
              <span style={{ color: '#6b7280', fontWeight: 400 }}>
                ({stats.weekCount} payments)
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>This Month:</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              {formatCurrency(stats.monthTotal)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px' }}>Year to Date:</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#f97316' }}>
              {formatCurrency(stats.yearTotal)}
            </span>
          </div>
        </div>

        {/* Current Term */}
        <div style={{ padding: '12px 16px', borderBottom: '1px dashed #333' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 600,
              marginBottom: '8px',
              borderBottom: '1px solid #333',
              paddingBottom: '2px',
            }}
          >
            CURRENT PERIOD: {currentTerm}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>Received:</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#059669' }}>
              {formatCurrency(stats.paidTermTotal)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>Expected:</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              {formatCurrency(stats.expectedTermTotal)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px' }}>Outstanding:</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: stats.outstandingTerm > 0 ? '#dc2626' : '#16a34a',
              }}
            >
              {formatCurrency(stats.outstandingTerm)}
            </span>
          </div>
        </div>

        {/* Full Year */}
        <div style={{ padding: '12px 16px', borderBottom: '1px dashed #333' }}>
          <div
            style={{
              fontSize: '9px',
              fontWeight: 600,
              marginBottom: '8px',
              borderBottom: '1px solid #333',
              paddingBottom: '2px',
            }}
          >
            FULL YEAR
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>Received:</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#059669' }}>
              {formatCurrency(stats.paidYearTotal)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px' }}>Expected:</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              {formatCurrency(stats.expectedYearTotal)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px' }}>Outstanding:</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: stats.outstandingYear > 0 ? '#dc2626' : '#16a34a',
              }}
            >
              {formatCurrency(stats.outstandingYear)}
            </span>
          </div>
        </div>

        {/* Total Outstanding */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px dashed #333',
            backgroundColor: '#f9fafb',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>TOTAL OUTSTANDING</span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: stats.outstandingYear > 0 ? '#dc2626' : '#16a34a',
              }}
            >
              {formatCurrency(stats.outstandingYear)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: '8px' }}>
          <p style={{ margin: '1px 0' }}>Generated by SchoolFoundry</p>
          <p style={{ margin: '1px 0' }}>Jiggabyte Technology Limited</p>
        </div>
      </div>
    </div>
  );
};

export default SchoolPaymentsOverview;
