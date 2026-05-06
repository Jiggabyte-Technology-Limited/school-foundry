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
    <div>
      <h1 className="mb-4">Fee Structure Management</h1>
      
      <div className="flex-row gap-4 mb-4">
        <div className="card-surface flex-1">
          <h3 className="mb-2">Add Academic Year</h3>
          <div className="flex-row gap-2">
            <input className="input-default" placeholder="Year (e.g. 2026)" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} />
            <button className="btn btn-primary" onClick={addYear}>Add Year</button>
          </div>
        </div>

        <div className="card-surface flex-1">
          <h3 className="mb-2">Add Grade Level</h3>
          <div className="flex-row gap-2">
            <input className="input-default" placeholder="Grade (e.g. Grade 7)" value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} />
            <button className="btn btn-primary" onClick={addGrade}>Add Grade</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4">Current Fees</h3>
        <table>
          <thead>
            <tr>
              <th>Academic Year</th>
              <th>Grade</th>
              <th>Fee Type</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f: any) => (
              <tr key={f.id}>
                <td>{f.year}</td>
                <td>{f.grade}</td>
                <td>{f.fee_type}</td>
                <td className="td-amount">${(f.amount_cents / 100).toFixed(2)}</td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">No fee structures defined.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeeStructureManager;
