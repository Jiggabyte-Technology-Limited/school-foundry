import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

const Dashboard = () => {
  const [stats, setStats] = useState<{ todayTotal: number, recentPayments: any[] }>({ todayTotal: 0, recentPayments: [] });

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0];
      const total = await db.get('SELECT SUM(amount_paid_cents) as total FROM payments WHERE date(payment_date) = ?', [today]);
      const recent = await db.all('SELECT p.*, s.full_name as studentName FROM payments p JOIN students s ON p.student_id = s.id ORDER BY p.payment_date DESC LIMIT 5');
      
      setStats({ 
        todayTotal: total.total || 0,
        recentPayments: recent 
      });
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1 className="mb-4">Dashboard</h1>
      <div className="flex-row gap-4 mb-4">
        <div className="card flex-1">
          <h3 className="mb-2">Today's Payments</h3>
          <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: 'var(--color-posthog-orange)' }}>
            ${(stats.todayTotal / 100).toFixed(2)}
          </p>
        </div>
        <div className="card-surface flex-1">
          <h3 className="mb-2">System Status</h3>
          <p>Database Connected</p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">Recent Activity</h3>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Amount</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentPayments.map((p: any) => (
              <tr key={p.id}>
                <td>{p.studentName}</td>
                <td className="td-amount">${(p.amount_paid_cents / 100).toFixed(2)}</td>
                <td>{p.receipt_number}</td>
              </tr>
            ))}
            {stats.recentPayments.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">No recent payments</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
