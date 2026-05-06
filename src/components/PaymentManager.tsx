import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';

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
  const [years, setYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    todayTotal: 0,
    weekTotal: 0,
    monthTotal: 0,
    yearTotal: 0,
    todayCount: 0,
    weekCount: 0,
  });
  
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
    const [studentList, yearList] = await Promise.all([
      db.all('SELECT id, full_name FROM students WHERE is_active = 1 ORDER BY full_name'),
      db.all('SELECT id, label FROM academic_years ORDER BY label DESC'),
    ]);
    setStudents(studentList);
    setYears(yearList);
    
    if (yearList.length > 0) {
      setForm(f => ({ ...f, year_id: String(yearList[0].id) }));
    }
    
    // Generate receipt number
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
      LIMIT 20
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

      // Reset form and reload
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

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Payments</h2>
        <button className="btn btn-sage" onClick={handlePrint}>Print</button>
      </div>

      {/* Stats Cards */}
      <div className="payment-stats-row mb-4">
        <div className="payment-stat-card">
          <span className="stat-label">Today</span>
          <span className="stat-value">{formatCurrency(stats.todayTotal)}</span>
          <span className="stat-sub">{stats.todayCount} payment{stats.todayCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">This Week</span>
          <span className="stat-value">{formatCurrency(stats.weekTotal)}</span>
          <span className="stat-sub">{stats.weekCount} payment{stats.weekCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="payment-stat-card">
          <span className="stat-label">This Month</span>
          <span className="stat-value">{formatCurrency(stats.monthTotal)}</span>
        </div>
        <div className="payment-stat-card stat-highlight">
          <span className="stat-label">This Year</span>
          <span className="stat-value">{formatCurrency(stats.yearTotal)}</span>
        </div>
      </div>

      <div className="payment-layout">
        {/* Record Payment Form */}
        <div className="card no-print">
          <h3 className="mb-4">Record New Payment</h3>
          
          {error && <div className="error-message mb-4">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="flex-col gap-4">
              <div>
                <label className="settings-label">Student *</label>
                <select
                  className="input-default"
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                  required
                >
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-row gap-2">
                <div className="flex-1">
                  <label className="settings-label">Academic Year *</label>
                  <select
                    className="input-default"
                    value={form.year_id}
                    onChange={(e) => setForm({ ...form, year_id: e.target.value })}
                    required
                  >
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>{y.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="settings-label">Term *</label>
                  <select
                    className="input-default"
                    value={form.term_id}
                    onChange={(e) => setForm({ ...form, term_id: e.target.value })}
                    required
                  >
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-row gap-2">
                <div className="flex-1">
                  <label className="settings-label">Amount ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="input-default"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="settings-label">Receipt Number</label>
                  <input
                    type="text"
                    className="input-default"
                    value={form.receipt_number}
                    readOnly
                    style={{ backgroundColor: 'var(--color-light-sage)' }}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 24 }} disabled={saving}>
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </form>
        </div>

        {/* Recent Payments */}
        <div className="card">
          <h3 className="mb-4">Recent Payments</h3>
          <table>
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Student</th>
                <th>Term</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="td-id">{p.receipt_number}</td>
                  <td className="td-bold">{p.student_name}</td>
                  <td>{p.term_label}</td>
                  <td className="td-amount" style={{ color: '#16a34a' }}>{formatCurrency(p.amount_paid_cents)}</td>
                  <td style={{ fontSize: '13px', color: 'var(--color-sage-placeholder)' }}>
                    {formatDate(p.payment_date)}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">No payments recorded yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentManager;
