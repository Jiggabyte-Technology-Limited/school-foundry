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
  student_name: string;
  year_label: string;
  term_label: string;
}

interface PaymentStats {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  yearTotal: number;
  todayCount: number;
  weekCount: number;
}

const PaymentManager: React.FC = () => {
  const { user } = useAuth();
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
  });
  
  // Filters for activity table
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const [timePeriodFilter, setTimePeriodFilter] = useState('all');
  
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    loadPayments();
    loadStats();
  }, []);

  useEffect(() => {
    if (form.year_id) {
      loadTerms(Number(form.year_id));
    }
  }, [form.year_id]);

  const loadData = async () => {
    const [studentList, gradeList, yearList] = await Promise.all([
      db.all('SELECT s.id, s.full_name, g.label as grade_label, sye.grade_id FROM students s LEFT JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = (SELECT id FROM academic_years ORDER BY label DESC LIMIT 1) LEFT JOIN grades g ON sye.grade_id = g.id WHERE s.is_active = 1 ORDER BY s.full_name'),
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
    const paymentList = await db.all(`
      SELECT p.*, s.full_name as student_name, y.label as year_label, t.label as term_label
      FROM payments p
      JOIN students s ON p.student_id = s.id
      JOIN academic_years y ON p.year_id = y.id
      JOIN terms t ON p.term_id = t.id
      ORDER BY p.payment_date DESC
      LIMIT 100
    `);
    setPayments(paymentList);
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yearStart = `${new Date().getFullYear()}-01-01`;

    const [todayStats, weekStats, monthStats, yearStats] = await Promise.all([
      db.get(`SELECT SUM(amount_paid_cents) as total, COUNT(*) as count FROM payments WHERE date(payment_date) = ?`, [today]),
      db.get(`SELECT SUM(amount_paid_cents) as total, COUNT(*) as count FROM payments WHERE date(payment_date) >= ?`, [weekAgo]),
      db.get(`SELECT SUM(amount_paid_cents) as total FROM payments WHERE date(payment_date) >= ?`, [monthAgo]),
      db.get(`SELECT SUM(amount_paid_cents) as total FROM payments WHERE date(payment_date) >= ?`, [yearStart]),
    ]);

    setStats({
      todayTotal: todayStats?.total || 0,
      weekTotal: weekStats?.total || 0,
      monthTotal: monthStats?.total || 0,
      yearTotal: yearStats?.total || 0,
      todayCount: todayStats?.count || 0,
      weekCount: weekStats?.count || 0,
    });
  };

  const generateReceiptNumber = async () => {
    const lastPayment = await db.get('SELECT receipt_number FROM payments ORDER BY id DESC LIMIT 1');
    const nextNum = lastPayment 
      ? String(parseInt(lastPayment.receipt_number.replace(/\D/g, '') || '0') + 1).padStart(6, '0')
      : '000001';
    setForm(f => ({ ...f, receipt_number: `RCP${nextNum}` }));
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
      
      const result = await db.run(`
        INSERT INTO payments (student_id, year_id, term_id, receipt_number, amount_paid_cents)
        VALUES (?, ?, ?, ?, ?)
      `, [form.student_id, form.year_id, form.term_id, form.receipt_number, amountCents]);

      const student = students.find(s => s.id === Number(form.student_id));
      await db.run(
        'INSERT INTO activity_log (user_id, username, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [user?.id ?? null, user?.username ?? 'System', 'payment_recorded', 'payments', result.lastInsertRowid || result.lastID, `Payment of $${form.amount} recorded for ${student?.full_name} (${form.receipt_number})`]
      );

      setForm({ student_id: '', year_id: form.year_id, term_id: form.term_id, amount: '', receipt_number: '' });
      await generateReceiptNumber();
      loadPayments();
      loadStats();
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

  return (
    <div>
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Payments</h2>
      </div>

      <div className="payment-stats-row mb-4">
        <div className="payment-stat-card"><span className="stat-label">Today</span><span className="stat-value">{formatCurrency(stats.todayTotal)}</span></div>
        <div className="payment-stat-card"><span className="stat-label">This Week</span><span className="stat-value">{formatCurrency(stats.weekTotal)}</span></div>
        <div className="payment-stat-card"><span className="stat-label">This Month</span><span className="stat-value">{formatCurrency(stats.monthTotal)}</span></div>
        <div className="payment-stat-card stat-highlight"><span className="stat-label">This Year</span><span className="stat-value">{formatCurrency(stats.yearTotal)}</span></div>
      </div>

      {/* CORE FUNCTIONALITY: Record Payment - Centered at Top */}
      <div className="card no-print" style={{ marginBottom: 32 }}>
        <h3 className="mb-4">Record New Payment</h3>
        {error && <div className="error-message mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="flex-col gap-4">
            <div>
              <label className="settings-label">Student *</label>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Search student by name or ID..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    onFocus={() => setShowStudentDropdown(true)}
                    className="input-default"
                    style={{ flex: 1 }}
                  />
                  <select 
                    value={selectedGradeFilter} 
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    className="input-default"
                    style={{ minWidth: 150 }}
                  >
                    <option value="all">All Grades</option>
                    {grades.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </div>
                
                {showStudentDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: 'var(--border-radius-md)', marginTop: 4, maxHeight: 300, overflowY: 'auto', zIndex: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    {getFilteredStudents().length > 0 ? (
                      getFilteredStudents().map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectStudent(s.id)}
                          style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--secondary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {s.id} {s.grade_label ? `• ${s.grade_label}` : ''}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No students found</div>
                    )}
                  </div>
                )}
              </div>
              
              {form.student_id && (
                <div style={{ padding: '12px', backgroundColor: 'var(--secondary)', borderRadius: 'var(--border-radius-md)', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{students.find(s => s.id === Number(form.student_id))?.full_name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, student_id: '' });
                      setShowStudentDropdown(false);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px' }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="flex-row gap-2">
              <div className="flex-1"><label className="settings-label">Year *</label>
                <select className="input-default" value={form.year_id} onChange={(e) => setForm({ ...form, year_id: e.target.value })} required>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </div>
              <div className="flex-1"><label className="settings-label">Term *</label>
                <select className="input-default" value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })} required>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-row gap-2">
              <div className="flex-1"><label className="settings-label">Amount ($) *</label>
                <input type="number" step="0.01" min="0.01" className="input-default" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 24 }} disabled={saving || !form.student_id}>{saving ? '...' : 'Record Payment'}</button>
        </form>
      </div>

      {/* ACTIVITY TABLE: Recent Activity Below */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 style={{ margin: 0 }}>Recent Activity</h3>
        </div>
        
        {/* Filters for Activity */}
        <div className="flex-row gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>Filter by:</span>
            
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>Activity Type:</span>
              <select 
                value={activityTypeFilter} 
                onChange={(e) => setActivityTypeFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}
              >
                <option value="all">All</option>
                <option value="payments">Payments</option>
                <option value="recent">Recent Only</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>Time Period:</span>
              <select 
                value={timePeriodFilter} 
                onChange={(e) => setTimePeriodFilter(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border)' }}
              >
                <option value="all">All</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="term">This Term</option>
              </select>
            </div>
          </div>
        </div>

        <table>
          <thead><tr><th>Receipt</th><th>Student</th><th>Term</th><th>Date</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody>
            {getFilteredPayments().map((p) => (
              <tr key={p.id}>
                <td className="td-id">{p.receipt_number}</td>
                <td className="td-bold">{p.student_name}</td>
                <td>{p.term_label}</td>
                <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDate(p.payment_date)}</td>
                <td className="td-amount" style={{ color: '#16a34a' }}>{formatCurrency(p.amount_paid_cents)}</td>
                <td><button className="btn btn-sage" onClick={() => setSelectedReceipt(p)}>View</button></td>
              </tr>
            ))}
            {getFilteredPayments().length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No payments found for the selected filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedReceipt && <Receipt payment={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
};

export default PaymentManager;
