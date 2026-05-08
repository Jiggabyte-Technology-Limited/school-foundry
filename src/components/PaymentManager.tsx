import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import Receipt from './Receipt';

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

  const formatAction = (action: string) => action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div>
      {recentLogs.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No activity yet</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentLogs.map((log) => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
              backgroundColor: 'var(--color-sage-cream)', borderRadius: '8px', borderLeft: '3px solid var(--primary)'
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatAction(log.action)}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginLeft: '8px' }}>{log.details}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
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
      db.all(`
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
        LIMIT ? OFFSET ?
      `, [LOGS_PER_PAGE, offset]),
      db.get('SELECT COUNT(*) as count FROM activity_log')
    ]);
    setLogs(logData);
    setTotalCount(countData?.count || 0);
  };

  const totalPages = Math.ceil(totalCount / LOGS_PER_PAGE);

  const formatAction = (action: string) => action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const PaginationControls = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Showing {(page - 1) * LOGS_PER_PAGE + 1} - {Math.min(page * LOGS_PER_PAGE, totalCount)} of {totalCount}
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
        <span style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
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
            <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--border)', fontSize: '12px' }}>Date & Time</th>
            <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--border)', fontSize: '12px' }}>User</th>
            <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--border)', fontSize: '12px' }}>Action</th>
            <th style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid var(--border)', fontSize: '12px' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {formatDate(log.logged_at)}
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>
                {log.username || 'System'}
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                {formatAction(log.action)}
              </td>
              <td style={{ padding: '10px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {log.details || '-'}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
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

const PaymentManager: React.FC = () => {
  const { user, canRecordPayments, canVoidPayments } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
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

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [showFullLogs, setShowFullLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const LOGS_PER_PAGE = 50;

  // Student selection filters
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  
  const [form, setForm] = useState({
    student_id: '',
    year_id: '',
    term_id: '',
    amount: '',
    receipt_number: '',
    payment_method: 'cash',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidComment, setVoidComment] = useState('');

  useEffect(() => {
    loadData();
    loadPayments();
    loadStats();
  }, []);

  if (!canRecordPayments) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to record payments.</p>
      </div>
    );
  }

  useEffect(() => {
    if (form.year_id) {
      loadTerms(Number(form.year_id));
    }
  }, [form.year_id]);

  const loadData = async () => {
    const currentYear = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
    const [studentList, gradeList, yearList] = await Promise.all([
      db.all(`SELECT s.id, s.full_name, g.label as grade_label, sye.grade_id,
        COALESCE((SELECT SUM(amount_cents) FROM fee_structure fs JOIN terms t ON fs.term_id = t.id WHERE fs.year_id = ? AND fs.grade_id = sye.grade_id AND (t.start_date IS NULL OR t.start_date <= date('now'))), 0) -
        COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as balance
        FROM students s
        LEFT JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
        LEFT JOIN grades g ON sye.grade_id = g.id
        WHERE s.is_active = 1
        ORDER BY s.full_name`, [currentYear?.id, currentYear?.id, currentYear?.id]),
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

  const loadTerms = async (yearId: number) => {
    const termList = await db.all('SELECT id, label FROM terms WHERE year_id = ? ORDER BY term_number', [yearId]);
    setTerms(termList);
    if (termList.length > 0) {
      setForm(f => ({ ...f, term_id: String(termList[0].id) }));
    }
  };

  const loadPayments = async () => {
    try {
      const paymentList = await db.all(`
        SELECT p.*, s.full_name as student_name, s.guardian_name, s.guardian_contact, y.label as year_label, t.label as term_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        JOIN terms t ON p.term_id = t.id
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
        'UPDATE payments SET amount_paid_cents = 0, receipt_number = receipt_number || \'_VOID\', notes = ? WHERE id = ?',
        [`Voided: ${voidReason}${voidComment ? ' - ' + voidComment : ''}`, voidingPayment.id]
      );
      setShowVoidModal(false);
      setVoidingPayment(null);
      setVoidReason('');
      setVoidComment('');
      loadPayments();
      loadStats();
    } catch (err: any) {
      setError(err.message || 'Failed to void payment');
    }
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    // Get current term
    const currentTerm = await db.get(`SELECT id FROM terms WHERE year_id = (SELECT id FROM academic_years ORDER BY label DESC LIMIT 1) ORDER BY term_number LIMIT 1`);
    const currentYear = await db.get(`SELECT id FROM academic_years ORDER BY label DESC LIMIT 1`);

    const [todayStats, weekStats, monthStats, yearStats, termFees, termPayments, yearFees, yearPayments] = await Promise.all([
      db.get(`SELECT SUM(amount_paid_cents) as total, COUNT(*) as count FROM payments WHERE is_voided = 0 AND date(payment_date) = ?`, [today]),
      db.get(`SELECT SUM(amount_paid_cents) as total, COUNT(*) as count FROM payments WHERE is_voided = 0 AND date(payment_date) >= ?`, [weekAgo]),
      db.get(`SELECT SUM(amount_paid_cents) as total FROM payments WHERE is_voided = 0 AND date(payment_date) >= ?`, [monthAgo]),
      db.get(`SELECT SUM(amount_paid_cents) as total FROM payments WHERE is_voided = 0 AND date(payment_date) >= ?`, [yearStart]),
      // Expected fees for current term
      db.get(`SELECT COALESCE(SUM(fs.amount_cents), 0) as total FROM fee_structure fs WHERE fs.year_id = ? AND fs.term_id = ?`, [currentYear?.id || 0, currentTerm?.id || 0]),
      // Paid for current term
      db.get(`SELECT COALESCE(SUM(p.amount_paid_cents), 0) as total FROM payments p WHERE p.is_voided = 0 AND p.year_id = ? AND p.term_id = ?`, [currentYear?.id || 0, currentTerm?.id || 0]),
      // Expected fees for current year
      db.get(`SELECT COALESCE(SUM(fs.amount_cents), 0) as total FROM fee_structure fs WHERE fs.year_id = ?`, [currentYear?.id || 0]),
      // Paid for current year
      db.get(`SELECT COALESCE(SUM(p.amount_paid_cents), 0) as total FROM payments p WHERE p.is_voided = 0 AND p.year_id = ?`, [currentYear?.id || 0]),
    ]);

    const expectedTermTotal = termFees?.total || 0;
    const paidTermTotal = termPayments?.total || 0;
    const expectedYearTotal = yearFees?.total || 0;
    const paidYearTotal = yearPayments?.total || 0;
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

  const loadActivityLogs = async (page = 1) => {
    try {
      const offset = (page - 1) * LOGS_PER_PAGE;
      const logs = await db.all(`
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
        LIMIT ? OFFSET ?
      `, [LOGS_PER_PAGE, offset]);
      setActivityLogs(logs);
      setLogPage(page);
    } catch (err) {
      console.error('Error loading activity logs:', err);
    }
  };

  const getTotalLogCount = async () => {
    const result = await db.get('SELECT COUNT(*) as count FROM activity_log');
    return result?.count || 0;
  };

  const generateReceiptNumber = async () => {
    // Use timestamp + random to guarantee uniqueness
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const receiptNumber = `RCP${timestamp}${random}`;

    // Verify it doesn't exist, if so, try again
    const existing = await db.get('SELECT id FROM payments WHERE receipt_number = ?', [receiptNumber]);
    if (existing) {
      // If somehow exists, add more randomness
      const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      setForm(f => ({ ...f, receipt_number: `RCP${timestamp}${newRandom}` }));
    } else {
      setForm(f => ({ ...f, receipt_number: receiptNumber }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!form.student_id || !form.year_id || !form.term_id || !form.amount) {
      setError('Please fill in all required fields');
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
        throw new Error('Student is not enrolled for the selected academic year');
      }

      const result = await db.run(`
        INSERT INTO payments (student_id, year_id, term_id, grade_id, receipt_number, amount_paid_cents, payment_date, payment_method, notes, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?)
      `, [form.student_id, form.year_id, form.term_id, enrollment.grade_id, form.receipt_number, amountCents, form.payment_method || 'cash', form.notes || '', user?.id ?? 1]);

      const student = students.find(s => s.id === Number(form.student_id));
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'payment_recorded', 'payments', result.lastInsertRowid || result.lastID, `Payment of $${form.amount} recorded for ${student?.full_name} (${form.receipt_number})`]
      );

      // Fetch the newly created payment to show receipt
      const newPayment = await db.get(`
        SELECT p.*, s.full_name as student_name, s.guardian_name, s.guardian_contact, y.label as year_label, t.label as term_label, u.username as recorded_by_name
        FROM payments p
        JOIN students s ON p.student_id = s.id
        JOIN academic_years y ON p.year_id = y.id
        JOIN terms t ON p.term_id = t.id
        LEFT JOIN users u ON p.recorded_by = u.id
        WHERE p.id = ?
      `, [result.lastInsertRowid || result.lastID]);

      if (newPayment) {
        setSelectedReceipt(newPayment);
      }

      setForm({ student_id: '', year_id: form.year_id, term_id: form.term_id, amount: '', receipt_number: '', payment_method: 'cash', notes: '' });
      await generateReceiptNumber();

      // Small delay to ensure DB commits
      await new Promise(resolve => setTimeout(resolve, 100));
      loadPayments();
      loadStats();
      loadData(); // Reload students with updated balances
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
      const currentTermStart = new Date(now.getFullYear(), now.getMonth() - (now.getMonth() % 4), 1);
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
      filtered = filtered.filter(s => 
        s.full_name.toLowerCase().includes(query) || 
        s.id.toString().includes(query)
      );
    }

    return filtered;
  };

  const handleSelectStudent = (studentId: number) => {
    setForm({ ...form, student_id: String(studentId) });
    setShowStudentDropdown(false);
    setStudentSearchQuery('');
    setSelectedGradeFilter('all');
  };

  const getPeriodLabel = (): string => {
    if (timePeriodFilter === 'week') return 'Last 7 Days';
    if (timePeriodFilter === 'month') return 'Last 30 Days';
    if (timePeriodFilter === 'term') return 'This Term';
    return 'All Time';
  };

  const handlePrintFiltered = () => {
    const filtered = getFilteredPayments();
    const schoolName = users.length > 0 ? 'School Name' : 'School System';
    
    const printWindow = window.open('', '', 'height=800,width=1000');
    if (!printWindow) return;

    const tableRows = filtered.map(p => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${p.receipt_number}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${p.student_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${p.term_label}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${new Date(p.payment_date).toLocaleDateString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$${(p.amount_paid_cents / 100).toFixed(2)}</td>
      </tr>
    `).join('');

    const totalAmount = filtered.reduce((sum, p) => sum + p.amount_paid_cents, 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .report-info { margin-bottom: 20px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #f0f0f0; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #333; }
          td { padding: 10px; }
          .total-row { background-color: #f9f9f9; font-weight: 600; border-top: 2px solid #333; }
          .total-row td { padding: 12px; }
        </style>
      </head>
      <body>
        <h1>${schoolName}</h1>
        <div class="report-info">
          <p><strong>Payment Report - ${getPeriodLabel()}</strong></p>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>Total Records: ${filtered.length}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Student</th>
              <th>Term</th>
              <th>Date</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row">
              <td colspan="4" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">$${(totalAmount / 100).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div>
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Payments</h2>
      </div>

      {/* Record Payment - First Row */}
      <div className="card no-print" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--primary) 0%, #f97316 100%)', color: 'white' }}>
        <h3 className="mb-4" style={{ color: 'white' }}>Record Payment</h3>
        
        {!form.student_id ? (
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Start typing student name or ID..."
              value={studentSearchQuery}
              onChange={(e) => { setStudentSearchQuery(e.target.value); setShowStudentDropdown(true); }}
              onFocus={() => setShowStudentDropdown(true)}
              className="input-default"
              style={{ 
                padding: '16px 20px', 
                fontSize: '16px', 
                borderRadius: '12px',
                border: '3px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                color: '#1f2937'
              }}
            />
            {showStudentDropdown && studentSearchQuery.length > 0 && (
              <div style={{ 
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
                color: 'var(--text-primary)'
              }}>
                {getFilteredStudents().slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectStudent(s.id)}
                    style={{ 
                      padding: '12px 16px', 
                      borderBottom: '1px solid var(--border)', 
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--secondary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {s.id} - {s.grade_label}</div>
                    </div>
                  </div>
                ))}
                {getFilteredStudents().length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No students found
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ 
              background: 'rgba(255,255,255,0.15)', 
              borderRadius: '12px', 
              padding: '20px',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>Recording payment for</div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{students.find(s => s.id === Number(form.student_id))?.full_name}</div>
                  <div style={{ fontSize: '13px', opacity: 0.8 }}>{students.find(s => s.id === Number(form.student_id))?.grade_label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, student_id: '' });
                    setStudentSearchQuery('');
                    setShowStudentDropdown(false);
                  }}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    border: 'none', 
                    color: 'white', 
                    cursor: 'pointer', 
                    fontSize: '14px',
                    padding: '8px 16px',
                    borderRadius: '8px'
                  }}
                >
                  Change Student
                </button>
              </div>

              {(() => {
                const selectedStudent = students.find(s => s.id === Number(form.student_id));
                if (!selectedStudent) return null;
                return (
                  <div style={{ 
                    background: 'rgba(255,255,255,0.95)', 
                    borderRadius: '8px', 
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: '#1f2937'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Balance</div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: selectedStudent.balance > 0 ? '#dc2626' : '#059669' }}>
                        ${(selectedStudent.balance / 100).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ 
                      padding: '6px 12px', 
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      backgroundColor: selectedStudent.balance > 0 ? '#FEE2E2' : '#D1FAE5',
                      color: selectedStudent.balance > 0 ? '#991B1B' : '#065F46'
                    }}>
                      {selectedStudent.balance > 0 ? 'Owing' : 'Paid'}
                    </div>
                  </div>
                );
              })()}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>YEAR</label>
                  <select
                    className="input-default"
                    value={form.year_id}
                    onChange={(e) => setForm({ ...form, year_id: e.target.value })}
                    style={{ background: 'white', color: '#1f2937', fontWeight: 600 }}
                  >
                    {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>TERM</label>
                  <select
                    className="input-default"
                    value={form.term_id}
                    onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                    style={{ background: 'white', color: '#1f2937', fontWeight: 600 }}
                  >
                    {terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>AMOUNT ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-default"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    autoFocus
                    style={{ background: 'white', color: '#1f2937', fontWeight: 700, fontSize: '16px', border: '2px solid #1f2937' }}
                  />
                  {(() => {
                    const selectedStudent = students.find(s => s.id === Number(form.student_id));
                    return selectedStudent && selectedStudent.balance > 0 ? (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, amount: (selectedStudent.balance / 100).toFixed(2) })}
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
                          width: '100%'
                        }}
                      >
                        Pay Balance (${(selectedStudent.balance / 100).toFixed(2)})
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>PAYMENT METHOD</label>
                  <select
                    className="input-default"
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    style={{ background: 'white', color: '#1f2937', fontWeight: 600 }}
                  >
                    <option value="cash">Cash</option>
                    <option value="ecocash">EcoCash / Mobile</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', opacity: 0.8, display: 'block', marginBottom: '4px' }}>NOTES</label>
                  <input
                    type="text"
                    className="input-default"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional notes..."
                    style={{ background: 'white', color: '#1f2937' }}
                  />
                </div>
              </div>
              
              {error && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  backgroundColor: '#FEE2E2', 
                  border: '1px solid #FCA5A5', 
                  borderRadius: '8px',
                  color: '#991B1B',
                  fontSize: '14px'
                }}>
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
                  padding: '14px'
                }} 
                disabled={saving || !form.amount}
              >
                {saving ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Stats Row: Today, This Week, This Month */}
      <div className="payment-stats-row mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div className="payment-stat-card"><span className="stat-label">Today</span><span className="stat-value">{formatCurrency(stats.todayTotal)}</span></div>
        <div className="payment-stat-card"><span className="stat-label">This Week</span><span className="stat-value">{formatCurrency(stats.weekTotal)}</span></div>
        <div className="payment-stat-card"><span className="stat-label">This Month</span><span className="stat-value">{formatCurrency(stats.monthTotal)}</span></div>
      </div>

      {/* Second Row: Current Term + Outstanding + Year + Outstanding */}
      <div className="payment-stats-row mb-4">
        <div className="payment-stat-card stat-highlight">
          <span className="stat-label">Current Term Received</span>
          <span className="stat-value">{formatCurrency(stats.paidTermTotal)}</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px', display: 'block' }}>
            Expected: {formatCurrency(stats.expectedTermTotal)}
          </span>
        </div>
        
        <div className="payment-stat-card">
          <span className="stat-label">Outstanding This Term</span>
          <span className="stat-value" style={{ color: stats.outstandingTerm > 0 ? '#ef4444' : '#16a34a' }}>
            {formatCurrency(stats.outstandingTerm)}
          </span>
        </div>
        
        <div className="payment-stat-card stat-highlight">
          <span className="stat-label">Year Received</span>
          <span className="stat-value">{formatCurrency(stats.paidYearTotal)}</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px', display: 'block' }}>
            Expected: {formatCurrency(stats.expectedYearTotal)}
          </span>
        </div>
        
        <div className="payment-stat-card">
          <span className="stat-label">Outstanding This Year</span>
          <span className="stat-value" style={{ color: stats.outstandingYear > 0 ? '#ef4444' : '#16a34a' }}>
            {formatCurrency(stats.outstandingYear)}
          </span>
        </div>
      </div>

      {/* ACTIVITY TABLE: Recent Activity Below */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 style={{ margin: 0 }}>Recent Activity</h3>
          <button 
            className="btn btn-sage" 
            onClick={() => handlePrintFiltered()}
            style={{ marginRight: 0 }}
          >
            Print Filtered Report
          </button>
        </div>
        
        {/* Filters for Activity - Buttons */}
        <div className="flex-row gap-2 mb-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>Time:</span>
          {[
            { value: 'all', label: 'All' },
            { value: 'week', label: 'Last Week' },
            { value: 'month', label: 'Last Month' },
            { value: 'term', label: 'This Term' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimePeriodFilter(option.value)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                borderRadius: '20px',
                border: '1px solid',
                borderColor: timePeriodFilter === option.value ? 'var(--primary)' : 'var(--border)',
                backgroundColor: timePeriodFilter === option.value ? 'var(--primary)' : 'transparent',
                color: timePeriodFilter === option.value ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <table>
          <thead><tr><th>Receipt</th><th>Student</th><th>Term</th><th>Date</th><th>Amount</th><th>Recorded By</th><th>Actions</th></tr></thead>
          <tbody>
            {getFilteredPayments().map((p) => (
              <tr key={p.id}>
                <td className="td-id">{p.receipt_number}</td>
                <td className="td-bold">{p.student_name}</td>
                <td>{p.term_label}</td>
                <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDate(p.payment_date)}</td>
                <td className="td-amount" style={{ color: '#16a34a' }}>{formatCurrency(p.amount_paid_cents)}</td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.recorded_by_name || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-sage" onClick={() => setSelectedReceipt(p)}>View</button>
                    {user?.role === 'admin' && p.amount_paid_cents > 0 && (
                      <button 
                        className="btn" 
                        onClick={() => { setVoidingPayment(p); setShowVoidModal(true); }}
                        style={{ background: '#ef4444', color: 'white', padding: '6px 10px', fontSize: '11px' }}
                      >
                        Void
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {getFilteredPayments().length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No payments found for the selected filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ACTIVITY LOG SECTION */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 style={{ margin: 0 }}>Activity Log</h3>
          {!showFullLogs ? (
            <button
              className="btn btn-sage"
              onClick={() => { loadActivityLogs(1); setShowFullLogs(true); }}
            >
              View Full Logs
            </button>
          ) : (
            <button
              className="btn btn-outline"
              onClick={() => { setShowFullLogs(false); setLogPage(1); }}
            >
              Show Less
            </button>
          )}
        </div>

        {!showFullLogs ? (
          // Show last 10 activities
          <ActivityLogPreview />
        ) : (
          // Show paginated full logs
          <FullActivityLog />
        )}
      </div>

      {selectedReceipt && <Receipt payment={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}

      {/* Void Payment Modal */}
      {showVoidModal && voidingPayment && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }} onClick={() => setShowVoidModal(false)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Void Payment</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
              Receipt: <strong>{voidingPayment.receipt_number}</strong><br/>
              Student: <strong>{voidingPayment.student_name}</strong><br/>
              Amount: <strong>{formatCurrency(voidingPayment.amount_paid_cents)}</strong>
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Reason *</label>
              <select 
                value={voidReason} 
                onChange={(e) => setVoidReason(e.target.value)}
                className="input-default"
                style={{ width: '100%' }}
              >
                <option value="">Select a reason...</option>
                <option value="Mistake">Mistake</option>
                <option value="Wrong student">Wrong student</option>
                <option value="Wrong amount">Wrong amount</option>
                <option value="Duplicate payment">Duplicate payment</option>
                <option value="Customer request">Customer request</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Comment (optional)</label>
              <textarea 
                value={voidComment}
                onChange={(e) => setVoidComment(e.target.value)}
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
    </div>
  );
};

export default PaymentManager;
