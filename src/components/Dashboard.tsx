import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import PaymentWizard from './PaymentWizard';
import SynthetixCard from './ui/SynthetixCard';

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
  termlyData: { term: string; collected: number; expected: number }[];
  fullyPaid: number;
  partiallyPaid: number;
  outstanding: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    gradeBreakdown: [],
    yearFees: 0,
    collected: 0,
    outstanding: 0,
    recentActivity: [],
    termlyData: [],
    fullyPaid: 0,
    partiallyPaid: 0,
    outstanding: 0,
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
        SELECT DISTINCT sye.student_id, sye.grade_id
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

      // Get all terms for this year
      const terms = await db.all(`
        SELECT id, label FROM terms WHERE year_id = ? ORDER BY term_number ASC
      `, [currentYear.id]);

      // Calculate termly data
      const termlyData = await Promise.all(
        terms.map(async (term) => {
          const termExpected = await db.get(`
            SELECT SUM(fs.amount_cents) as total
            FROM fee_structure fs
            WHERE fs.year_id = ? AND fs.term_id = ?
          `, [currentYear.id, term.id]);
          
          const termCollected = await db.get(`
            SELECT SUM(p.amount_paid_cents) as total
            FROM payments p
            WHERE p.year_id = ? AND p.term_id = ?
          `, [currentYear.id, term.id]);

          return {
            term: term.label,
            expected: termExpected?.total || 0,
            collected: termCollected?.total || 0
          };
        })
      );

      // Calculate payment status for each student
      const studentPaymentStatus = await db.all(`
        SELECT DISTINCT sye.student_id
        FROM student_year_enrollment sye
        WHERE sye.year_id = ?
      `, [currentYear.id]);

      let fullyPaid = 0;
      let partiallyPaid = 0;
      let outstanding = 0;

      for (const student of studentPaymentStatus) {
        const studentId = student.student_id;
        
        // Get expected fees for this student across all terms
        const studentGrade = await db.get(`
          SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?
        `, [studentId, currentYear.id]);

        if (!studentGrade) continue;

        const expectedFees = await db.get(`
          SELECT SUM(amount_cents) as total FROM fee_structure
          WHERE year_id = ? AND grade_id = ?
        `, [currentYear.id, studentGrade.grade_id]);

        const paidAmount = await db.get(`
          SELECT SUM(amount_paid_cents) as total FROM payments
          WHERE student_id = ? AND year_id = ?
        `, [studentId, currentYear.id]);

        const expected = expectedFees?.total || 0;
        const paid = paidAmount?.total || 0;

        if (paid >= expected && expected > 0) {
          fullyPaid++;
        } else if (paid > 0 && paid < expected) {
          partiallyPaid++;
        } else if (paid === 0) {
          outstanding++;
        }
      }

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
        recentActivity, 
        termlyData,
        fullyPaid,
        partiallyPaid,
        outstanding
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => (
    <span className="text-mono">
      ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
    </span>
  );

  const formatNumber = (num: number) => (
    <span className="text-mono">{num}</span>
  );

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }} className="text-display">Loading...</div>;

  const PercentageChart: React.FC<{ data: { term: string; collected: number; expected: number }[] }> = ({ data }) => {
    const intervals = [100, 80, 60, 40, 20, 0];
    return (
      <div style={{ display: 'flex', gap: '8px', height: '240px', alignItems: 'flex-end', padding: '20px 20px 40px 40px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '0', top: '20px', bottom: '40px', width: '35px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'right', paddingRight: '8px' }} className="text-mono">
          {intervals.map(v => <span key={v}>{v}%</span>)}
        </div>
        <div style={{ display: 'flex', gap: '8px', flex: 1, height: '100%', alignItems: 'flex-end' }}>
          {data.map((d, i) => {
            const percent = d.expected > 0 ? Math.min(100, (d.collected / d.expected) * 100) : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%' }}>
                <div style={{ width: '100%', flex: 1, backgroundColor: 'var(--secondary)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      width: '100%', 
                      height: `${percent}%`, 
                      backgroundColor: 'var(--primary)', 
                      borderRadius: '2px',
                      transition: 'height 0.3s ease'
                    }} 
                  />
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }} className="text-mono">{d.term}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content" style={{ background: 'var(--background)' }}>
      <div className="flex-between mb-4" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="metric-label" style={{ marginBottom: '4px' }}>Overview</div>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 600 }} className="text-display">Dashboard</h2>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setShowPaymentModal(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Record Payment
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '24px'
      }}>
        {/* Metric Cards */}
        <SynthetixCard>
          <div className="metric-label">Total Students</div>
          <div className="metric-value">{formatNumber(stats.totalStudents)}</div>
        </SynthetixCard>
        
        <SynthetixCard>
          <div className="metric-label">Year Fees</div>
          <div className="metric-value">{formatCurrency(stats.yearFees)}</div>
        </SynthetixCard>

        <SynthetixCard>
          <div className="metric-label">Collected</div>
          <div className="metric-value" style={{ color: '#10B981' }}>{formatCurrency(stats.collected)}</div>
        </SynthetixCard>

        <SynthetixCard>
          <div className="metric-label">Outstanding</div>
          <div className="metric-value" style={{ color: 'var(--primary)' }}>{formatCurrency(stats.outstanding)}</div>
        </SynthetixCard>

        {/* Payment Status Overview - Full Width */}
        <SynthetixCard style={{ gridColumn: 'span 4' }}>
          <div className="metric-label">Student Payment Status Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid #10B981', backgroundColor: '#ECFDF5', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '40px', height: '40px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%' }} />
                  <div style={{ color: '#065F46', fontSize: '11px', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }} className="text-display">FULLY PAID</div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#047857' }} className="text-mono">{formatNumber(stats.fullyPaid)}</div>
              </div>
              <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid #F59E0B', backgroundColor: '#FFFBEB', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '40px', height: '40px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%' }} />
                  <div style={{ color: '#92400E', fontSize: '11px', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }} className="text-display">PARTIALLY PAID</div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#B45309' }} className="text-mono">{formatNumber(stats.partiallyPaid)}</div>
              </div>
              <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid #EF4444', backgroundColor: '#FEF2F2', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '40px', height: '40px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%' }} />
                  <div style={{ color: '#991B1B', fontSize: '11px', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }} className="text-display">NO PAYMENT</div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#B91C1C' }} className="text-mono">{formatNumber(stats.outstanding)}</div>
              </div>
          </div>
        </SynthetixCard>

        {/* Progress and Distribution */}
        <SynthetixCard style={{ gridColumn: 'span 3' }}>
          <div className="metric-label">Collection Progress by Term (%)</div>
          <PercentageChart data={stats.termlyData} />
        </SynthetixCard>

        <SynthetixCard style={{ gridColumn: 'span 1' }}>
          <div className="metric-label">Grade Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stats.gradeBreakdown.map(g => (
              <div key={g.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }} className="text-display">{g.label}</span>
                <span style={{ fontWeight: 700 }} className="text-mono">{formatNumber(g.count)}</span>
              </div>
            ))}
            <div style={{ marginTop: 'auto', paddingTop: '20px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', fontSize: '20px' }}>
              <span className="text-display">Total</span>
              <span className="text-mono">{formatNumber(stats.totalStudents)}</span>
            </div>
          </div>
        </SynthetixCard>
      </div>

      {showPaymentModal && <PaymentWizard onClose={() => setShowPaymentModal(false)} onSuccess={() => { setShowPaymentModal(false); fetchDashboardData(); }} />}
    </div>
  );
};

export default Dashboard;

