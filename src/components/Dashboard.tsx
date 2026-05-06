import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import PaymentWizard from './PaymentWizard';

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
        ORDER BY al.logged_at DESC
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
        <div className="metric-card metric-card-info">
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

        <div className="metric-card metric-card-amber">
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
                  {formatDate(activity.logged_at)}
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

      {/* Payment Wizard */}
      {showPaymentModal && (
        <PaymentWizard 
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

export default Dashboard;
