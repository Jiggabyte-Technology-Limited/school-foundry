import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

const StudentManager = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [guardian, setGuardian] = useState('');
  const [contact, setContact] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    const data = await db.all('SELECT * FROM students');
    setStudents(data);
  };

  const addStudent = async () => {
    await db.run('INSERT INTO students (full_name, guardian_name, guardian_contact) VALUES (?, ?, ?)', [name, guardian, contact]);
    loadStudents();
    setName('');
    setGuardian('');
    setContact('');
  };

  return (
    <div>
      <div className="flex-between mb-4">
        <h1 style={{ margin: 0 }}>Student Management</h1>
      </div>
      
      <div className="card mb-4" style={{ backgroundColor: 'var(--color-sage-cream)' }}>
        <h3 className="mb-2">Add New Student</h3>
        <div className="flex-row gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
          <input className="input-default flex-1" style={{ minWidth: '200px' }} placeholder="Student Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input-default flex-1" style={{ minWidth: '200px' }} placeholder="Guardian Name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
          <input className="input-default flex-1" style={{ minWidth: '200px' }} placeholder="Guardian Contact" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={addStudent}>Add Student</button>
      </div>
      
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Guardian</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id}>
                <td className="td-id">#{s.id}</td>
                <td className="td-bold">{s.full_name}</td>
                <td>{s.guardian_name}</td>
                <td>{s.guardian_contact}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">No students enrolled yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentManager;
