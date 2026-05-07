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
  monthlyData: { month: string; collected: number; expected: number }[];
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
      const currentYear = await db.get('SELECT id, label FROM academic_years ORDER BY label DESC LIMIT 1');
      if (!currentYear) {
        setLoading(false);
        return;
      }

      const gradeBreakdown = await db.all(`
        SELECT g.label, COUNT(sye.student_id) as count
        FROM grades g
        LEFT JOIN student_year_enrollment sye ON g.id = sye.grade_id AND sye.year_id = ?
        GROUP BY g.id, g.label
        ORDER BY g.id
      `, [currentYear.id]);

      const totalStudents = gradeBreakdown.reduce((sum: number, g: any) => sum + g.count, 0);

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

      const collectedResult = await db.get(`
        SELECT SUM(amount_paid_cents) as total
        FROM payments
        WHERE year_id = ?
      `, [currentYear.id]);
      const collected = collectedResult?.total || 0;

      const recentActivity = await db.all(`
        SELECT al.*, u.username
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.logged_at DESC
        LIMIT 10
      `);

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
          
          return { month, collected: monthCollected?.total || 0, expected: yearFees / 12 };
        })
      );

      setStats({ totalStudents, gradeBreakdown, yearFees, collected, outstanding: yearFees - collected, recentActivity, monthlyData });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (loading) return <div>Loading...</div>;

  const PercentageChart: React.FC<{ data: { month: string; collected: number; expected: number }[] }> = ({ data }) => {
    const intervals = [100, 80, 60, 40, 20, 0];
    return (
      <div style={{ display: 'flex', gap: '8px', height: '200px', alignItems: 'flex-end', padding: '20px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '10px', top: '20px', height: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: '#9CA3AF' }}>
          {intervals.map(v => <span key={v}>{v}%</span>)}
        </div>
        <div style={{ display: 'flex', gap: '8px', flex: 1, height: '160px', marginLeft: '30px', alignItems: 'flex-end' }}>
          {data.map((d, i) => {
            const percent = d.expected > 0 ? Math.min(100, (d.collected / d.expected) * 100) : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '100%', height: '160px', backgroundColor: '#F3F4F6', borderRadius: '4px', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${percent}%`, backgroundColor: '#3B82F6', borderRadius: '4px' }} />
                </div>
                <span style={{ fontSize: '10px' }}>{d.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }} onClick={() => setShowPaymentModal(true)}>Record Payment</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <div className="card"><h3>Students</h3><p style={{ fontSize: '24px', fontWeight: 700 }}>{stats.totalStudents}</p></div>
        <div className="card"><h3>Year Fees</h3><p style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(stats.yearFees)}</p></div>
        <div className="card"><h3>Collected</h3><p style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(stats.collected)}</p></div>
        <div className="card"><h3>Outstanding</h3><p style={{ fontSize: '24px', fontWeight: 700 }}>{formatCurrency(stats.outstanding)}</p></div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>Student Payment Status Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #10B981', backgroundColor: '#ECFDF5' }}>
                <div style={{ color: '#065F46', fontSize: '12px', fontWeight: 600 }}>Fully Paid</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857' }}>142</div>
            </div>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #F59E0B', backgroundColor: '#FFFBEB' }}>
                <div style={{ color: '#92400E', fontSize: '12px', fontWeight: 600 }}>Partially Paid</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#B45309' }}>28</div>
            </div>
            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid #EF4444', backgroundColor: '#FEF2F2' }}>
                <div style={{ color: '#991B1B', fontSize: '12px', fontWeight: 600 }}>Outstanding</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#B91C1C' }}>12</div>
            </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card">
          <h3>Collection Progress (%)</h3>
          <PercentageChart data={stats.monthlyData} />
        </div>
        <div className="card">
          <h3>Student Grade Distribution</h3>
          {stats.gradeBreakdown.map(g => (
            <div key={g.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>{g.label}</span>
              <span style={{ fontWeight: 600 }}>{g.count}</span>
            </div>
          ))}
          <div style={{ marginTop: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '8px', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
            <span>Total</span>
            <span>{stats.totalStudents}</span>
          </div>
        </div>
      </div>

      {showPaymentModal && <PaymentWizard onClose={() => setShowPaymentModal(false)} onSuccess={() => { setShowPaymentModal(false); fetchDashboardData(); }} />}
    </div>
  );
};

export default Dashboard;
