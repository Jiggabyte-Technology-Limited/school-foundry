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
    <div style={{ padding: '2rem' }}>
      <h1>Student Management</h1>
      <input placeholder="Student Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Guardian Name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
      <input placeholder="Guardian Contact" value={contact} onChange={(e) => setContact(e.target.value)} />
      <button onClick={addStudent}>Add Student</button>
      
      <ul>
        {students.map((s: any) => (
          <li key={s.id}>{s.full_name} - {s.guardian_name}</li>
        ))}
      </ul>
    </div>
  );
};

export default StudentManager;
