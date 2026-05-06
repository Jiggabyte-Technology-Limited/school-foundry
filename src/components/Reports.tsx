import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

const Reports = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [statement, setStatement] = useState<any[] | null>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setStudents(await db.all('SELECT * FROM students'));
  };

  const generateStatement = async () => {
    if (!selectedStudentId) return;
    
    // Fetch payments for the student
    const payments = await db.all('SELECT * FROM payments WHERE student_id = ?', [selectedStudentId]);
    setStatement(payments);
  };

  return (
    <div>
      <h1 className="mb-4">Reports</h1>
      
      <div className="card mb-4 card-surface">
        <h3 className="mb-2">Individual Statement</h3>
        <div className="flex-row gap-4">
          <select className="input-default" style={{ maxWidth: '300px' }} onChange={(e) => setSelectedStudentId(e.target.value)} value={selectedStudentId}>
            <option value="">Select Student</option>
            {students.map((s: any) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={generateStatement}>View Statement</button>
        </div>
      </div>

      {statement && (
        <div className="card">
          <h4 className="mb-4">Payments for Student</h4>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {statement.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.payment_date}</td>
                  <td className="td-amount">${(p.amount_paid_cents / 100).toFixed(2)}</td>
                  <td>{p.receipt_number}</td>
                </tr>
              ))}
              {statement.length === 0 && (
                <tr>
                  <td colSpan={3} className="table-empty">No payments found for this student.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports;
