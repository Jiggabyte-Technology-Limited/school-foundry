import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

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
  recentActivity: any[];
  monthlyData: { month: string; collected: number; outstanding: number }[];
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    gradeBreakdown: [],
    yearFees: 0,
    collected: 0,
    outstanding: 0,
    recentActivity: [],
    monthlyData: [],
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get current academic year
      const currentYear = await db.get('SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1');
      if (!currentYear) {
        setLoading(false);
        return;
      }

      // Get student counts by grade for current year
      const gradeBreakdown = await db.all(`
        SELECT g.label, COUNT(sye.student_id) as count
        FROM grades g
        LEFT JOIN student_year_enrollment sye ON g.id = sye.grade_id AND sye.year_id = ?
        GROUP BY g.id, g.label
        ORDER BY g.id
      `, [currentYear.id]);

      const totalStudents = gradeBreakdown.reduce((sum: number, g: any) => sum + g.count, 0);

      // Get total fees for current year (sum across all grades and terms)
      const enrolledStudents = await db.all(`
        SELECT sye.student_id, sye.grade_id
        FROM student_year_enrollment sye
        WHERE sye.year_id = ?
      `, [currentYear.id]);

      let yearFees = 0;
      for (const student of enrolledStudents) {
        const studentFees = await db.get(`
          SELECT SUM(amount_cents) as total
          FROM fee_structure
          WHERE year_id = ? AND grade_id = ?
        `, [currentYear.id, student.grade_id]);
        yearFees += studentFees?.total || 0;
      }

      // Get total collected this year
      const collectedResult = await db.get(`
        SELECT SUM(amount_paid_cents) as total
        FROM payments
        WHERE year_id = ?
      `, [currentYear.id]);
      const collected = collectedResult?.total || 0;

      // Recent activity
      const recentActivity = await db.all(`
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.timestamp DESC
        LIMIT 10
      `);

      // Monthly collection data for chart
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentYearLabel = currentYear.label;
      const monthlyData = await Promise.all(
        months.map(async (month, idx) => {
          const monthNum = String(idx + 1).padStart(2, '0');
          const startDate = `${currentYearLabel}-${monthNum}-01`;
          const endDate = idx === 11 
            ? `${parseInt(currentYearLabel) + 1}-01-01` 
            : `${currentYearLabel}-${String(idx + 2).padStart(2, '0')}-01`;
          
          const monthCollected = await db.get(`
            SELECT SUM(amount_paid_cents) as total
            FROM payments
            WHERE year_id = ? AND payment_date >= ? AND payment_date < ?
          `, [currentYear.id, startDate, endDate]);
          
          return {
            month,
            collected: monthCollected?.total || 0,
            outstanding: 0, // Will calculate based on expected vs collected
          };
        })
      );

      setStats({
        totalStudents,
        gradeBreakdown: gradeBreakdown.filter((g: any) => g.count > 0),
        yearFees,
        collected,
        outstanding: yearFees - collected,
        recentActivity,
        monthlyData,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Simple bar chart component
  const BarChart: React.FC<{ data: { month: string; collected: number }[]; maxValue: number }> = ({ data, maxValue }) => {
    const chartHeight = 160;
    return (
      <div className="chart-container">
        <div className="chart-bars">
          {data.map((d, i) => {
            const height = maxValue > 0 ? (d.collected / maxValue) * chartHeight : 0;
            return (
              <div key={i} className="chart-bar-wrapper">
                <div 
                  className="chart-bar" 
                  style={{ height: `${height}px` }}
                  title={`${d.month}: ${formatCurrency(d.collected)}`}
                />
                <span className="chart-label">{d.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Simple donut chart for grade distribution
  const DonutChart: React.FC<{ data: GradeCount[] }> = ({ data }) => {
    const total = data.reduce((sum, d) => sum + d.count, 0);
    if (total === 0) return <div className="chart-empty">No students enrolled</div>;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    let currentAngle = 0;

    const segments = data.map((d, i) => {
      const percentage = (d.count / total) * 100;
      const angle = (d.count / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      
      // Calculate path for segment
      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (startAngle + angle - 90) * (Math.PI / 180);
      const largeArc = angle > 180 ? 1 : 0;
      
      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);
      
      return {
        ...d,
        color: colors[i % colors.length],
        percentage,
        path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });

    return (
      <div className="donut-chart-container">
        <svg viewBox="0 0 100 100" className="donut-chart">
          {segments.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.color} />
          ))}
          <circle cx="50" cy="50" r="25" fill="var(--color-warm-parchment)" />
          <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700">
            {total}
          </text>
        </svg>
        <div className="chart-legend">
          {segments.map((seg, i) => (
            <div key={i} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: seg.color }} />
              <span className="legend-label">{seg.label}</span>
              <span className="legend-value">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const maxMonthlyCollected = Math.max(...stats.monthlyData.map(d => d.collected), 1);

  return (
    <div className="dashboard">
      {/* Metrics Row */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Students</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="metric-value">{stats.totalStudents}</div>
          <div className="metric-breakdown">
            {stats.gradeBreakdown.slice(0, 4).map((g, i) => (
              <span key={i} className="metric-breakdown-item">
                {g.label}: {g.count}
              </span>
            ))}
            {stats.gradeBreakdown.length > 4 && (
              <span className="metric-breakdown-more">+{stats.gradeBreakdown.length - 4} more</span>
            )}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Year&apos;s Fees</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="metric-value">{formatCurrency(stats.yearFees)}</div>
          <div className="metric-subtitle">Total expected fees</div>
        </div>

        <div className="metric-card metric-card-success">
          <div className="metric-header">
            <span className="metric-title">Collected</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="metric-value">{formatCurrency(stats.collected)}</div>
          <div className="metric-subtitle">
            {stats.yearFees > 0 ? `${Math.round((stats.collected / stats.yearFees) * 100)}% of total` : '0% of total'}
          </div>
        </div>

        <div className="metric-card metric-card-warning">
          <div className="metric-header">
            <span className="metric-title">Outstanding</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="metric-value">{formatCurrency(stats.outstanding)}</div>
          <div className="metric-subtitle">
            {stats.yearFees > 0 ? `${Math.round((stats.outstanding / stats.yearFees) * 100)}% remaining` : '0% remaining'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>Monthly Collections</h3>
          <BarChart data={stats.monthlyData} maxValue={maxMonthlyCollected} />
        </div>

        <div className="chart-card">
          <h3>Students by Grade</h3>
          <DonutChart data={stats.gradeBreakdown} />
        </div>
      </div>

      {/* Activity Section */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 style={{ margin: 0 }}>Recent Activity</h3>
          <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Record Payment
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentActivity.map((activity: any) => (
              <tr key={activity.id}>
                <td style={{ fontSize: '13px', color: 'var(--color-sage-placeholder)' }}>
                  {formatDate(activity.timestamp)}
                </td>
                <td className="td-bold">{activity.username || 'System'}</td>
                <td>
                  <span className="activity-action">{activity.action.replace(/_/g, ' ')}</span>
                </td>
                <td style={{ fontSize: '13px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activity.details}
                </td>
              </tr>
            ))}
            {stats.recentActivity.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">No recent activity</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal 
          onClose={() => setShowPaymentModal(false)} 
          onSuccess={() => {
            setShowPaymentModal(false);
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
};

// Quick Payment Modal Component
const PaymentModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
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
    const lastPayment = await db.get('SELECT receipt_number FROM payments ORDER BY id DESC LIMIT 1');
    const nextNum = lastPayment 
      ? String(parseInt(lastPayment.receipt_number.replace(/\D/g, '') || '0') + 1).padStart(6, '0')
      : '000001';
    setForm(f => ({ ...f, receipt_number: `RCP${nextNum}` }));
  };

  const loadTerms = async (yearId: number) => {
    const termList = await db.all('SELECT id, label FROM terms WHERE year_id = ? ORDER BY term_number', [yearId]);
    setTerms(termList);
    if (termList.length > 0) {
      setForm(f => ({ ...f, term_id: String(termList[0].id) }));
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
      
      await db.run(`
        INSERT INTO payments (student_id, year_id, term_id, receipt_number, amount_paid_cents)
        VALUES (?, ?, ?, ?, ?)
      `, [form.student_id, form.year_id, form.term_id, form.receipt_number, amountCents]);

      const student = students.find(s => s.id === Number(form.student_id));
      await db.run(`
        INSERT INTO activity_log (action, details)
        VALUES (?, ?)
      `, ['payment_recorded', `Payment of $${form.amount} recorded for ${student?.full_name} (${form.receipt_number})`]);

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Payment</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="error-message mb-2">{error}</div>}

          <div className="flex-col gap-4">
            <div>
              <label className="settings-label">Student *</label>
              <select
                className="input-default"
                value={form.student_id}
                onChange={e => setForm({ ...form, student_id: e.target.value })}
                required
              >
                <option value="">Select Student</option>
                {students.map(s => (
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
                  onChange={e => setForm({ ...form, year_id: e.target.value })}
                  required
                >
                  {years.map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="settings-label">Term *</label>
                <select
                  className="input-default"
                  value={form.term_id}
                  onChange={e => setForm({ ...form, term_id: e.target.value })}
                  required
                >
                  {terms.map(t => (
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
                  onChange={e => setForm({ ...form, amount: e.target.value })}
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
                  onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="flex-row gap-2" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sage" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
