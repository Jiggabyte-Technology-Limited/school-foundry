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
    <div style={{ padding: '2rem' }}>
      <h1>Reports</h1>
      
      <h3>Individual Statement</h3>
      <select onChange={(e) => setSelectedStudentId(e.target.value)} value={selectedStudentId}>
        <option value="">Select Student</option>
        {students.map((s: any) => (
          <option key={s.id} value={s.id}>{s.full_name}</option>
        ))}
      </select>
      <button onClick={generateStatement}>View Statement</button>

      {statement && (
        <div style={{ marginTop: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
          <h4>Payments for Student</h4>
          <ul>
            {statement.map((p: any) => (
              <li key={p.id}>
                Date: {p.payment_date} | Amount: ${p.amount_paid_cents / 100} | Receipt: {p.receipt_number}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Reports;
