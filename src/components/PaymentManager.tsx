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
    <div>
      <h1 className="mb-4">Record Payment</h1>
      <div className="card login-card" style={{ maxWidth: '600px' }}>
        <div className="flex-col gap-4 mb-4">
          <div>
            <label className="mb-1 td-bold" style={{ display: 'block' }}>Student</label>
            <select className="input-default" onChange={(e) => setSelectedStudentId(e.target.value)} value={selectedStudentId}>
              <option value="">Select Student</option>
              {students.map((s: any) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 td-bold" style={{ display: 'block' }}>Receipt Number</label>
            <input className="input-default" placeholder="Receipt Number" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 td-bold" style={{ display: 'block' }}>Amount ($)</label>
            <input className="input-default" type="number" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={recordPayment}>Save Payment</button>
      </div>
    </div>
  );
};

export default PaymentManager;
