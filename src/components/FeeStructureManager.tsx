import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

const FeeStructureManager = () => {
  const [years, setYears] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  
  const [yearLabel, setYearLabel] = useState('');
  const [gradeLabel, setGradeLabel] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setYears(await db.all('SELECT * FROM academic_years'));
    setGrades(await db.all('SELECT * FROM grades'));
    setFees(await db.all('SELECT f.*, y.label as year, g.label as grade FROM fee_structure f JOIN academic_years y ON f.year_id = y.id JOIN grades g ON f.grade_id = g.id'));
  };

  const addYear = async () => {
    await db.run('INSERT INTO academic_years (label) VALUES (?)', [yearLabel]);
    setYearLabel('');
    loadData();
  };

  const addGrade = async () => {
    await db.run('INSERT INTO grades (label) VALUES (?)', [gradeLabel]);
    setGradeLabel('');
    loadData();
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Fee Structure Management</h1>
      
      <div>
        <input placeholder="Year (e.g. 2026)" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} />
        <button onClick={addYear}>Add Year</button>
      </div>

      <div>
        <input placeholder="Grade (e.g. Grade 7)" value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} />
        <button onClick={addGrade}>Add Grade</button>
      </div>

      <h3>Current Fees</h3>
      <ul>
        {fees.map((f: any) => (
          <li key={f.id}>{f.year} - {f.grade} - {f.fee_type}: ${f.amount_cents / 100}</li>
        ))}
      </ul>
    </div>
  );
};

export default FeeStructureManager;
