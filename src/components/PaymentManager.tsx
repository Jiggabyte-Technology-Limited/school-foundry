import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

const PaymentManager = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setStudents(await db.all('SELECT * FROM students'));
  };

  const recordPayment = async () => {
    if (!selectedStudentId || !receiptNumber || !amount) return;

    const amountCents = Math.round(parseFloat(amount) * 100);

    await db.run(`
      INSERT INTO payments (student_id, year_id, term_id, receipt_number, amount_paid_cents) 
      VALUES (?, 1, 1, ?, ?)
    `, [selectedStudentId, receiptNumber, amountCents]);

    alert('Payment recorded!');
    setReceiptNumber('');
    setAmount('');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Record Payment</h1>
      <select onChange={(e) => setSelectedStudentId(e.target.value)} value={selectedStudentId}>
        <option value="">Select Student</option>
        {students.map((s: any) => (
          <option key={s.id} value={s.id}>{s.full_name}</option>
        ))}
      </select>
      <input placeholder="Receipt Number" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
      <input type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button onClick={recordPayment}>Save Payment</button>
    </div>
  );
};

export default PaymentManager;
