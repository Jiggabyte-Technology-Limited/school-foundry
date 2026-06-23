import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import PaymentWizard from './PaymentWizard';
import StudentWizard from './StudentWizard';
import SynthetixCard from './ui/SynthetixCard';
import PaymentMethodToggle, { PaymentMethod } from './ui/PaymentMethodToggle';
import Receipt from './Receipt';
import StudentStatementPreview from './StudentStatementPreview';
import { getCurrencySymbol } from '../lib/currency';

interface GradeCount {
  label: string;
  count: number;
}

interface DashboardStats {
  totalStudents: number;
  gradeBreakdown: GradeCount[];
  yearFees: number;
  collected: number;
  outstanding: number;
  termFees: number;
  termCollected: number;
  termOutstanding: number;
  currentTermLabel: string;
  recentActivity: any[];
  termlyData: { term: string; collected: number; expected: number }[];
  fullyPaid: number;
  partiallyPaid: number;
  notPaid: number;
}

interface DashboardProps {
  onViewStatement?: (studentId: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewStatement }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    gradeBreakdown: [],
    yearFees: 0,
    collected: 0,
    outstanding: 0,
    termFees: 0,
    termCollected: 0,
    termOutstanding: 0,
    currentTermLabel: 'Term',
    recentActivity: [],
    termlyData: [],
    fullyPaid: 0,
    partiallyPaid: 0,
    notPaid: 0,
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStudentWizard, setShowStudentWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  // Payment recording state
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<any>(null);
  const [paymentSelectionMode, setPaymentSelectionMode] = useState<'search' | 'actions' | 'record'>(
    'search'
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentYear, setPaymentYear] = useState<number | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [years, setYears] = useState<any[]>([]);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [paymentError, setPaymentError] = useState('');
  const [showStatementPreview, setShowStatementPreview] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolContact, setSchoolContact] = useState('');
  const [termsList, setTermsList] = useState<any[]>([]);

  useEffect(() => {
    // One-time migration: fix old payments with NULL term_id
    (async () => {
      try {
        await db.run(`
          UPDATE payments 
          SET term_id = (
            SELECT MIN(fs.term_id) 
            FROM student_fees sf 
            JOIN fee_structure fs ON sf.fee_structure_id = fs.id 
            WHERE sf.student_id = payments.student_id AND fs.year_id = payments.year_id
          )
          WHERE term_id IS NULL AND student_id IN (
            SELECT DISTINCT student_id FROM payments WHERE term_id IS NULL
          )
        `);
      } catch (e) {
        console.warn('Payment term migration skipped:', e);
      }
    })();

    fetchDashboardData();
    loadStudentsAndYears();
  }, []);

  const loadStudentsAndYears = async () => {
    try {
      const currentYear = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
      const [studentList, yearList] = await Promise.all([
        db.all(
          `SELECT s.id, s.full_name,
                  CASE
                    WHEN cs.label IS NULL OR cs.label = '' THEN g.label
                    ELSE g.label || ' - ' || cs.label
                  END as grade_label,
                  sye.grade_id, s.is_active,
          COALESCE((SELECT SUM(sf.amount_cents) FROM student_fees sf JOIN fee_structure fs ON sf.fee_structure_id = fs.id WHERE sf.student_id = s.id AND fs.year_id = ?), 0) -
          COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
          FROM students s
          LEFT JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
          LEFT JOIN grades g ON sye.grade_id = g.id
          LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
          WHERE s.is_active = 1
          ORDER BY s.full_name`,
          [currentYear?.id, currentYear?.id, currentYear?.id]
        ),
        db.all(`
          SELECT y.id, y.label, 
            (SELECT json_group_array(json_object('id', t.id, 'label', t.label)) 
             FROM terms t WHERE t.year_id = y.id ORDER BY t.term_number) as terms_json
          FROM academic_years y 
          ORDER BY y.label DESC
        `),
      ]);
      console.log('Loaded students:', studentList.length);
      console.log('Loaded years:', yearList.length);
      // Parse terms from JSON string
      const parsedYears = yearList.map((y: any) => ({
        ...y,
        terms: y.terms_json ? JSON.parse(y.terms_json) : [],
      }));
      setStudents(studentList);
      setYears(parsedYears);
      if (parsedYears.length > 0) {
        setPaymentYear(parsedYears[0].id);
      }
    } catch (err) {
      console.error('Error loading students and years:', err);
    }
  };

  // Load school settings and terms
  useEffect(() => {
    (async () => {
      try {
        const [nameSetting, logoSetting, phoneSetting, emailSetting, termsData] = await Promise.all(
          [
            db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
            db.get("SELECT value FROM app_settings WHERE key = 'school_logo'"),
            db.get("SELECT value FROM app_settings WHERE key = 'school_phone'"),
            db.get("SELECT value FROM app_settings WHERE key = 'school_email'"),
            db.all('SELECT id, label FROM terms ORDER BY term_number'),
          ]
        );
        if (nameSetting) setSchoolName(nameSetting.value);
        if (logoSetting) setSchoolLogo(logoSetting.value);
        const contact = [phoneSetting?.value, emailSetting?.value].filter(Boolean).join(' | ');
        setSchoolContact(contact);
        setTermsList(termsData);
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    })();
  }, []);

  const viewStatement = async (student: any) => {
    if (!paymentYear) return;
    setStatementLoading(true);
    setShowStatementPreview(false);
    try {
      const [payments, fees] = await Promise.all([
        db.all(
          `SELECT p.id, p.receipt_number, p.amount_paid_cents as amount, p.payment_date, p.is_voided,
                  t.label as term_label
           FROM payments p
           LEFT JOIN terms t ON p.term_id = t.id
           WHERE p.student_id = ? AND p.year_id = ? AND p.is_voided = 0
           ORDER BY p.payment_date`,
          [student.id, paymentYear]
        ),
        db.all(
          `SELECT sf.debit_date as date, fs.description, sf.amount_cents as amount, 'Fee' as type,
                  t.label as term_label
           FROM student_fees sf
           JOIN fee_structure fs ON sf.fee_structure_id = fs.id
           LEFT JOIN terms t ON fs.term_id = t.id
           WHERE sf.student_id = ? AND fs.year_id = ?
           ORDER BY sf.debit_date`,
          [student.id, paymentYear]
        ),
      ]);
      const totalFees = fees.reduce((sum: number, f: any) => sum + f.amount, 0);
      const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      const balance = totalFees - totalPaid;
      setStatementData({
        student,
        payments,
        fees,
        totalFees,
        totalPaid,
        balance,
        generatedAt: new Date().toLocaleDateString(),
      });
      setShowStatementPreview(true);
    } catch (err: any) {
      console.error('Error loading statement:', err);
      setShowStatementPreview(true);
    } finally {
      setStatementLoading(false);
    }
  };

  const resetPaymentSelection = () => {
    setSelectedStudentForPayment(null);
    setPaymentSelectionMode('search');
    setStudentSearchQuery('');
    setShowStudentDropdown(false);
    setPaymentAmount('');
    setPaymentTerm(null);
    setPaymentMethod('cash');
    setPaymentError('');
  };

  // Helper to find oldest term with outstanding balance
  const findOldestOutstandingTerm = async (
    studentId: number,
    yearId: number
  ): Promise<number | null> => {
    const termBalances = await db.all(
      `
      WITH term_fees AS (
        SELECT fs.term_id, SUM(sf.amount_cents) as debited
        FROM student_fees sf
        JOIN fee_structure fs ON sf.fee_structure_id = fs.id
        WHERE sf.student_id = ? AND fs.year_id = ?
        GROUP BY fs.term_id
      ),
      term_payments AS (
        SELECT term_id, SUM(amount_paid_cents) as paid
        FROM payments
        WHERE student_id = ? AND year_id = ? AND is_voided = 0
        GROUP BY term_id
      )
      SELECT tf.term_id, t.term_number, tf.debited - COALESCE(tp.paid, 0) as balance
      FROM term_fees tf
      JOIN terms t ON tf.term_id = t.id
      LEFT JOIN term_payments tp ON tf.term_id = tp.term_id
      WHERE tf.debited - COALESCE(tp.paid, 0) > 0
      ORDER BY t.term_number ASC
      LIMIT 1
    `,
      [studentId, yearId, studentId, yearId]
    );

    return termBalances.length > 0 ? termBalances[0].term_id : null;
  };

  const handleRecordPayment = async () => {
    if (!selectedStudentForPayment || !paymentAmount || !paymentYear) {
      setPaymentError('Please fill in all required fields');
      return;
    }
    // Check if learner is active
    if (selectedStudentForPayment.is_active === 0) {
      setPaymentError('Cannot record payment for inactive learner');
      return;
    }
    // Auto-determine payment term if not set
    let termToUse = paymentTerm;
    if (!termToUse) {
      termToUse = await findOldestOutstandingTerm(selectedStudentForPayment.id, paymentYear);
    }
    if (!termToUse) {
      setPaymentError('No outstanding balance found for this learner');
      return;
    }
    setRecordingPayment(true);
    setPaymentError('');
    try {
      const amountCents = Math.round(parseFloat(paymentAmount) * 100);
      // Generate unique receipt number
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const receiptNumber = `R${timestamp}${random}`;

      // Get student's grade for this year
      const enrollment = await db.get(
        'SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
        [selectedStudentForPayment.id, paymentYear]
      );

      if (!enrollment?.grade_id) {
        throw new Error('Learner is not enrolled for the selected academic year');
      }

      const result = await db.run(
        'INSERT INTO payments (student_id, year_id, term_id, grade_id, receipt_number, amount_paid_cents, payment_date, payment_method, recorded_by) VALUES (?, ?, ?, ?, ?, ?, datetime("now", "localtime"), ?, ?)',
        [
          selectedStudentForPayment.id,
          paymentYear,
          termToUse,
          enrollment.grade_id,
          receiptNumber,
          amountCents,
          paymentMethod,
          1,
        ]
      );

      // Log the activity
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          null,
          'System',
          'payment_recorded',
          'payments',
          result.lastInsertRowid || result.lastID,
          `Payment of ${getCurrencySymbol()}${paymentAmount} recorded for ${selectedStudentForPayment.full_name} (${receiptNumber})`,
        ]
      );

      // Fetch the newly created payment to show receipt
      const newPayment = await db.get(
        `
        SELECT p.id, p.student_id, p.year_id, p.receipt_number, p.amount_paid_cents, p.payment_date, p.is_voided, p.void_reason,
               s.full_name as student_name, s.guardian_name, s.guardian_contact, 
               y.label as year_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.id = ?
      `,
        [result.lastInsertRowid || result.lastID]
      );

      if (newPayment) {
        setSelectedReceipt(newPayment);
      }

      setSelectedStudentForPayment(null);
      setPaymentSelectionMode('search');
      setStudentSearchQuery('');
      setPaymentAmount('');
      setPaymentTerm(null);
      setPaymentMethod('cash');
      fetchDashboardData();
      loadStudentsAndYears(); // Reload students with updated balances
    } catch (err: any) {
      console.error('Payment error:', err);
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const filteredStudents = (students || []).filter(
    s =>
      s.full_name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      String(s.id).includes(studentSearchQuery)
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const currentYear = await db.get(
        'SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1'
      );
      if (!currentYear) {
        setLoading(false);
        return;
      }

      // 1. Grade Distribution
      const gradeBreakdown = await db.all(
        `
        SELECT g.label, COUNT(sye.student_id) as count
        FROM grades g
        LEFT JOIN student_year_enrollment sye ON g.id = sye.grade_id AND sye.year_id = ? AND sye.is_active = 1
        GROUP BY g.id, g.label
        ORDER BY g.id
      `,
        [currentYear.id]
      );

      const totalStudents = gradeBreakdown.reduce((sum: number, g: any) => sum + g.count, 0);

      // 2. Year & Term Financials
      const terms = await db.all(
        `
        SELECT id, label, start_date, end_date FROM terms WHERE year_id = ? ORDER BY term_number ASC
      `,
        [currentYear.id]
      );

      const now = new Date().toISOString().split('T')[0];
      const currentTerm = terms.find(t => t.start_date <= now && t.end_date >= now) || terms[0];
      const currentTermLabel = currentTerm?.label || 'Current Term';

      // Advanced Aggregation for total Year and current Term fees (from student_fees)
      const feesResult = await db.get(
        `
        SELECT 
            COALESCE(SUM(sf.amount_cents), 0) as total_year_fees,
            COALESCE(SUM(CASE WHEN fs.term_id = ? THEN sf.amount_cents ELSE 0 END), 0) as total_term_fees
        FROM student_fees sf
        JOIN fee_structure fs ON sf.fee_structure_id = fs.id
        JOIN student_year_enrollment sye ON sf.student_id = sye.student_id AND fs.year_id = sye.year_id
        WHERE fs.year_id = ?
      `,
        [currentTerm?.id, currentYear.id]
      );

      const yearFees = feesResult?.total_year_fees || 0;
      const termFees = feesResult?.total_term_fees || 0;

      const collectionsResult = await db.get(
        `
        SELECT 
            SUM(amount_paid_cents) as total_collected,
            SUM(CASE WHEN term_id = ? THEN amount_paid_cents ELSE 0 END) as term_collected
        FROM payments
        WHERE year_id = ? AND is_voided = 0
      `,
        [currentTerm?.id, currentYear.id]
      );

      const collected = collectionsResult?.total_collected || 0;
      const rawTermCollected = collectionsResult?.term_collected || 0;

      // 3. Robust Fee Allocation Logic (Rolling surplus to next term)
      // We calculate how much of the TOTAL collected money applies to the CURRENT term.
      // Logic: Collected (Current) = MIN(Expected(Current), TotalPaid - Expected(PreviousTerms))

      const previousTerms = terms.filter(t => t.start_date < currentTerm?.start_date);
      let previousExpected = 0;
      if (previousTerms.length > 0) {
        const prevResult = await db.get(
          `
            SELECT COALESCE(SUM(sf.amount_cents), 0) as total
            FROM student_fees sf
            JOIN fee_structure fs ON sf.fee_structure_id = fs.id
            JOIN student_year_enrollment sye ON sf.student_id = sye.student_id AND fs.year_id = sye.year_id
            WHERE fs.year_id = ? AND fs.term_id IN (${previousTerms.map(t => t.id).join(',')})
        `,
          [currentYear.id]
        );
        previousExpected = prevResult?.total || 0;
      }

      const totalPaid = collected;
      const paidSurplusAfterPrevTerms = Math.max(0, totalPaid - previousExpected);
      const termCollected = Math.min(termFees, paidSurplusAfterPrevTerms);
      const termOutstanding = Math.max(0, termFees - termCollected);

      // 4. Termly Data for Chart (from student_fees)
      const termlyData = await Promise.all(
        terms.map(async term => {
          const expectedResult = await db.get(
            `
            SELECT COALESCE(SUM(sf.amount_cents), 0) as total
            FROM student_fees sf
            JOIN fee_structure fs ON sf.fee_structure_id = fs.id
            JOIN student_year_enrollment sye ON sf.student_id = sye.student_id AND fs.year_id = sye.year_id
            WHERE fs.year_id = ? AND fs.term_id = ?
          `,
            [currentYear.id, term.id]
          );

          const collectedResult = await db.get(
            `
            SELECT SUM(amount_paid_cents) as total
            FROM payments
            WHERE year_id = ? AND term_id = ? AND is_voided = 0
          `,
            [currentYear.id, term.id]
          );

          return {
            term: term.label,
            expected: expectedResult?.total || 0,
            collected: collectedResult?.total || 0,
          };
        })
      );

      // 4. YTD Student Payment Compliance (from student_fees)
      const complianceStats = await db.all(
        `
        WITH student_expected AS (
            SELECT 
                sf.student_id,
                SUM(sf.amount_cents) as expected_ytd
            FROM student_fees sf
            JOIN fee_structure fs ON sf.fee_structure_id = fs.id
            JOIN students s ON sf.student_id = s.id
            WHERE fs.year_id = ? AND s.is_active = 1
            GROUP BY sf.student_id
        ),
        student_paid AS (
            SELECT 
                student_id,
                SUM(amount_paid_cents) as paid_total
            FROM payments
            WHERE year_id = ? AND is_voided = 0
            GROUP BY student_id
        )
        SELECT 
            se.student_id,
            se.expected_ytd,
            COALESCE(sp.paid_total, 0) as paid_total
        FROM student_expected se
        LEFT JOIN student_paid sp ON se.student_id = sp.student_id
      `,
        [currentYear.id, currentYear.id]
      );

      let fullyPaid = 0;
      let partiallyPaid = 0;
      let notPaid = 0;

      complianceStats.forEach(s => {
        if (s.expected_ytd === 0) return; // Ignore students with no fees expected yet

        if (s.paid_total >= s.expected_ytd) {
          fullyPaid++;
        } else if (s.paid_total > 0) {
          partiallyPaid++;
        } else {
          notPaid++;
        }
      });

      const recentActivity = await db.all(`
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
        LIMIT 10
      `);

      setStats({
        totalStudents,
        gradeBreakdown,
        yearFees,
        collected,
        outstanding: yearFees - collected,
        termFees,
        termCollected,
        termOutstanding: termFees - termCollected,
        currentTermLabel,
        recentActivity,
        termlyData,
        fullyPaid,
        partiallyPaid,
        notPaid,
      });
    } catch (err) {
      console.error('Dashboard Data Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => (
    <span className="text-mono">
      {getCurrencySymbol()}
      {(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
    </span>
  );

  const formatNumber = (num: number) => <span className="text-mono">{num}</span>;

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
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Loading dashboard...
        </span>
      </div>
    );

  const PercentageChart: React.FC<{
    data: { term: string; collected: number; expected: number }[];
    style?: React.CSSProperties;
  }> = ({ data, style }) => {
    const chartHeight = 170;
    const intervals = [100, 80, 60, 40, 20, 0];
    return (
      <div style={{ ...style, height: '240px', padding: '30px 20px 40px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '35px 1fr', columnGap: '12px' }}>
          <div
            style={{
              position: 'relative',
              height: `${chartHeight}px`,
              fontSize: '10px',
              color: 'var(--text-secondary)',
              textAlign: 'right',
              paddingRight: '8px',
            }}
            className="text-mono"
          >
            {intervals.map(v => (
              <div
                key={v}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: `${((100 - v) / 100) * chartHeight}px`,
                  transform: 'translateY(-50%)',
                }}
              >
                {v}%
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              height: `${chartHeight}px`,
              alignItems: 'flex-end',
            }}
          >
            {data.map((d, i) => {
              const percent = d.expected > 0 ? Math.min(100, (d.collected / d.expected) * 100) : 0;
              const barHeight = (percent / 100) * chartHeight;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: `-24px`,
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--primary)',
                    }}
                    className="text-mono"
                  >
                    {percent.toFixed(0)}%
                  </div>
                  <div
                    style={{
                      width: '80%',
                      height: `${chartHeight}px`,
                      backgroundColor: 'var(--secondary)',
                      borderRadius: '4px',
                      position: 'relative',
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        width: '100%',
                        height: `${barHeight}px`,
                        backgroundColor: 'var(--primary)',
                        borderRadius: '3px',
                        transition: 'height 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div />
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            {data.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <span
                  style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}
                  className="text-display"
                >
                  {d.term}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const DonutChart: React.FC<{
    breakdown: GradeCount[];
    total: number;
    style?: React.CSSProperties;
  }> = ({ breakdown, total, style }) => {
    const colors = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
      '#06B6D4',
      '#F97316',
    ];
    const activeBreakdown = breakdown.filter(g => g.count > 0);
    let currentAngle = 0;

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'row',
          gap: '24px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ position: 'relative', width: '210px', height: '210px', flexShrink: 0 }}>
          <svg
            viewBox="0 0 32 32"
            style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}
          >
            {activeBreakdown.map((g, i) => {
              const percentage = total > 0 ? (g.count / total) * 100 : 0;
              const strokeDasharray = `${percentage} 100`;
              const strokeDashoffset = -currentAngle;
              currentAngle += percentage;
              return (
                <circle
                  key={i}
                  cx="16"
                  cy="16"
                  r="12"
                  fill="transparent"
                  stroke={colors[i % colors.length]}
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  pathLength="100"
                />
              );
            })}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: '36px',
              backgroundColor: 'var(--surface)',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '28px', fontWeight: 800 }} className="text-mono">
              {total}
            </span>
            <span
              style={{ fontSize: '10px', fontWeight: 700, opacity: 0.5 }}
              className="text-display"
            >
              TOTAL
            </span>
          </div>
        </div>
        <div
          style={{
            width: '100%',
            maxWidth: '240px',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '6px',
          }}
        >
          {activeBreakdown.map((g, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--secondary)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '3px',
                  backgroundColor: colors[i % colors.length],
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                className="text-display"
              >
                {g.label}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800 }} className="text-mono">
                {g.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content" style={{ background: 'var(--background)' }}>
      <div className="flex-between mb-4" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="metric-label" style={{ marginBottom: '4px' }}>
            Executive Summary
          </div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 600 }} className="text-display">
            Dashboard
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ textAlign: 'right', marginRight: '12px' }}>
            <div className="metric-label" style={{ margin: 0, fontSize: '10px' }}>
              Active Term
            </div>
            <div style={{ fontWeight: 800, color: 'var(--primary)' }} className="text-display">
              {stats.currentTermLabel}
            </div>
          </div>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={() => setShowStudentWizard(true)}
            aria-label="Add a new student to the school"
            title="Add a new student to the school"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Record Payment - First Row */}
      <div
        className="card no-print"
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, var(--primary) 0%, #f97316 100%)',
          color: 'white',
        }}
      >
        <h3 className="mb-4" style={{ color: 'white' }}>
          Search Student
        </h3>

        {!selectedStudentForPayment ? (
          <div style={{ position: 'relative' }}>
            <input
            type="text"
            placeholder="Search by student name or ID..."
            value={studentSearchQuery}
            onChange={e => {
              setStudentSearchQuery(e.target.value);
                setShowStudentDropdown(true);
              }}
              onFocus={() => setShowStudentDropdown(true)}
              className="input-default"
              style={{
                padding: '16px 20px',
                fontSize: '16px',
                borderRadius: '12px',
                border: '3px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                color: '#1f2937',
              }}
            />
            {showStudentDropdown && studentSearchQuery.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  marginTop: 8,
                  maxHeight: 280,
                  overflowY: 'auto',
                  zIndex: 20,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)',
                }}
              >
                {filteredStudents.slice(0, 10).map(s => (
                  <div
                    key={s.id}
                    onClick={async () => {
                      setSelectedStudentForPayment(s);
                      setPaymentSelectionMode('actions');
                      setShowStudentDropdown(false);
                      setStudentSearchQuery('');
                      setPaymentAmount('');
                      setPaymentError('');

                      // Auto-determine payment term: oldest term with outstanding balance
                      if (paymentYear) {
                        const termId = await findOldestOutstandingTerm(s.id, paymentYear);
                        setPaymentTerm(termId);
                      } else {
                        setPaymentTerm(null);
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        ID: {s.id} - {s.grade_label}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredStudents.length === 0 && (
                  <div
                    style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}
                  >
                    No students found
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '20px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: '16px',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Learner selected</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>
                    {selectedStudentForPayment.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Balance:{' '}
                    {selectedStudentForPayment.balance > 0
                      ? `-${getCurrencySymbol()}${Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)}`
                      : selectedStudentForPayment.balance < 0
                        ? `+${getCurrencySymbol()}${Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)}`
                        : `${getCurrencySymbol()}0.00`}
                  </div>
                </div>
                <div style={{ fontSize: '13px', opacity: 0.8 }}>
                  {selectedStudentForPayment.grade_label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => resetPaymentSelection()}
                style={{
                  background: 'white',
                  border: '1px solid #fed7aa',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    onViewStatement?.(selectedStudentForPayment.id);
                    resetPaymentSelection();
                  }}
                  style={{
                    background: 'white',
                    border: '1px solid #fed7aa',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                  }}
                >
                  View Account
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSelectionMode('record')}
                  style={{
                    background: 'white',
                    border: '1px solid #fed7aa',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                  }}
                >
                  Record Payment
                </button>
              </div>

            {paymentSelectionMode === 'record' && (
              <div style={{ marginTop: '18px' }}>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: '#1f2937',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Current Balance
                    </div>
                    <div
                      style={{
                        fontSize: '22px',
                        fontWeight: 700,
                        color: selectedStudentForPayment.balance > 0 ? '#dc2626' : '#059669',
                      }}
                    >
                      {selectedStudentForPayment.balance > 0
                        ? `-${getCurrencySymbol()}${Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)}`
                        : selectedStudentForPayment.balance < 0
                          ? `+${getCurrencySymbol()}${Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)}`
                          : `${getCurrencySymbol()}0.00`}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      backgroundColor: selectedStudentForPayment.balance > 0 ? '#FEE2E2' : '#D1FAE5',
                      color: selectedStudentForPayment.balance > 0 ? '#991B1B' : '#065F46',
                    }}
                  >
                    {selectedStudentForPayment.balance > 0 ? 'Owing' : 'Paid'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        fontSize: '11px',
                        opacity: 0.8,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      YEAR
                    </label>
                    <select
                      className="input-default"
                      value={paymentYear || ''}
                      onChange={async e => {
                        const newYear = Number(e.target.value);
                        setPaymentYear(newYear);
                        // Auto-set payment term for selected student
                        if (selectedStudentForPayment) {
                          const termId = await findOldestOutstandingTerm(
                            selectedStudentForPayment.id,
                            newYear
                          );
                          setPaymentTerm(termId);
                        } else {
                          setPaymentTerm(null);
                        }
                      }}
                      style={{ background: 'white', color: '#1f2937', fontWeight: 600 }}
                    >
                      {years.map(y => (
                        <option key={y.id} value={y.id}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: '11px',
                        opacity: 0.8,
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      AMOUNT ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input-default"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      style={{
                        background: 'white',
                        color: '#1f2937',
                        fontWeight: 700,
                        fontSize: '16px',
                        border: '2px solid #1f2937',
                        }}
                      />
                      {selectedStudentForPayment.balance > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentAmount(
                            Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)
                          )
                        }
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          border: '1px solid #F59E0B',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          width: '100%',
                        }}
                      >
                        Pay Balance (-${getCurrencySymbol()}$
                        {Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)})
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
                  </div>

                  {paymentError && (
                    <div
                      style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#FEE2E2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '8px',
                      color: '#991B1B',
                      fontSize: '14px',
                    }}
                  >
                    {paymentError}
                  </div>
                )}

                <button
                  className="btn"
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    background: 'white',
                    color: 'var(--primary)',
                    fontWeight: 700,
                    fontSize: '16px',
                    padding: '14px',
                  }}
                  disabled={recordingPayment || !paymentAmount}
                  onClick={handleRecordPayment}
                >
                  {recordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '24px',
        }}
      >
        {/* Metric Cards - Focused on Current Term */}
        <SynthetixCard>
          <div className="metric-label">Total Students</div>
          <div className="metric-value">{formatNumber(stats.totalStudents)}</div>
        </SynthetixCard>

        <SynthetixCard>
          <div className="metric-label">Expected ({stats.currentTermLabel})</div>
          <div className="metric-value">{formatCurrency(stats.termFees)}</div>
        </SynthetixCard>

        <SynthetixCard>
          <div className="metric-label">Collected ({stats.currentTermLabel})</div>
          <div className="metric-value" style={{ color: '#10B981' }}>
            {formatCurrency(stats.termCollected)}
          </div>
        </SynthetixCard>

        <SynthetixCard>
          <div className="metric-label">Outstanding ({stats.currentTermLabel})</div>
          <div className="metric-value" style={{ color: 'var(--primary)' }}>
            {formatCurrency(stats.termOutstanding)}
          </div>
        </SynthetixCard>

        {/* Payment Status Overview - Full Width */}
        <SynthetixCard style={{ gridColumn: 'span 4' }}>
          <div className="metric-label">Year-to-Date Learner Payment Compliance</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            <div
              style={{
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid #10B981',
                backgroundColor: '#ECFDF5',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  color: '#065F46',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  letterSpacing: '0.05em',
                }}
                className="text-display"
              >
                FULLY PAID
              </div>
              <div
                style={{ fontSize: '32px', fontWeight: 800, color: '#047857' }}
                className="text-mono"
              >
                {formatNumber(stats.fullyPaid)}
              </div>
            </div>
            <div
              style={{
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid #F59E0B',
                backgroundColor: '#FFFBEB',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  color: '#92400E',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  letterSpacing: '0.05em',
                }}
                className="text-display"
              >
                PARTIALLY PAID
              </div>
              <div
                style={{ fontSize: '32px', fontWeight: 800, color: '#B45309' }}
                className="text-mono"
              >
                {formatNumber(stats.partiallyPaid)}
              </div>
            </div>
            <div
              style={{
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid #EF4444',
                backgroundColor: '#FEF2F2',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '-10px',
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  color: '#991B1B',
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  letterSpacing: '0.05em',
                }}
                className="text-display"
              >
                NO PAYMENT
              </div>
              <div
                style={{ fontSize: '32px', fontWeight: 800, color: '#B91C1C' }}
                className="text-mono"
              >
                {formatNumber(stats.notPaid)}
              </div>
            </div>
          </div>
        </SynthetixCard>

        {/* Progress and Distribution - 50/50 split */}
        <SynthetixCard style={{ gridColumn: 'span 2' }}>
          <div className="metric-label">Collection Progress by Payment Period</div>
          <PercentageChart data={stats.termlyData} style={{ marginTop: '24px' }} />
        </SynthetixCard>

        <SynthetixCard style={{ gridColumn: 'span 2' }}>
          <div className="metric-label">Grade/Form Distribution</div>
          <DonutChart
            breakdown={stats.gradeBreakdown}
            total={stats.totalStudents}
            style={{ marginTop: '24px' }}
          />
        </SynthetixCard>
      </div>

      {showPaymentModal && (
        <PaymentWizard
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            fetchDashboardData();
          }}
        />
      )}
      {showStudentWizard && (
        <StudentWizard
          onClose={() => setShowStudentWizard(false)}
          onSuccess={() => {
            setShowStudentWizard(false);
            fetchDashboardData();
            loadStudentsAndYears();
          }}
        />
      )}
      {selectedReceipt && (
        <Receipt
          payment={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          canVoid={false}
        />
      )}
      {selectedStudentForPayment && statementLoading && !showStatementPreview && (
        <div
          className="card-surface"
          style={{
            minHeight: 420,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: '4px solid var(--secondary)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
            Loading learner statement...
          </div>
        </div>
      )}
      {showStatementPreview && (
        <StudentStatementPreview
          statementData={statementData}
          isLoadingDetail={statementLoading}
          detailError={null}
          schoolName={schoolName}
          schoolLogo={schoolLogo}
          schoolContact={schoolContact}
          termsList={termsList}
          showOwing={true}
          showPaid={true}
          onExit={() => setShowStatementPreview(false)}
          onEditProfile={() => {}}
          onRecordPayment={() => {}}
          onRetry={() => viewStatement(selectedStudentForPayment)}
        />
      )}
    </div>
  );
};

export default Dashboard;
