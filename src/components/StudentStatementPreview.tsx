import React from 'react';
import { printDocument, generateStudentStatementHtml } from '../lib/print-service';

interface StudentStatementPreviewProps {
  statementData: any;
  isLoadingDetail: boolean;
  detailError: string | null;
  schoolName: string;
  schoolLogo: string | null;
  schoolContact: string;
  termsList: { id: number; label: string }[];
  showOwing: boolean;
  showPaid: boolean;
  onExit: () => void;
  onEditProfile: () => void;
  onRecordPayment: () => void;
  onRetry: () => void;
}

const StudentStatementPreview: React.FC<StudentStatementPreviewProps> = ({
  statementData,
  isLoadingDetail,
  detailError,
  schoolName,
  schoolLogo,
  schoolContact,
  termsList,
  showOwing,
  showPaid,
  onExit,
  onEditProfile,
  onRecordPayment,
  onRetry,
}) => {
  // Combine and sort transactions
  const transactions = React.useMemo(() => {
    if (!statementData) return [];
    const all = [
      ...statementData.fees.map((f: any) => ({
        date: f.date ? f.date.split('T')[0] : '',
        type: 'Debit' as const,
        details: `${f.term_label}: School Fees`,
        amount: f.amount,
        isCredit: false,
      })),
      ...statementData.payments.map((p: any) => ({
        date: p.date ? p.date.split('T')[0] : '',
        type: 'Payment' as const,
        details: `Receipt Number: ${p.ref}`,
        amount: p.amount,
        isCredit: true,
      })),
    ];
    return all.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [statementData]);

  const handlePrint = async () => {
    if (!statementData) return;
    const html = generateStudentStatementHtml({
      schoolName,
      schoolLogo: schoolLogo || undefined,
      schoolContact: schoolContact || undefined,
      currentTerm: termsList.length > 0 ? termsList[0].label : undefined,
      generatedAt: statementData.generatedAt,
      studentName: statementData.student.full_name,
      grade: statementData.student.grade_label,
      studentId: String(statementData.student.id),
      guardianName: statementData.student.guardian_name,
      guardianContact: statementData.student.guardian_contact,
      isOwing: statementData.balance > 0,
      totalInvoiced: (statementData.totalFees / 100).toFixed(2),
      totalPaid: (statementData.totalPaid / 100).toFixed(2),
      balance: (statementData.balance / 100).toFixed(2),
      fees: statementData.fees.map((f: any) => ({
        date: f.date,
        termLabel: f.term_label,
        description: f.description,
        amount: (f.amount / 100).toFixed(2),
      })),
      payments: statementData.payments.map((p: any) => ({
        date: p.date,
        ref: p.ref,
        amount: (p.amount / 100).toFixed(2),
      })),
    });
    await printDocument({
      html,
      filename: `statement_${statementData.student.full_name.replace(/\s+/g, '_')}_${statementData.student.id}`,
      title: `Statement - ${statementData.student.full_name}`,
    });
  };

  return (
    <>
      {statementData && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-outline" onClick={onExit}>
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Exit
          </button>
          <button className="btn btn-outline" onClick={handlePrint}>
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
            Print Statement
          </button>
          <button className="btn btn-primary" onClick={onRecordPayment}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            Record Payment
          </button>
        </div>
      )}

      <div className="a4-page" style={{ position: 'relative', margin: 0 }}>
        {isLoadingDetail && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              backdropFilter: 'blur(4px)',
              borderRadius: '16px',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid var(--secondary)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <p
                style={{ marginTop: '16px', fontWeight: 700, color: 'var(--text-primary)' }}
                className="text-display"
              >
                Accessing records...
              </p>
            </div>
          </div>
        )}

        {detailError && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                backgroundColor: '#FEE2E2',
                color: '#EF4444',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <p style={{ fontWeight: 500, marginBottom: '24px' }} className="text-display">
              {detailError}
            </p>
            <button className="btn btn-primary" onClick={onRetry}>
              Retry Connection
            </button>
          </div>
        )}

        {statementData && (
          <div>
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
              <h2
                style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#1f2937' }}
              >
                {schoolName}
              </h2>
              <div
                style={{ fontSize: '16px', fontWeight: 600, color: '#f97316', marginBottom: '8px' }}
              >
                Statement of Account
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {termsList.length > 0 && <span>{termsList[0].label}</span>}
                <span style={{ margin: '0 8px' }}>|</span>
                <span>Generated: {statementData.generatedAt}</span>
                {schoolContact && (
                  <>
                    <span style={{ margin: '0 8px' }}>|</span>
                    <span>{schoolContact}</span>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '28px',
                background: '#f9fafb',
                padding: '16px',
                borderRadius: '8px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    margin: '0 0 8px 0',
                    color: '#1f2937',
                  }}
                >
                  {statementData.student.full_name}
                </h3>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#f97316' }}>
                    {statementData.student.grade_label}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    ID: {statementData.student.id}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  <div>
                    Guardian: {statementData.student.guardian_name}
                    {statementData.student.guardian_name_2 &&
                      `, ${statementData.student.guardian_name_2}`}{' '}
                    | {statementData.student.guardian_contact}
                    {statementData.student.guardian_contact_2 &&
                      `, ${statementData.student.guardian_contact_2}`}
                  </div>
                  {statementData.student.guardian_email && (
                    <div>Email: {statementData.student.guardian_email}</div>
                  )}
                </div>
              </div>
              <div
                style={{
                  textAlign: 'right',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: statementData.balance > 0 ? '#FEE2E2' : '#D1FAE5',
                    color: statementData.balance > 0 ? '#991B1B' : '#065F46',
                  }}
                >
                  {statementData.balance > 0 ? 'Owing' : 'Paid'}
                </span>
                <button
                  className="btn btn-outline"
                  onClick={onEditProfile}
                  style={{
                    padding: '4px 12px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Profile
                </button>
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
              Transaction Details
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions
                    .filter(t => (t.isCredit ? showPaid : showOwing))
                    .map((item, i) => (
                      <tr key={i} className="hover:bg-secondary">
                        <td
                          className="text-mono"
                          style={{ fontSize: '12px', color: 'var(--text-secondary)' }}
                        >
                          {item.date}
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: item.isCredit ? '#D1FAE5' : '#FEE2E2',
                              color: item.isCredit ? '#065F46' : '#991B1B',
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="text-display" style={{ fontSize: '13px', fontWeight: 600 }}>
                          {item.details}
                        </td>
                        <td
                          className="text-mono"
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            textAlign: 'right',
                            color: item.isCredit ? '#10B981' : '#dc2626',
                          }}
                        >
                          {item.isCredit ? '-' : '+'}${(item.amount / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  {transactions.filter(t => (t.isCredit ? showPaid : showOwing)).length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          textAlign: 'center',
                          padding: '64px',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic',
                          opacity: 0.5,
                        }}
                        className="text-display"
                      >
                        No transactional records exist for this student account
                      </td>
                    </tr>
                  )}
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
                Account Balance
              </span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                ${(statementData.balance / 100).toFixed(2)}
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
                This statement was generated using{' '}
                <span style={{ fontWeight: 600, color: '#f97316' }}>FeesFoundry</span> - a product
                of <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
              </div>
              <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                For support, contact your school administrator or visit www.jiggabyte.co.zm
              </div>
            </div>
          </div>
        )}

        {statementData && statementData.fees.length + statementData.payments.length > 15 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                Page 2 of 2
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>
                {statementData.student.full_name} - Continued
              </h3>
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
              Transaction Details (Continued)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .filter(t => (t.isCredit ? showPaid : showOwing))
                  .slice(10)
                  .map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '12px', color: '#6b7280' }}>{item.date}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: item.isCredit ? '#D1FAE5' : '#FEE2E2',
                            color: item.isCredit ? '#065F46' : '#991B1B',
                            textTransform: 'uppercase',
                          }}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', fontWeight: 600 }}>{item.details}</td>
                      <td
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          textAlign: 'right',
                          color: item.isCredit ? '#10B981' : '#dc2626',
                        }}
                      >
                        {item.isCredit ? '-' : '+'}${(item.amount / 100).toFixed(2)}
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
                Account Balance
              </span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                ${(statementData.balance / 100).toFixed(2)}
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '20mm',
                left: '20mm',
                right: '20mm',
                paddingTop: '12px',
                borderTop: '2px dashed #e5e7eb',
                textAlign: 'center',
                fontSize: '11px',
                color: '#6b7280',
              }}
            >
              <div>
                This statement was generated using{' '}
                <span style={{ fontWeight: 600, color: '#f97316' }}>FeesFoundry</span> - a product
                of <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
              </div>
              <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                For support, contact your school administrator or visit www.jiggabyte.co.zm
              </div>
            </div>
          </div>
        )}

        {!statementData && !detailError && !isLoadingDetail && (
          <div
            style={{
              textAlign: 'center',
              padding: '96px 0',
              color: 'var(--text-secondary)',
              opacity: 0.4,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
            className="text-display"
          >
            Record Entry Pending
          </div>
        )}
      </div>
    </>
  );
};

export default StudentStatementPreview;
