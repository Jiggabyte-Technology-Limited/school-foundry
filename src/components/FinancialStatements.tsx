import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

interface Student { id: number; full_name: string; grade_label: string; grade_id: number; balance: number; guardian_name: string; guardian_contact: string; }
interface Grade { id: number; label: string; }
interface AcademicYear { id: number; label: string; }
type StatementType = 'individual' | 'class';

const FinancialStatements: React.FC = () => {
  const [step, setStep] = useState(1);
  const [statementType, setStatementType] = useState<StatementType>('individual');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statementData, setStatementData] = useState<any>(null);
  const [schoolName, setSchoolName] = useState('School Management');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const [years, gradeList, school] = await Promise.all([
      db.all('SELECT id, label FROM academic_years ORDER BY label DESC'),
      db.all('SELECT id, label FROM grades ORDER BY id'),
      db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
    ]);
    setAcademicYears(years);
    setGrades(gradeList);
    setSchoolName(school?.value || 'School Management');
    if (years.length > 0) setSelectedYear(years[0].id);
  };

  const loadStudents = async (gradeId: number | null) => {
    if (!selectedYear) return;
    let query = `
      SELECT s.id, s.full_name, g.label as grade_label, g.id as grade_id, s.guardian_name, s.guardian_contact,
        COALESCE((SELECT SUM(amount_cents) FROM fee_structure fs JOIN terms t ON fs.term_id = t.id WHERE fs.year_id = ? AND fs.grade_id = sye.grade_id AND (t.start_date IS NULL OR t.start_date <= date('now'))), 0) -
        COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ?), 0) as balance
      FROM students s
      JOIN student_year_enrollment sye ON s.id = sye.student_id
      JOIN grades g ON sye.grade_id = g.id
      WHERE sye.year_id = ?`;
    const params: any[] = [selectedYear, selectedYear, selectedYear];
    
    if (gradeId) { 
        query += ' AND sye.grade_id = ?'; 
        params.push(gradeId); 
    }
    
    const result = await db.all(query + ' ORDER BY s.full_name', params);
    setStudents(result);
  };

  useEffect(() => { loadStudents(selectedGrade); }, [selectedYear, selectedGrade]);

  const generateReport = async () => {
    if (statementType === 'individual' && selectedStudent) {
        const student = students.find(s => s.id === selectedStudent);
        const [payments, fees] = await Promise.all([
            db.all('SELECT payment_date as date, receipt_number as ref, amount_paid_cents as amount, "Payment" as type FROM payments WHERE student_id = ? AND year_id = ? ORDER BY payment_date', [selectedStudent, selectedYear]),
            db.all('SELECT fs.description, fs.amount_cents as amount, "Fee" as type FROM fee_structure fs JOIN terms t ON fs.term_id = t.id WHERE fs.grade_id = ? AND fs.year_id = ? AND (t.start_date IS NULL OR t.start_date <= date('now'))', [student?.grade_id, selectedYear])
        ]);
        setStatementData({ type: 'individual', student, payments, fees, generatedAt: new Date().toLocaleDateString() });
    } else if (statementType === 'class') {
        setStatementData({ type: 'class', students, grade: grades.find(g => g.id === selectedGrade)?.label, generatedAt: new Date().toLocaleDateString() });
    }
    setStep(3);
  };

  const SelectButton = ({ label, selected, onClick }: any) => (
    <div onClick={onClick} style={{ 
      padding: '16px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: 600,
      border: selected ? '2px solid var(--color-accent)' : '1px solid #E5E7EB',
      backgroundColor: selected ? '#DBEAFE' : 'white'
    }}>{label}</div>
  );

  return (
    <div style={{ padding: '24px' }}>
      <div className="no-print">
        <h2 style={{ marginBottom: '24px' }}>Financial Statements Wizard</h2>
        <div className="card">
          {step === 1 && (
            <div>
              <h3>Step 1: Select Report Type</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <SelectButton label="Individual Student" selected={statementType === 'individual'} onClick={() => setStatementType('individual')} />
                <SelectButton label="Grade/Form Summary" selected={statementType === 'class'} onClick={() => setStatementType('class')} />
              </div>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Next</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3>Step 2: Filters</h3>
              <label>Grade/Form</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                 <SelectButton label="All Grades" selected={selectedGrade === null} onClick={() => setSelectedGrade(null)} />
                 {grades.map(g => <SelectButton key={g.id} label={g.label} selected={selectedGrade === g.id} onClick={() => setSelectedGrade(g.id)} />)}
              </div>

              {statementType === 'individual' && (
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #E5E7EB', padding: '10px' }}>
                  <input className="input-default mb-2" placeholder="Search by name or ID..." onChange={(e) => setSearchQuery(e.target.value)} />
                  {students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.id).includes(searchQuery)).length === 0 ? <p>No learners found.</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th>ID</th><th>Name</th><th>Grade/Form</th></tr></thead>
                      <tbody>
                        {students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.id).includes(searchQuery)).map(s => (
                          <tr key={s.id} onClick={() => setSelectedStudent(s.id)} style={{ cursor: 'pointer', backgroundColor: selectedStudent === s.id ? '#DBEAFE' : 'transparent' }}>
                            <td style={{ padding: '8px' }}>{s.id}</td><td style={{ padding: '8px' }}>{s.full_name}</td><td style={{ padding: '8px' }}>{s.grade_label}</td>
                            <td style={{ padding: '8px' }}><input type="radio" checked={selectedStudent === s.id} onChange={() => setSelectedStudent(s.id)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              <div className="flex-row gap-2 mt-4"><button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" onClick={generateReport} disabled={statementType === 'individual' && !selectedStudent}>Generate Preview</button></div>
            </div>
          )}
        </div>
      </div>

      {step === 3 && statementData && (
        <div className="card print-only" style={{ padding: '40px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <div style={{ width: 80, height: 80, border: '1px solid #eee', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Logo</div>
                <div style={{ textAlign: 'right' }}><h1>{schoolName}</h1><p>Generated: {statementData.generatedAt}</p></div>
            </div>
            
            {statementData.type === 'individual' ? (
                <div>
                    <h3>{statementData.student.full_name} (Grade: {statementData.student.grade_label})</h3>
                    <p><strong>Guardian:</strong> {statementData.student.guardian_name} | <strong>Phone:</strong> {statementData.student.guardian_contact}</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                        <thead><tr style={{ borderBottom: '2px solid #333' }}><th style={{ padding: '10px', textAlign: 'left' }}>Date</th><th style={{ padding: '10px', textAlign: 'left' }}>Description</th><th style={{ padding: '10px', textAlign: 'right' }}>Amount</th></tr></thead>
                        <tbody>
                            {[...statementData.fees, ...statementData.payments].map((item:any, i:any) => <tr key={i} style={{ borderBottom: '1px solid #ddd' }}><td style={{ padding: '10px' }}>{item.date || '-'}</td><td style={{ padding: '10px' }}>{item.description} {item.ref ? `(${item.ref})` : ''}</td><td style={{ padding: '10px', textAlign: 'right' }}>{item.type === 'Fee' ? '$' : '-$'}{(item.amount/100).toFixed(2)}</td></tr>)}
                        </tbody>
                    </table>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '2px solid #ddd' }}><th style={{ padding: '10px', textAlign: 'left' }}>Student</th><th style={{ padding: '10px', textAlign: 'right' }}>Balance</th><th style={{ padding: '10px' }}>Verdict</th></tr></thead>
                    <tbody>
                        {statementData.students.map((s:any, i:any) => <tr key={i}><td style={{ padding: '10px' }}>{s.full_name}</td><td style={{ padding: '10px', textAlign: 'right' }}>${(s.balance/100).toFixed(2)}</td><td style={{ padding: '10px' }}>{s.balance > 0 ? 'Owes' : 'Paid'}</td></tr>)}
                    </tbody>
                </table>
            )}
            <div className="no-print mt-4"><button className="btn btn-primary" onClick={() => window.print()}>Print</button> <button className="btn btn-outline ml-2" onClick={() => setStep(2)}>Back</button></div>
        </div>
      )}
    </div>
  );
};

export default FinancialStatements;
