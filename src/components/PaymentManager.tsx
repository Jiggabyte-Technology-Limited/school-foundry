import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';
import {
  printDocument,
  generatePaymentStatementHtml,
  generateReceiptHtml,
} from '../lib/print-service';
import { getCurrencySymbol } from '../lib/currency';
import SchoolPaymentsOverview from './payments/SchoolPaymentsOverview';
import PaymentReceiptPreview from './payments/PaymentReceiptPreview';
import StudentStatementPreview from './StudentStatementPreview';
import PaymentMethodToggle, { PaymentMethod } from './ui/PaymentMethodToggle';
import ChipSelector from './ui/ChipSelector';

interface Payment {
  id: number;
  student_id: number;
  year_id: number;
  term_id: number;
  receipt_number: string;
  amount_paid_cents: number;
  payment_date: string;
  received_by: number | null;
  recorded_by_name: string;
  student_name: string;
  year_label: string;
  term_label: string;
  guardian_name: string;
  guardian_contact: string;
  is_voided?: number;
  void_reason?: string;
}

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

// Helper component for last 10 activities
const ActivityLogPreview: React.FC = () => {
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadRecentLogs();
  }, []);

  const loadRecentLogs = async () => {
    const logs = await db.all(`
      SELECT al.*, u.username
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.logged_at DESC
      LIMIT 10
    `);
    setRecentLogs(logs);
  };

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      {recentLogs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
          No activity yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentLogs.map(log => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                backgroundColor: 'var(--color-sage-cream)',
                borderRadius: '8px',
                borderLeft: '3px solid var(--primary)',
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  {formatAction(log.action)}
                </span>
                <span
                  style={{ color: 'var(--text-secondary)', fontSize: '12px', marginLeft: '8px' }}
                >
                  {log.details}
                </span>
              </div>
              <div
                style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
              >
                {log.username || 'System'} • {formatDate(log.logged_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper component for full paginated logs
const FullActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LOGS_PER_PAGE = 50;

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    const offset = (page - 1) * LOGS_PER_PAGE;
    const [logData, countData] = await Promise.all([
      db.all(
        `
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
        LIMIT ? OFFSET ?
      `,
        [LOGS_PER_PAGE, offset]
      ),
      db.get('SELECT COUNT(*) as count FROM activity_log'),
    ]);
    setLogs(logData);
    setTotalCount(countData?.count || 0);
  };

  const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const PaginationControls = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Showing {(page - 1) * LOGS_PER_PAGE + 1} - {Math.min(page * LOGS_PER_PAGE, totalCount)} of{' '}
        {totalCount}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-outline"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          Previous
        </button>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          Page {page} of {totalPages}
        </span>
        <button
          className="btn btn-outline"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <PaginationControls />
      <table style={{ marginTop: '12px', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Date & Time
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              User
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Action
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '10px',
                borderBottom: '2px solid var(--border)',
                fontSize: '12px',
              }}
            >
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                {formatDate(log.logged_at)}
              </td>
              <td
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {log.username || 'System'}
              </td>
              <td
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '12px',
                }}
              >
                {formatAction(log.action)}
              </td>
              <td
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                {log.details || '-'}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td
                colSpan={4}
                style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}
              >
                No activity logs found
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <PaginationControls />
    </div>
  );
};

interface PaymentManagerProps {
  onViewStatement?: (studentId: number) => void;
}

const PaymentManager: React.FC<PaymentManagerProps> = ({ onViewStatement }) => {
  const { user, canRecordPayments, canVoidPayments } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [stats, setStats] = useState<PaymentStats>({
    todayTotal: 0,
    weekTotal: 0,
    monthTotal: 0,
    yearTotal: 0,
    todayCount: 0,
    weekCount: 0,
    expectedTermTotal: 0,
    paidTermTotal: 0,
    expectedYearTotal: 0,
    paidYearTotal: 0,
    outstandingTerm: 0,
    outstandingYear: 0,
  });

  // Filters for activity table
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [timePeriodFilter, setTimePeriodFilter] = useState('all');
  const [activitySearchQuery, setActivitySearchQuery] = useState('');

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [showFullLogs, setShowFullLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const LOGS_PER_PAGE = 50;
  const [exportingActivity, setExportingActivity] = useState(false);

  // Print statements state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPeriodFilter, setPrintPeriodFilter] = useState('all');
  const [printPreviewData, setPrintPreviewData] = useState<any[]>([]);
  const [schoolName, setSchoolName] = useState('School');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolContact, setSchoolContact] = useState<string>('');
  const [currentTermLabel, setCurrentTermLabel] = useState<string>('');
  const [currentTermWindow, setCurrentTermWindow] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [voidKey, setVoidKey] = useState<string>('1234');
  const [showVoidKeyModal, setShowVoidKeyModal] = useState(false);
  const [voidKeyInput, setVoidKeyInput] = useState('');
  const [voidKeyError, setVoidKeyError] = useState('');

  // View state: 'overview' or 'receipt'
  const [viewMode, setViewMode] = useState<'overview' | 'receipt'>('overview');

  // Student selection filters
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [paymentSelectionMode, setPaymentSelectionMode] = useState<'search' | 'actions' | 'record'>(
    'search'
  );
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<any | null>(null);

  const [form, setForm] = useState({
    student_id: '',
    year_id: '',
    amount: '',
    receipt_number: '',
    payment_method: 'cash' as PaymentMethod,
    notes: '',
  });

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidComment, setVoidComment] = useState('');
  const [showStatementPreview, setShowStatementPreview] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [termsList, setTermsList] = useState<any[]>([]);

  const formatBalance = (cents: number) => {
    const amount = `${getCurrencySymbol()}${Math.abs(cents / 100).toFixed(2)}`;
    if (cents > 0) return `-${amount}`;
    if (cents < 0) return `+${amount}`;
    return `${getCurrencySymbol()}0.00`;
  };

  const formatActivityAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  useEffect(() => {
    setLoading(true);

    loadStudents();
    loadPayments();
    loadStats();
    loadActivityLogs();

    // Safety timeout
    const timeout = setTimeout(() => setLoading(false), 10000);

    // Load school name
    (async () => {
      const [nameSetting, logoSetting, phoneSetting, emailSetting, voidKeySetting, termsData] =
        await Promise.all([
          db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
          db.get("SELECT value FROM app_settings WHERE key = 'school_logo'"),
          db.get("SELECT value FROM app_settings WHERE key = 'school_phone'"),
          db.get("SELECT value FROM app_settings WHERE key = 'school_email'"),
          db.get("SELECT value FROM app_settings WHERE key = 'void_key'"),
          db.all('SELECT id, label FROM terms ORDER BY term_number'),
        ]);
      if (nameSetting?.value) setSchoolName(nameSetting.value);
      setSchoolLogo(logoSetting?.value || null);
      if (voidKeySetting?.value) setVoidKey(voidKeySetting.value);

      const phone = phoneSetting?.value || '';
      const email = emailSetting?.value || '';
      const contactParts = [phone, email].filter(Boolean);
      setSchoolContact(contactParts.join(' | '));
      setTermsList(termsData);

      // Get current term label based on today's date
      const currentYearId = await db.get(
        `SELECT id FROM academic_years ORDER BY label DESC LIMIT 1`
      );
      const currentTerm = await db.get(
        `SELECT label, start_date, end_date FROM terms WHERE year_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL AND date('now') >= date(start_date) AND date('now') <= date(end_date) ORDER BY term_number LIMIT 1`,
        [currentYearId?.id || 0]
      );
      // Fallback to first term if no current term found
      const fallbackTerm = await db.get(
        `SELECT label, start_date, end_date FROM terms WHERE year_id = ? ORDER BY term_number LIMIT 1`,
        [currentYearId?.id || 0]
      );
      setCurrentTermLabel(currentTerm?.label || fallbackTerm?.label || '');
      const activeTerm = currentTerm || fallbackTerm;
      if (activeTerm?.start_date && activeTerm?.end_date) {
        setCurrentTermWindow({
          start: activeTerm.start_date,
          end: activeTerm.end_date,
        });
      }
      setLoading(false);
    })();

    return () => clearTimeout(timeout);
  }, []);

  const viewStatement = async (student: any) => {
    if (!form.year_id) return;
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
          [student.id, form.year_id]
        ),
        db.all(
          `SELECT sf.debit_date as date, fs.description, sf.amount_cents as amount, 'Fee' as type,
                  t.label as term_label
           FROM student_fees sf
           JOIN fee_structure fs ON sf.fee_structure_id = fs.id
           LEFT JOIN terms t ON fs.term_id = t.id
           WHERE sf.student_id = ? AND fs.year_id = ?
           ORDER BY sf.debit_date`,
          [student.id, form.year_id]
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

  const loadStudents = async () => {
    const currentYear = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
    const [studentList, gradeList, yearList] = await Promise.all([
      db.all(
        `SELECT s.id, s.full_name,
        CASE
          WHEN cs.label IS NULL OR cs.label = '' THEN g.label
          ELSE g.label || ' - ' || cs.label
        END as grade_label,
        sye.grade_id, s.is_active,
        COALESCE((SELECT SUM(amount_cents) FROM fee_structure fs JOIN terms t ON fs.term_id = t.id WHERE fs.year_id = ? AND fs.grade_id = sye.grade_id AND (t.start_date IS NULL OR t.start_date <= date('now'))), 0) -
        COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
        FROM students s
        LEFT JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
        LEFT JOIN grades g ON sye.grade_id = g.id
        LEFT JOIN class_sections cs ON sye.class_section_id = cs.id
        WHERE s.is_active = 1
        ORDER BY s.full_name`,
        [currentYear?.id, currentYear?.id, currentYear?.id]
      ),
      db.all('SELECT id, label FROM grades ORDER BY id'),
      db.all('SELECT id, label FROM academic_years ORDER BY label DESC'),
    ]);
    setStudents(studentList);
    setGrades(gradeList);
    setYears(yearList);

    if (yearList.length > 0) {
      setForm(f => ({ ...f, year_id: String(yearList[0].id) }));
    }

    await generateReceiptNumber();
  };

  const loadPayments = async () => {
    try {
      const paymentList = await db.all(`
        SELECT p.*, s.full_name as student_name, s.guardian_name, s.guardian_contact, y.label as year_label, t.label as term_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        LEFT JOIN terms t ON p.term_id = t.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.is_voided = 0
        ORDER BY p.payment_date DESC
        LIMIT 100
      `);
      setPayments(paymentList);
    } catch (err) {
      console.error('Error loading payments:', err);
    }
  };

  const handleVoidPayment = async () => {
    if (!canVoidPayments) {
      alert('You do not have permission to void payments.');
      return;
    }
    if (!voidingPayment || !voidReason) return;
    try {
      await db.run(
        `UPDATE payments SET 
          is_voided = 1,
          voided_by = ?,
          voided_at = datetime('now', 'localtime'),
          void_reason = ?
        WHERE id = ?`,
        [
          user?.id ?? null,
          `Voided: ${voidReason}${voidComment ? ' - ' + voidComment : ''}`,
          voidingPayment.id,
        ]
      );

      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          user?.id ?? null,
          user?.username ?? 'System',
          'payment_voided',
          'payments',
          voidingPayment.id,
          `Payment ${voidingPayment.receipt_number} voided: ${voidReason}`,
        ]
      );
      showToast(
        'success',
        'Payment Voided',
        `Receipt ${voidingPayment.receipt_number} has been voided.`
      );
      setShowVoidModal(false);
      setVoidingPayment(null);
      setVoidReason('');
      setVoidComment('');
      loadPayments();
      loadStats();
      loadActivityLogs();
    } catch (err: any) {
      setError(err.message || 'Failed to void payment');
    }
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    // Get current year and term based on today's date
    const currentYear = await db.get(`SELECT id FROM academic_years ORDER BY label DESC LIMIT 1`);

    // Get current term based on today's date
    const termToUse = await db.get(
      `SELECT id, label FROM terms WHERE year_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL AND date('now') >= date(start_date) AND date('now') <= date(end_date) ORDER BY term_number LIMIT 1`,
      [currentYear?.id || 0]
    );

    // Fallback to first term if no current term found (e.g., between terms)
    const fallbackTerm = await db.get(
      `SELECT id, label FROM terms WHERE year_id = ? ORDER BY term_number LIMIT 1`,
      [currentYear?.id || 0]
    );
    const term = termToUse?.id ? termToUse : fallbackTerm;

    const [todayStats, weekStats, monthStats, yearStats, termFees, termPayments, firstTermResult] =
      await Promise.all([
        db.get(
          `SELECT COALESCE(SUM(amount_paid_cents), 0) as total, COALESCE(COUNT(*), 0) as count FROM payments WHERE is_voided = 0 AND payment_date LIKE ?`,
          [today + '%']
        ),
        db.get(
          `SELECT COALESCE(SUM(amount_paid_cents), 0) as total, COALESCE(COUNT(*), 0) as count FROM payments WHERE is_voided = 0 AND payment_date >= ?`,
          [weekAgo]
        ),
        db.get(
          `SELECT COALESCE(SUM(amount_paid_cents), 0) as total FROM payments WHERE is_voided = 0 AND payment_date >= ?`,
          [monthAgo]
        ),
        db.get(
          `SELECT COALESCE(SUM(amount_paid_cents), 0) as total FROM payments WHERE is_voided = 0 AND payment_date >= ?`,
          [yearStart]
        ),
        // Expected fees for current term - get all fees for current year (sum of all terms)
        db.get(
          `SELECT COALESCE(SUM(fs.amount_cents), 0) as total FROM fee_structure fs WHERE fs.year_id = ?`,
          [currentYear?.id || 0]
        ),
        // Paid for current term - get all payments for current year
        db.get(
          `SELECT COALESCE(SUM(p.amount_paid_cents), 0) as total FROM payments p WHERE p.is_voided = 0 AND p.year_id = ?`,
          [currentYear?.id || 0]
        ),
        // Get first term that has fees (for year calculation)
        db.get(
          `SELECT t.id, t.term_number FROM terms t 
         JOIN fee_structure fs ON fs.term_id = t.id
         WHERE t.year_id = ? 
         GROUP BY t.id, t.term_number
         ORDER BY t.term_number LIMIT 1`,
          [currentYear?.id || 0]
        ),
      ]);

    // Extract term/year totals from query results
    const expectedTermTotal = termFees?.total || 0;
    const paidTermTotal = termPayments?.total || 0;

    // Get first term with fees info
    const firstTermWithFees = firstTermResult;

    // Calculate year totals from first term with fees onwards
    let expectedYearTotal = 0;
    let paidYearTotal = 0;

    if (firstTermWithFees && currentYear?.id) {
      // Get all terms from first term with fees onwards
      const termsFromFirst = await db.all(
        `SELECT id FROM terms WHERE year_id = ? AND term_number >= ? ORDER BY term_number`,
        [currentYear.id, firstTermWithFees.term_number]
      );
      const termIds = termsFromFirst.map((t: any) => t.id);

      if (termIds.length > 0) {
        const placeholders = termIds.map(() => '?').join(',');
        // Expected fees from first term onwards
        const yearFeesFromFirst = await db.get(
          `SELECT COALESCE(SUM(fs.amount_cents), 0) as total FROM fee_structure fs WHERE fs.year_id = ? AND fs.term_id IN (${placeholders})`,
          [currentYear.id, ...termIds]
        );
        // Paid from first term onwards
        const yearPaymentsFromFirst = await db.get(
          `SELECT COALESCE(SUM(p.amount_paid_cents), 0) as total FROM payments p WHERE p.is_voided = 0 AND p.year_id = ? AND p.term_id IN (${placeholders})`,
          [currentYear.id, ...termIds]
        );
        expectedYearTotal = yearFeesFromFirst?.total || 0;
        paidYearTotal = yearPaymentsFromFirst?.total || 0;
      }
    } else {
      // Fallback: get all year fees and payments if no first term found
      const allYearFees = await db.get(
        `SELECT COALESCE(SUM(fs.amount_cents), 0) as total FROM fee_structure fs WHERE fs.year_id = ?`,
        [currentYear?.id || 0]
      );
      const allYearPayments = await db.get(
        `SELECT COALESCE(SUM(p.amount_paid_cents), 0) as total FROM payments p WHERE p.is_voided = 0 AND p.year_id = ?`,
        [currentYear?.id || 0]
      );
      expectedYearTotal = allYearFees?.total || 0;
      paidYearTotal = allYearPayments?.total || 0;
    }

    const outstandingTerm = Math.max(0, expectedTermTotal - paidTermTotal);
    const outstandingYear = Math.max(0, expectedYearTotal - paidYearTotal);

    setStats({
      todayTotal: todayStats?.total || 0,
      weekTotal: weekStats?.total || 0,
      monthTotal: monthStats?.total || 0,
      yearTotal: yearStats?.total || 0,
      todayCount: todayStats?.count || 0,
      weekCount: weekStats?.count || 0,
      expectedTermTotal,
      paidTermTotal,
      expectedYearTotal,
      paidYearTotal,
      outstandingTerm,
      outstandingYear,
    });
  };

  const buildActivityLogQuery = (
    options: {
      includeLimit?: boolean;
      page?: number;
      searchQuery?: string;
      timePeriod?: string;
      currentTermWindow?: { start: string; end: string } | null;
    } = {}
  ) => {
    const includeLimit = options.includeLimit !== false;
    const page = options.page || 1;
    const searchQuery = options.searchQuery ?? activitySearchQuery;
    const timePeriod = options.timePeriod ?? timePeriodFilter;
    const termWindow = options.currentTermWindow ?? currentTermWindow;
    const offset = (page - 1) * LOGS_PER_PAGE;
    let whereClause = "WHERE al.action IN ('payment_recorded', 'payment_voided')";
    const params: any[] = [];

    if (searchQuery.trim()) {
      whereClause += ` AND (p.receipt_number LIKE ? OR s.full_name LIKE ? OR u.username LIKE ?)`;
      const searchTerm = `%${searchQuery.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (timePeriod === 'week') {
      whereClause += ` AND datetime(al.logged_at) >= datetime(?)`;
      params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    } else if (timePeriod === 'month') {
      whereClause += ` AND datetime(al.logged_at) >= datetime(?)`;
      params.push(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    } else if (timePeriod === 'term' && termWindow?.start && termWindow?.end) {
      whereClause += ` AND date(al.logged_at) BETWEEN date(?) AND date(?)`;
      params.push(termWindow.start, termWindow.end);
    }

    const sql = `
        SELECT al.id, al.action, al.details, al.logged_at, al.entity, al.entity_id,
               u.username, p.receipt_number, p.amount_paid_cents, s.full_name as student_name
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN payments p ON al.entity = 'payments' AND al.entity_id = p.id
        LEFT JOIN students s ON p.student_id = s.id
        ${whereClause}
        ORDER BY al.logged_at DESC
        ${includeLimit ? 'LIMIT ? OFFSET ?' : ''}
      `;

    if (includeLimit) {
      params.push(LOGS_PER_PAGE, offset);
    }

    return { sql, params };
  };

  const loadActivityLogs = async (page = 1, searchQuery = activitySearchQuery) => {
    try {
      const { sql, params } = buildActivityLogQuery({
        includeLimit: true,
        page,
        searchQuery,
      });
      const logs = await db.all(sql, params);
      setActivityLogs(logs);
      setLogPage(page);
    } catch (err) {
      console.error('Error loading activity logs:', err);
    }
  };

  const handleExportActivityXlsx = async () => {
    setExportingActivity(true);
    try {
      const { sql, params } = buildActivityLogQuery({ includeLimit: false });
      const logs = await db.all(sql, params);
      if (logs.length === 0) {
        showToast('info', 'No Activity', 'There are no activity records for the selected filters.');
        return;
      }
      const result = await window.api.exportXlsxReport({
        suggestedFileName: `recent-activity-${timePeriodFilter}-${new Date()
          .toISOString()
          .slice(0, 10)}`,
        workbook: {
          sheetName: 'Recent Activity',
          topRows: [
            { value: schoolName, mergeAcross: 6 },
            { value: 'Recent Payment Activity', mergeAcross: 6 },
            {
              value: `Filters: ${getPeriodLabel()}${activitySearchQuery.trim() ? ` | Search: ${activitySearchQuery.trim()}` : ''}`,
              mergeAcross: 6,
            },
            {
              value:
                [new Date().toLocaleDateString(), schoolContact].filter(Boolean).join(' | ') ||
                'Recent activity export',
              mergeAcross: 6,
            },
          ],
          columns: [
            { key: 'loggedAt', header: 'Date & Time', width: 22 },
            { key: 'receiptNumber', header: 'Receipt Number', width: 18 },
            { key: 'studentName', header: 'Learner', width: 28 },
            { key: 'userName', header: 'User', width: 18 },
            { key: 'action', header: 'Action', width: 18 },
            { key: 'amount', header: 'Amount', width: 14, type: 'currency' },
            { key: 'details', header: 'Details', width: 36 },
          ],
          rows: logs.map((log: any) => ({
            loggedAt: formatDate(log.logged_at),
            receiptNumber: log.receipt_number || '-',
            studentName: log.student_name || '-',
            userName: log.username || 'System',
            action: formatActivityAction(log.action),
            amount: (log.amount_paid_cents || 0) / 100,
            details: log.details || '-',
          })),
          freezeRows: 5,
          autoFilter: true,
        },
      });

      if (result.success) {
        showToast('success', 'Excel Exported', `Saved to ${result.filePath}`);
      } else if (!result.canceled) {
        showToast('error', 'Export Failed', result.error || 'Could not export recent activity.');
      }
    } catch (err) {
      showToast(
        'error',
        'Export Failed',
        err instanceof Error ? err.message : 'Could not export recent activity.'
      );
    } finally {
      setExportingActivity(false);
    }
  };

  useEffect(() => {
    loadActivityLogs(1);
  }, [timePeriodFilter, currentTermWindow]);

  const loadPrintPreview = async () => {
    try {
      let dateFilter = '';
      const now = new Date();

      switch (printPeriodFilter) {
        case 'last_week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND p.payment_date >= '${weekAgo.toISOString().split('T')[0]}'`;
          break;
        case 'last_month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter = `AND p.payment_date >= '${monthAgo.toISOString().split('T')[0]}'`;
          break;
        case 'this_term':
          if (form.term_id) {
            dateFilter = `AND p.term_id = ${form.term_id}`;
          }
          break;
        default:
          dateFilter = '';
      }

      const payments = await db.all(`
        SELECT p.receipt_number, p.amount_paid_cents, p.payment_date, p.is_voided,
               s.full_name as student_name, t.label as term_label, y.label as year_label,
               u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        LEFT JOIN terms t ON p.term_id = t.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.is_voided = 0 ${dateFilter}
        ORDER BY p.payment_date DESC
      `);
      setPrintPreviewData(payments);
    } catch (err) {
      console.error('Error loading print preview:', err);
    }
  };

  const handleOpenPrintModal = () => {
    loadPrintPreview();
    setShowPrintModal(true);
  };

  const handleViewReceiptFromActivity = async (log: any) => {
    if (!log.entity_id) return;
    try {
      const payment = await db.get(
        `
        SELECT p.id, p.student_id, p.year_id, p.receipt_number, p.amount_paid_cents, p.payment_date, p.is_voided, p.void_reason,
               s.full_name as student_name, s.guardian_name, s.guardian_contact, 
               y.label as year_label, t.label as term_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        LEFT JOIN terms t ON p.term_id = t.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.id = ?
      `,
        [log.entity_id]
      );
      if (payment) {
        setSelectedReceipt(payment);
        setViewMode('receipt');
      }
    } catch (err) {
      console.error('Error loading receipt:', err);
    }
  };

  const handleCloseReceipt = () => {
    setSelectedReceipt(null);
    setViewMode('overview');
  };

  const getTotalLogCount = async () => {
    const result = await db.get('SELECT COUNT(*) as count FROM activity_log');
    return result?.count || 0;
  };

  const generateReceiptNumber = async () => {
    // Use timestamp + random to guarantee uniqueness
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const receiptNumber = `RCP${timestamp}${random}`;

    // Verify it doesn't exist, if so, try again
    const existing = await db.get('SELECT id FROM payments WHERE receipt_number = ?', [
      receiptNumber,
    ]);
    if (existing) {
      // If somehow exists, add more randomness
      const newRandom = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      setForm(f => ({ ...f, receipt_number: `RCP${timestamp}${newRandom}` }));
    } else {
      setForm(f => ({ ...f, receipt_number: receiptNumber }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.student_id || !form.year_id || !form.amount) {
      setError('Please fill in all required fields');
      return;
    }

    // Check if learner is active
    const student = students.find(s => s.id === Number(form.student_id));
    if (student && student.is_active === 0) {
      setError('Cannot record payment for inactive learner');
      return;
    }

    // Auto-determine payment term
    const termToUse = await findOldestOutstandingTerm(
      Number(form.student_id),
      Number(form.year_id)
    );
    if (!termToUse) {
      setError('No outstanding balance found for this learner');
      return;
    }

    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(form.amount) * 100);

      // Get student's grade for this year
      const enrollment = await db.get(
        'SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
        [form.student_id, form.year_id]
      );

      if (!enrollment?.grade_id) {
        throw new Error('Learner is not enrolled for the selected academic year');
      }

      const result = await db.run(
        `
        INSERT INTO payments (student_id, year_id, term_id, grade_id, receipt_number, amount_paid_cents, payment_date, payment_method, notes, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)
      `,
        [
          form.student_id,
          form.year_id,
          termToUse,
          enrollment.grade_id,
          form.receipt_number,
          amountCents,
          form.payment_method || 'cash',
          form.notes || '',
          user?.id ?? 1,
        ]
      );

      const student = students.find(s => s.id === Number(form.student_id));
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [
          user?.id ?? null,
          user?.username ?? 'System',
          'payment_recorded',
          'payments',
          result.lastInsertRowid || result.lastID,
          `Payment of ${getCurrencySymbol()}${form.amount} recorded for ${student?.full_name} (${form.receipt_number})`,
        ]
      );

      // Fetch the newly created payment to show receipt
      const newPayment = await db.get(
        `
        SELECT p.*, s.full_name as student_name, s.guardian_name, s.guardian_contact, y.label as year_label, t.label as term_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        LEFT JOIN terms t ON p.term_id = t.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.id = ?
      `,
        [result.lastInsertRowid || result.lastID]
      );

      if (newPayment) {
        setSelectedReceipt(newPayment);
        setViewMode('receipt');
      }

      setForm({
        student_id: '',
        year_id: form.year_id,
        amount: '',
        receipt_number: '',
        payment_method: 'cash',
        notes: '',
      });
      await generateReceiptNumber();

      // Small delay to ensure DB commits
      await new Promise(resolve => setTimeout(resolve, 100));
      loadPayments();
      loadStats();
      loadActivityLogs();
      loadStudents(); // Reload students with updated balances
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) =>
    `${getCurrencySymbol()}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const filterPaymentsByPeriod = (paymentList: Payment[]): Payment[] => {
    if (timePeriodFilter === 'all') return paymentList;

    const now = new Date();
    let filterDate = new Date();

    if (timePeriodFilter === 'week') {
      filterDate.setDate(now.getDate() - 7);
    } else if (timePeriodFilter === 'month') {
      filterDate.setMonth(now.getMonth() - 1);
    } else if (timePeriodFilter === 'term') {
      // Filter by current or recent term
      const currentTermStart = new Date(
        now.getFullYear(),
        now.getMonth() - (now.getMonth() % 4),
        1
      );
      filterDate = currentTermStart;
    }

    return paymentList.filter(p => new Date(p.payment_date) >= filterDate);
  };

  const getFilteredPayments = (): Payment[] => {
    let filtered = payments;

    // Filter by activity type
    if (activityTypeFilter === 'payments') {
      // Already showing payments, keep all
    } else if (activityTypeFilter === 'recent') {
      // Show only today's payments
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(p => p.payment_date.startsWith(today));
    }

    // Filter by time period
    filtered = filterPaymentsByPeriod(filtered);

    return filtered;
  };

  const getFilteredStudents = (): any[] => {
    let filtered = students;

    // Filter by grade
    if (selectedGradeFilter !== 'all') {
      filtered = filtered.filter(s => s.grade_id === Number(selectedGradeFilter));
    }

    // Filter by search query
    if (studentSearchQuery.trim()) {
      const query = studentSearchQuery.toLowerCase();
      filtered = filtered.filter(
        s => s.full_name.toLowerCase().includes(query) || s.id.toString().includes(query)
      );
    }

    return filtered;
  };

  const handleSelectStudent = (studentId: number) => {
    const student = students.find(s => s.id === studentId) || null;
    setForm(f => ({
      ...f,
      student_id: String(studentId),
      amount: '',
      notes: '',
    }));
    setSelectedStudentForPayment(student);
    setPaymentSelectionMode('actions');
    setShowStudentDropdown(false);
    setStudentSearchQuery('');
    setSelectedGradeFilter('all');
    setError('');
  };

  const resetPaymentSelection = () => {
    setSelectedStudentForPayment(null);
    setPaymentSelectionMode('search');
    setStudentSearchQuery('');
    setShowStudentDropdown(false);
    setError('');
    setForm(f => ({
      ...f,
      student_id: '',
      amount: '',
      notes: '',
    }));
  };

  const getPeriodLabel = (): string => {
    if (timePeriodFilter === 'week') return 'Last 7 Days';
    if (timePeriodFilter === 'month') return 'Last 30 Days';
    if (timePeriodFilter === 'term') return 'This Term';
    return 'All Time';
  };

  const handlePrintFiltered = async () => {
    const filtered = getFilteredPayments();
    const html = generatePaymentStatementHtml({
      schoolName,
      period: getPeriodLabel(),
      currencySymbol: getCurrencySymbol(),
      payments: filtered.map(p => ({
        date: new Date(p.payment_date).toLocaleDateString(),
        receiptNumber: p.receipt_number,
        studentName: p.student_name,
        period: `${p.term_label}, ${p.year_label}`,
        recordedBy: p.recorded_by_name || 'System',
        amount: (p.amount_paid_cents / 100).toFixed(2),
      })),
      total: (filtered.reduce((sum, p) => sum + p.amount_paid_cents, 0) / 100).toFixed(2),
    });
    await printDocument({
      html,
      filename: `payment_report_${getPeriodLabel().toLowerCase().replace(/\s+/g, '_')}`,
      title: `Payment Report - ${getPeriodLabel()}`,
    });
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 40px',
          gap: '16px',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
        }}
        className="text-display"
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid #e5e7eb',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ color: '#6b7280', fontSize: '14px' }}>Loading payments...</span>
      </div>
    );
  }

  if (!canRecordPayments) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to record payments.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '24px',
        alignItems: 'start',
      }}
    >
      <div className="flex-between" style={{ gap: '16px', alignItems: 'center', gridColumn: '1 / -1' }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">
          Payments
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Record Payment - First Row */}
        <div
          className="card no-print"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #f97316 100%)',
            color: 'white',
          }}
        >
          <h3 className="mb-4" style={{ color: 'white' }}>
            Search Learner
          </h3>

          {paymentSelectionMode === 'search' ? (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Start typing learner name or ID..."
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
                  {getFilteredStudents().slice(0, 10).map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectStudent(s.id)}
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
                  {getFilteredStudents().length === 0 && (
                    <div
                      style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      No students found
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : selectedStudentForPayment ? (
            <form onSubmit={handleSubmit}>
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
                      Balance: {formatBalance(selectedStudentForPayment.balance)}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.8 }}>
                    {selectedStudentForPayment.grade_label}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetPaymentSelection}
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
                    if (onViewStatement) {
                      onViewStatement(selectedStudentForPayment.id);
                    } else {
                      void viewStatement(selectedStudentForPayment);
                    }
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
                  View Statement
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
                        {formatBalance(selectedStudentForPayment.balance)}
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
                        value={form.year_id}
                        onChange={e => setForm({ ...form, year_id: e.target.value })}
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
                        value={form.amount}
                        onChange={e => setForm({ ...form, amount: e.target.value })}
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
                            setForm({
                              ...form,
                              amount: (Math.abs(selectedStudentForPayment.balance) / 100).toFixed(2),
                            })
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
                          Pay Balance ({getCurrencySymbol()}
                          {Math.abs(selectedStudentForPayment.balance / 100).toFixed(2)})
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginTop: '12px',
                    }}
                  >
                    <PaymentMethodToggle
                      value={form.payment_method}
                      onChange={payment_method => setForm({ ...form, payment_method })}
                    />
                    <div>
                      <label
                        style={{
                          fontSize: '11px',
                          opacity: 0.8,
                          display: 'block',
                          marginBottom: '4px',
                        }}
                      >
                        NOTES
                      </label>
                      <input
                        type="text"
                        className="input-default"
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder="Optional notes..."
                        style={{ background: 'white', color: '#1f2937' }}
                      />
                    </div>
                  </div>

                  {error && (
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
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
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
                    disabled={saving || !form.amount}
                  >
                    {saving ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              )}
            </form>
          ) : null}
        </div>

        {/* RECENT ACTIVITY: Payment Activity Log */}
        <div className="card">
          <div className="flex-between mb-4">
            <h3 style={{ margin: 0 }}>Recent Activity</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-outline"
                onClick={handleExportActivityXlsx}
                disabled={exportingActivity}
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                <svg
                  width="16"
                  height="16"
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
                {exportingActivity ? 'Exporting Excel...' : 'Export Excel'}
              </button>
              <button
                className="btn btn-outline"
                onClick={handleOpenPrintModal}
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                <svg
                  width="16"
                  height="16"
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
                Print Recent Activity
              </button>
            </div>
          </div>

          {/* Filters for Activity - Buttons */}
          <div className="flex-row gap-2 mb-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>
              Time:
            </span>
            {[
              { value: 'all', label: 'All' },
              { value: 'week', label: 'Last Week' },
              { value: 'month', label: 'Last Month' },
              { value: 'term', label: 'This Term' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimePeriodFilter(option.value)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor:
                    timePeriodFilter === option.value ? 'var(--primary)' : 'var(--border)',
                  backgroundColor:
                    timePeriodFilter === option.value ? 'var(--primary)' : 'transparent',
                  color: timePeriodFilter === option.value ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {option.label}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search receipt, learner, or user..."
              value={activitySearchQuery}
              onChange={e => {
                const nextQuery = e.target.value;
                setActivitySearchQuery(nextQuery);
                loadActivityLogs(1, nextQuery);
              }}
              style={{
                marginLeft: 'auto',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '12px',
                width: '220px',
              }}
            />
          </div>

          <table>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px',
                    borderBottom: '2px solid var(--border)',
                    fontSize: '12px',
                  }}
                >
                  Date & Time
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px',
                    borderBottom: '2px solid var(--border)',
                    fontSize: '12px',
                  }}
                >
                  Receipt Number
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px',
                    borderBottom: '2px solid var(--border)',
                    fontSize: '12px',
                  }}
                >
                  User
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px',
                    borderBottom: '2px solid var(--border)',
                    fontSize: '12px',
                  }}
                >
                  Action
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '10px',
                    borderBottom: '2px solid var(--border)',
                    fontSize: '12px',
                  }}
                >
                  Amount
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px',
                    borderBottom: '2px solid var(--border)',
                    fontSize: '12px',
                  }}
                >
                  Learner Full Name
                </th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.map(log => {
                const isVoided = log.action === 'payment_voided';
                const amount = log.amount_paid_cents || 0;
                const displayAmount = isVoided
                  ? `-${getCurrencySymbol()}${(amount / 100).toFixed(2)}`
                  : `+${getCurrencySymbol()}${(amount / 100).toFixed(2)}`;
                const isSelected = selectedReceipt?.id === log.entity_id;
                return (
                  <tr
                    key={log.id}
                    onClick={() => handleViewReceiptFromActivity(log)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e =>
                      !isSelected && (e.currentTarget.style.backgroundColor = 'var(--secondary)')
                    }
                    onMouseLeave={e =>
                      !isSelected &&
                      (e.currentTarget.style.backgroundColor = isSelected
                        ? 'rgba(249, 115, 22, 0.08)'
                        : 'transparent')
                    }
                  >
                    <td
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {new Date(log.logged_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--primary)',
                      }}
                    >
                      {log.receipt_number || '-'}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      {log.username || 'System'}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '12px',
                      }}
                    >
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            log.action === 'payment_recorded' ? '#D1FAE5' : '#FEE2E2',
                          color: log.action === 'payment_recorded' ? '#065F46' : '#991B1B',
                        }}
                      >
                        {log.action === 'payment_recorded' ? 'Recorded' : 'Voided'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '12px',
                        fontWeight: 600,
                        textAlign: 'right',
                        color: isVoided ? '#dc2626' : '#16a34a',
                      }}
                    >
                      {displayAmount}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {log.student_name || '-'}
                    </td>
                  </tr>
                );
              })}
              {activityLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}
                  >
                    No payment activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Side: Receipt Preview */}
      <div>
        {viewMode === 'overview' && (
          <SchoolPaymentsOverview
            stats={stats}
            schoolName={schoolName}
            schoolLogo={schoolLogo}
            schoolContact={schoolContact}
            currentTerm={currentTermLabel}
          />
        )}
        {viewMode === 'receipt' && selectedReceipt && (
          <>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <button
                className="btn btn-primary"
                onClick={async () => {
                  // Load ALL payment history for this student (including after this receipt)
                  const history = await db.all(
                    `SELECT p.receipt_number, t.label as term_label, p.amount_paid_cents, p.payment_date, p.is_voided
                     FROM payments p
                     LEFT JOIN terms t ON p.term_id = t.id
                     WHERE p.student_id = ? AND p.year_id = ?
                     ORDER BY p.payment_date ASC`,
                    [selectedReceipt.student_id, selectedReceipt.year_id]
                  );

                  const runningTotal = await db.get(
                    `SELECT COALESCE(SUM(amount_paid_cents), 0) as total
                     FROM payments
                     WHERE student_id = ? AND year_id = ? AND is_voided = 0`,
                    [selectedReceipt.student_id, selectedReceipt.year_id]
                  );

                  const currentAmountDue = await db.get(
                    `SELECT COALESCE(SUM(sf.amount_cents), 0) as total
                     FROM student_fees sf
                     JOIN fee_structure fs ON sf.fee_structure_id = fs.id
                     WHERE sf.student_id = ? AND fs.year_id = ?`,
                    [selectedReceipt.student_id, selectedReceipt.year_id]
                  );

                  const totalPaid = runningTotal?.total || 0;
                  const totalInvoiced = currentAmountDue?.total || 0;
                  const amountDue = Math.max(0, totalInvoiced - totalPaid);

                  const html = generateReceiptHtml({
                    schoolName,
                    receiptNumber: selectedReceipt.receipt_number,
                    date: new Date(selectedReceipt.payment_date).toLocaleDateString(),
                    time: new Date(selectedReceipt.payment_date).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    studentName: selectedReceipt.student_name,
                    period: `${selectedReceipt.term_label}, ${selectedReceipt.year_label}`,
                    amount: (selectedReceipt.amount_paid_cents / 100).toFixed(2),
                    currencySymbol: getCurrencySymbol(),
                    isVoided: selectedReceipt.is_voided === 1,
                    voidReason: selectedReceipt.void_reason,
                    runningTotal: (totalPaid / 100).toFixed(2),
                    currentAmountDue: (amountDue / 100).toFixed(2),
                    recordedBy: selectedReceipt.recorded_by_name || 'System',
                    paymentHistory: history.map((p: any) => ({
                      date: new Date(p.payment_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      }),
                      receiptNumber: p.receipt_number,
                      termLabel: p.term_label || '',
                      amount: (p.amount_paid_cents / 100).toFixed(2),
                      isVoided: p.is_voided === 1,
                    })),
                    currentReceiptNumber: selectedReceipt.receipt_number,
                  });
                  await printDocument({
                    html,
                    filename: `receipt_${selectedReceipt.receipt_number}`,
                    title: `Receipt ${selectedReceipt.receipt_number}`,
                  });
                }}
                style={{ flex: 1 }}
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
                Print Receipt
              </button>
              {selectedReceipt.amount_paid_cents > 0 && selectedReceipt.is_voided !== 1 && (
                <button
                  className="btn"
                  onClick={() => {
                    if (user?.role === 'admin') {
                      setVoidingPayment(selectedReceipt);
                      setShowVoidModal(true);
                    } else {
                      setShowVoidKeyModal(true);
                      setVoidKeyInput('');
                      setVoidKeyError('');
                    }
                  }}
                  style={{ flex: 1, background: '#dc2626', color: 'white' }}
                >
                  Void
                </button>
              )}
              <button className="btn btn-outline" onClick={handleCloseReceipt} style={{ flex: 1 }}>
                Close
              </button>
            </div>
            <PaymentReceiptPreview
              payment={selectedReceipt}
              onClose={handleCloseReceipt}
              onVoid={() => {
                setVoidingPayment(selectedReceipt);
                setShowVoidModal(true);
              }}
              canVoid={
                user?.role === 'admin' &&
                selectedReceipt.amount_paid_cents > 0 &&
                selectedReceipt.is_voided !== 1
              }
            />
          </>
        )}
      </div>

      {/* Void Payment Modal */}
      {showVoidModal && voidingPayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setShowVoidModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Void Payment</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Receipt: <strong>{voidingPayment.receipt_number}</strong>
              <br />
              Student: <strong>{voidingPayment.student_name}</strong>
              <br />
              Amount: <strong>{formatCurrency(voidingPayment.amount_paid_cents)}</strong>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <ChipSelector
                label="Reason *"
                value={voidReason || null}
                onChange={value => setVoidReason((value as string) || '')}
                options={[
                  { value: 'Mistake', label: 'Mistake' },
                  { value: 'Wrong learner', label: 'Wrong learner' },
                  { value: 'Wrong amount', label: 'Wrong amount' },
                  { value: 'Duplicate payment', label: 'Duplicate payment' },
                  { value: 'Customer request', label: 'Customer request' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
              >
                Comment (optional)
              </label>
              <textarea
                value={voidComment}
                onChange={e => setVoidComment(e.target.value)}
                className="input-default"
                style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                placeholder="Additional details..."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setShowVoidModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleVoidPayment}
                disabled={!voidReason}
                style={{ flex: 1, background: '#ef4444', color: 'white' }}
              >
                Void Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Key Modal */}
      {showVoidKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setShowVoidKeyModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '350px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Enter Void Key</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Enter the void key to authorize voiding this payment.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="password"
                value={voidKeyInput}
                onChange={e => {
                  setVoidKeyInput(e.target.value);
                  setVoidKeyError('');
                }}
                className="input-default"
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '18px',
                  letterSpacing: '4px',
                }}
                placeholder="••••"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (voidKeyInput === voidKey) {
                      setShowVoidKeyModal(false);
                      setVoidingPayment(selectedReceipt);
                      setShowVoidModal(true);
                    } else {
                      setVoidKeyError('Invalid void key');
                    }
                  }
                }}
              />
              {voidKeyError && (
                <p
                  style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}
                >
                  {voidKeyError}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setShowVoidKeyModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (voidKeyInput === voidKey) {
                    setShowVoidKeyModal(false);
                    setVoidingPayment(selectedReceipt);
                    setShowVoidModal(true);
                  } else {
                    setVoidKeyError('Invalid void key');
                  }
                }}
                style={{ flex: 1 }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Statement Modal */}
      {showPrintModal && (
        <div className="modal-overlay">
          <div
            className="modal-content"
            style={{ width: '1100px', maxHeight: '90vh', padding: '24px' }}
          >
            <div className="flex-between mb-4">
              <h2 style={{ margin: 0 }}>Print Payment Statement</h2>
              <button
                onClick={() => setShowPrintModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="flex-row gap-2 mb-4">
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>
                Period:
              </span>
              {[
                { value: 'all', label: 'All' },
                { value: 'last_week', label: 'Last Week' },
                { value: 'last_month', label: 'Last Month' },
                { value: 'this_term', label: 'This Term' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setPrintPeriodFilter(option.value);
                    setTimeout(loadPrintPreview, 0);
                  }}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor:
                      printPeriodFilter === option.value ? 'var(--primary)' : 'var(--border)',
                    backgroundColor:
                      printPeriodFilter === option.value ? 'var(--primary)' : 'transparent',
                    color: printPeriodFilter === option.value ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div
              id="print-statement-content"
              style={{
                backgroundColor: 'white',
                border: '1px solid #ccc',
                padding: '40px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '11px',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>PAYMENT STATEMENT</div>
                <div style={{ fontSize: '14px', marginTop: '4px' }}>{schoolName}</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  {printPeriodFilter === 'all'
                    ? 'All Time'
                    : printPeriodFilter === 'last_week'
                      ? 'Last Week'
                      : printPeriodFilter === 'last_month'
                        ? 'Last Month'
                        : 'This Term'}
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Receipt No.</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Learner</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Period</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Recorded By</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {printPreviewData.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px dashed #ccc' }}>
                      <td style={{ padding: '6px 8px' }}>
                        {new Date(p.payment_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{p.receipt_number}</td>
                      <td style={{ padding: '6px 8px' }}>{p.student_name}</td>
                      <td style={{ padding: '6px 8px' }}>
                        {p.term_label}, {p.year_label}
                      </td>
                      <td style={{ padding: '6px 8px' }}>{p.recorded_by_name || 'System'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        {getCurrencySymbol()}
                        {(p.amount_paid_cents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {printPreviewData.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ padding: '24px', textAlign: 'center', color: '#666' }}
                      >
                        No payments found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {printPreviewData.length > 0 && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px',
                    border: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>TOTAL</span>
                  <span style={{ fontWeight: 700 }}>
                    $
                    {(
                      printPreviewData.reduce((sum, p) => sum + p.amount_paid_cents, 0) / 100
                    ).toFixed(2)}
                  </span>
                </div>
              )}

              <div
                style={{
                  marginTop: '24px',
                  textAlign: 'center',
                  fontSize: '9px',
                  color: '#666',
                  borderTop: '1px dashed #333',
                  paddingTop: '12px',
                }}
              >
                Generated by SchoolFoundry - Jiggabyte Technology Limited
              </div>
            </div>

            <div className="flex-row gap-2 mt-4" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const html = generatePaymentStatementHtml({
                    schoolName,
                    period:
                      printPeriodFilter === 'all'
                        ? 'All Time'
                        : printPeriodFilter === 'last_week'
                          ? 'Last Week'
                          : printPeriodFilter === 'last_month'
                            ? 'Last Month'
                            : 'This Term',
                    currencySymbol: getCurrencySymbol(),
                    payments: printPreviewData.map(p => ({
                      date: new Date(p.payment_date).toLocaleDateString(),
                      receiptNumber: p.receipt_number,
                      studentName: p.student_name,
                      period: `${p.term_label}, ${p.year_label}`,
                      recordedBy: p.recorded_by_name || 'System',
                      amount: (p.amount_paid_cents / 100).toFixed(2),
                    })),
                    total: (
                      printPreviewData.reduce((sum, p) => sum + p.amount_paid_cents, 0) / 100
                    ).toFixed(2),
                  });
                  await printDocument({
                    html,
                    filename: `payment_statement_${printPeriodFilter}`,
                    title: 'Payment Statement',
                  });
                }}
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
                Print Statement
              </button>
            </div>
          </div>
        </div>
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
            Loading payment statement...
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
          onRetry={() => {
            const student = students.find(s => s.id === Number(form.student_id));
            if (student) viewStatement(student);
          }}
        />
      )}
    </div>
  );
};

export default PaymentManager;
