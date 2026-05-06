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
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <h3>Today's Payments</h3>
          <p style={{ fontSize: '2rem' }}>${stats.todayTotal / 100}</p>
        </div>
      </div>

      <h3>Recent Activity</h3>
      <ul>
        {stats.recentPayments.map((p: any) => (
          <li key={p.id}>
            {p.studentName} paid ${p.amount_paid_cents / 100} (Receipt: {p.receipt_number})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
