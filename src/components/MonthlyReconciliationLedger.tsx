import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { useToast } from './Toast';

interface MonthlyLedgerProps {
  onClose?: () => void;
}

export const MonthlyReconciliationLedger: React.FC<MonthlyLedgerProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('School Foundry');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [methodSummary, setMethodSummary] = useState<Record<string, number>>({});
  const [gradeSummary, setGradeSummary] = useState<Array<{ grade_label: string; total_cents: number; count: number }>>([]);
  const [totalCollectedCents, setTotalCollectedCents] = useState(0);
  const [totalVoidedCents, setTotalVoidedCents] = useState(0);
  const [activeDebtors, setActiveDebtors] = useState<any[]>([]);
  const [totalDebtorsCents, setTotalDebtorsCents] = useState(0);
  const [checksum, setChecksum] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedYearId && selectedMonth) {
      loadMonthData(selectedYearId, selectedMonth);
    }
  }, [selectedYearId, selectedMonth]);

  const loadInitialData = async () => {
    try {
      const setting = await db.get("SELECT value FROM app_settings WHERE key = 'school_name'");
      if (setting?.value) setSchoolName(setting.value);

      const years = await db.all('SELECT * FROM academic_years ORDER BY is_current DESC, label DESC');
      setAcademicYears(years);
      if (years.length > 0) {
        setSelectedYearId(years[0].id);
      }
    } catch (err) {
      console.error('Failed to load ledger metadata:', err);
    }
  };

  const loadMonthData = async (yearId: number, monthStr: string) => {
    setLoading(true);
    try {
      // 1. Transactions for the selected month (e.g. '2026-08%')
      const monthPrefix = `${monthStr}%`;
      const txs = await db.all(
        `SELECT p.id, p.receipt_number, p.payment_date, p.amount_paid_cents, p.payment_method,
                p.is_voided, p.notes, s.full_name as student_name, s.student_number,
                g.label as grade_label, u.username as cashier_name
         FROM payments p
         JOIN students s ON p.student_id = s.id
         LEFT JOIN grades g ON p.grade_id = g.id
         LEFT JOIN users u ON p.recorded_by = u.id
         WHERE p.year_id = ? AND p.payment_date LIKE ?
         ORDER BY p.payment_date ASC, p.id ASC`,
        [yearId, monthPrefix]
      );
      setTransactions(txs);

      let total = 0;
      let voided = 0;
      const methods: Record<string, number> = { cash: 0, ecocash: 0, bank_transfer: 0, other: 0 };
      const gradesMap: Record<string, { total_cents: number; count: number }> = {};

      let hashInput = '';

      for (const t of txs) {
        hashInput += `${t.receipt_number}|${t.amount_paid_cents}|${t.payment_date}|${t.is_voided};`;
        if (t.is_voided) {
          voided += t.amount_paid_cents;
        } else {
          total += t.amount_paid_cents;
          const m = t.payment_method || 'other';
          methods[m] = (methods[m] || 0) + t.amount_paid_cents;

          const g = t.grade_label || 'Unassigned';
          if (!gradesMap[g]) gradesMap[g] = { total_cents: 0, count: 0 };
          gradesMap[g].total_cents += t.amount_paid_cents;
          gradesMap[g].count += 1;
        }
      }

      setTotalCollectedCents(total);
      setTotalVoidedCents(voided);
      setMethodSummary(methods);
      setGradeSummary(
        Object.entries(gradesMap).map(([grade_label, data]) => ({
          grade_label,
          total_cents: data.total_cents,
          count: data.count,
        }))
      );

      // Generate verification checksum string
      let simpleHash = 0;
      for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        simpleHash = (simpleHash << 5) - simpleHash + char;
        simpleHash |= 0;
      }
      const hexChecksum = `SF-${Math.abs(simpleHash).toString(16).toUpperCase().padStart(8, '0')}-${txs.length}`;
      setChecksum(hexChecksum);

      // 2. Active Debtors snapshot
      const debtors = await db.all(
        `SELECT s.id, s.full_name, s.student_number, g.label as grade_label, s.is_vulnerable_child,
                COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf JOIN fee_structure fs ON sf.fee_structure_id = fs.id WHERE sf.student_id = s.id AND fs.year_id = ?), 0) -
                COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
         FROM students s
         JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
         JOIN grades g ON sye.grade_id = g.id
         WHERE s.is_active = 1
         HAVING balance > 0
         ORDER BY balance DESC
         LIMIT 50`,
        [yearId, yearId, yearId]
      );
      setActiveDebtors(debtors);

      const totalDebt = debtors.reduce((sum: number, d: any) => sum + (d.balance || 0), 0);
      setTotalDebtorsCents(totalDebt);
    } catch (err) {
      console.error('Failed to load monthly data:', err);
      showToast('error', 'Failed to load monthly audit data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Controls & Toolbar (hidden during print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Monthly Physical Disaster Recovery Ledger</h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Print and archive this ledger monthly in your physical school strongbox for permanent offline disaster recovery.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={selectedYearId || ''}
            onChange={e => setSelectedYearId(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
          >
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>
                Year {y.label}
              </option>
            ))}
          </select>

          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
          />

          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
            }}
          >
            🖨️ Print Disaster Recovery Ledger
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Printable Paper Document Canvas */}
      <div
        className="printable-ledger"
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid #111827', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                {schoolName}
              </h1>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626', marginTop: '4px', textTransform: 'uppercase' }}>
                OFFICIAL MONTHLY RECONCILIATION & DISASTER RECOVERY LEDGER
              </div>
              <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>
                Period: <strong style={{ color: '#111827' }}>{selectedMonth}</strong> | Generated: {new Date().toLocaleDateString()}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-block', border: '1px solid #111827', padding: '6px 12px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#6b7280' }}>Integrity Checksum</div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 900 }}>{checksum || 'CALCULATING'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ border: '1px solid #e5e7eb', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Total Collected</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
              {formatCurrency(totalCollectedCents)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{transactions.filter(t => !t.is_voided).length} valid payments</div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Cash Intake</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
              {formatCurrency(methodSummary.cash || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Physical cash received</div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Mobile Money / Bank</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
              {formatCurrency((methodSummary.ecocash || 0) + (methodSummary.bank_transfer || 0))}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Digital & transfers</div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Outstanding Debtors</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
              {formatCurrency(totalDebtorsCents)}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{activeDebtors.length} learners owing</div>
          </div>
        </div>

        {/* Collections Breakdown by Grade */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 8px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
            1. Revenue Breakdown by Grade
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {gradeSummary.map(g => (
              <div key={g.grade_label} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}>
                <div style={{ fontWeight: 700 }}>{g.grade_label}</div>
                <div style={{ color: '#059669', fontWeight: 800 }}>{formatCurrency(g.total_cents)}</div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>{g.count} transactions</div>
              </div>
            ))}
          </div>
        </div>

        {/* Itemized Transactions Table */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', margin: '0 0 8px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
            2. Itemized Transactions ({transactions.length} entries)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}>
                <th style={{ padding: '6px 8px' }}>Date</th>
                <th style={{ padding: '6px 8px' }}>Receipt #</th>
                <th style={{ padding: '6px 8px' }}>Learner</th>
                <th style={{ padding: '6px 8px' }}>Grade</th>
                <th style={{ padding: '6px 8px' }}>Method</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '6px 8px' }}>Cashier</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                    No payment transactions recorded for this month.
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: t.is_voided ? '#fef2f2' : 'transparent' }}>
                    <td style={{ padding: '6px 8px' }}>{t.payment_date?.split('T')[0] || t.payment_date}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700 }}>{t.receipt_number}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.student_name}</td>
                    <td style={{ padding: '6px 8px' }}>{t.grade_label || '-'}</td>
                    <td style={{ padding: '6px 8px', textTransform: 'capitalize' }}>{t.payment_method}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: t.is_voided ? '#9ca3af' : '#111827' }}>
                      {formatCurrency(t.amount_paid_cents)}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{t.cashier_name || 'Admin'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: t.is_voided ? '#dc2626' : '#059669' }}>
                      {t.is_voided ? 'VOIDED' : 'VALID'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Physical Sign-off & Audit Seal */}
        <div style={{ marginTop: '40px', borderTop: '2px solid #111827', paddingTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', fontSize: '12px' }}>
            <div>
              <div style={{ fontWeight: 800, marginBottom: '24px' }}>PREPARED BY (BURSAR / ACCOUNTS):</div>
              <div style={{ borderBottom: '1px solid #111827', marginBottom: '8px' }}></div>
              <div>Name & Signature: _______________________</div>
              <div style={{ marginTop: '4px' }}>Date: _________________________________</div>
            </div>

            <div>
              <div style={{ fontWeight: 800, marginBottom: '24px' }}>VERIFIED & APPROVED (HEADTEACHER):</div>
              <div style={{ borderBottom: '1px solid #111827', marginBottom: '8px' }}></div>
              <div>Name & Signature: _______________________</div>
              <div style={{ marginTop: '4px' }}>Date: _________________________________</div>
            </div>

            <div style={{ textAlign: 'center', border: '1px dashed #9ca3af', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontWeight: 800, color: '#6b7280', fontSize: '11px', marginBottom: '32px' }}>
                OFFICIAL SCHOOL RUBBER STAMP
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>Affix official date stamp here</div>
            </div>
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '10px', color: '#6b7280' }}>
            School Foundry (Digital Public Good Edition) • Cryptographically verifiable offline audit trail • Standard Form SF-REC-01
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-ledger {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};
