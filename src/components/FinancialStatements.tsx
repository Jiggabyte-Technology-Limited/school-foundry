import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';

interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  grade_id: number;
}

interface Grade {
  id: number;
  label: string;
}

interface AcademicYear {
  id: number;
  label: string;
}

type StatementType = 'individual' | 'class' | 'grade' | 'school';
type PaymentStatus = 'all' | 'uptodate' | 'outstanding';
type OutstandingRange = '0-500' | '500-1000' | '1000+';

const FinancialStatements: React.FC = () => {
  const [statementType, setStatementType] = useState<StatementType>('individual');
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('all');
  const [outstandingRange, setOutstandingRange] = useState<OutstandingRange[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [statementData, setStatementData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear && selectedGrade) {
      loadStudents();
    }
  }, [selectedYear, selectedGrade]);

  const loadInitialData = async () => {
    const [years, gradeList, schoolSetting] = await Promise.all([
      db.all('SELECT id, label FROM academic_years ORDER BY label DESC'),
      db.all('SELECT id, label FROM grades ORDER BY id'),
      db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
    ]);
    
    setAcademicYears(years);
    setGrades(gradeList);
    setSchoolName(schoolSetting?.value || 'School Name');
    
    if (years.length > 0) {
      setSelectedYear(years[0].id);
    }
  };

  const loadStudents = async () => {
    if (!selectedYear) return;
    
    let query = `
      SELECT s.id, s.full_name, g.label as grade_label, g.id as grade_id
      FROM students s
      JOIN student_year_enrollment sye ON s.id = sye.student_id
      JOIN grades g ON sye.grade_id = g.id
      WHERE sye.year_id = ?
    `;
    const params: any[] = [selectedYear];
    
    if (selectedGrade) {
      query += ' AND sye.grade_id = ?';
      params.push(selectedGrade);
    }
    
    query += ' ORDER BY s.full_name';
    
    const result = await db.all(query, params);
    setStudents(result);
  };

  const calculateStudentBalance = async (studentId: number, yearId: number, fromDate?: string, toDate?: string) => {
    // Get total fees for student's grade
    const enrollment = await db.get(
      'SELECT grade_id FROM student_year_enrollment WHERE student_id = ? AND year_id = ?',
      [studentId, yearId]
    );
    
    if (!enrollment) return { fees: 0, paid: 0, balance: 0, transactions: [] };
    
    const fees = await db.get(
      'SELECT SUM(amount_cents) as total FROM fee_structure WHERE year_id = ? AND grade_id = ?',
      [yearId, enrollment.grade_id]
    );
    
    let paymentQuery = `
      SELECT amount_paid_cents as amount, payment_date as date, receipt_number, 'payment' as type
      FROM payments 
      WHERE student_id = ? AND year_id = ?
    `;
    const paymentParams: any[] = [studentId, yearId];
    
    if (fromDate) {
      paymentQuery += ' AND payment_date >= ?';
      paymentParams.push(fromDate);
    }
    if (toDate) {
      paymentQuery += ' AND payment_date <= ?';
      paymentParams.push(toDate);
    }
    
    paymentQuery += ' ORDER BY payment_date';
    
    const payments = await db.all(paymentQuery, paymentParams);
    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    
    return {
      fees: fees?.total || 0,
      paid: totalPaid,
      balance: (fees?.total || 0) - totalPaid,
      transactions: payments,
    };
  };

  const generateStatement = async () => {
    setLoading(true);
    setStatementData(null);
    
    try {
      if (statementType === 'individual' && selectedStudent) {
        const student = students.find(s => s.id === selectedStudent);
        const balance = await calculateStudentBalance(selectedStudent, selectedYear!, dateFrom, dateTo);
        
        setStatementData({
          type: 'individual',
          student,
          year: academicYears.find(y => y.id === selectedYear),
          ...balance,
          dateRange: { from: dateFrom, to: dateTo },
        });
      } else if (statementType === 'class' && selectedGrade) {
        const studentsInGrade = students.filter(s => s.grade_id === selectedGrade);
        const studentData = await Promise.all(
          studentsInGrade.map(async (s) => {
            const balance = await calculateStudentBalance(s.id, selectedYear!, dateFrom, dateTo);
            return { ...s, ...balance };
          })
        );
        
        // Apply payment status filter
        let filteredStudents = studentData;
        if (paymentStatus === 'uptodate') {
          filteredStudents = studentData.filter(s => s.balance <= 0);
        } else if (paymentStatus === 'outstanding') {
          filteredStudents = studentData.filter(s => s.balance > 0);
          
          // Apply outstanding range filter
          if (outstandingRange.length > 0) {
            filteredStudents = filteredStudents.filter(s => {
              const balanceDollars = s.balance / 100;
              return outstandingRange.some(range => {
                if (range === '0-500') return balanceDollars >= 0 && balanceDollars < 500;
                if (range === '500-1000') return balanceDollars >= 500 && balanceDollars < 1000;
                if (range === '1000+') return balanceDollars >= 1000;
                return false;
              });
            });
          }
        }
        
        setStatementData({
          type: 'class',
          grade: grades.find(g => g.id === selectedGrade),
          year: academicYears.find(y => y.id === selectedYear),
          students: filteredStudents,
          totals: {
            fees: filteredStudents.reduce((sum, s) => sum + s.fees, 0),
            paid: filteredStudents.reduce((sum, s) => sum + s.paid, 0),
            balance: filteredStudents.reduce((sum, s) => sum + s.balance, 0),
          },
          dateRange: { from: dateFrom, to: dateTo },
        });
      } else if (statementType === 'grade') {
        const gradeData = await Promise.all(
          grades.map(async (g) => {
            const studentsInGrade = await db.all(
              `SELECT s.id FROM students s 
               JOIN student_year_enrollment sye ON s.id = sye.student_id 
               WHERE sye.year_id = ? AND sye.grade_id = ?`,
              [selectedYear, g.id]
            );
            
            let totalFees = 0, totalPaid = 0;
            for (const s of studentsInGrade) {
              const balance = await calculateStudentBalance(s.id, selectedYear!, dateFrom, dateTo);
              totalFees += balance.fees;
              totalPaid += balance.paid;
            }
            
            return {
              ...g,
              studentCount: studentsInGrade.length,
              fees: totalFees,
              paid: totalPaid,
              balance: totalFees - totalPaid,
            };
          })
        );
        
        setStatementData({
          type: 'grade',
          year: academicYears.find(y => y.id === selectedYear),
          grades: gradeData.filter(g => g.studentCount > 0),
          totals: {
            students: gradeData.reduce((sum, g) => sum + g.studentCount, 0),
            fees: gradeData.reduce((sum, g) => sum + g.fees, 0),
            paid: gradeData.reduce((sum, g) => sum + g.paid, 0),
            balance: gradeData.reduce((sum, g) => sum + g.balance, 0),
          },
          dateRange: { from: dateFrom, to: dateTo },
        });
      } else if (statementType === 'school') {
        const allStudents = await db.all(
          `SELECT s.id, s.full_name, g.label as grade_label, g.id as grade_id
           FROM students s
           JOIN student_year_enrollment sye ON s.id = sye.student_id
           JOIN grades g ON sye.grade_id = g.id
           WHERE sye.year_id = ?`,
          [selectedYear]
        );
        
        let totalFees = 0, totalPaid = 0;
        const studentSummaries = await Promise.all(
          allStudents.map(async (s) => {
            const balance = await calculateStudentBalance(s.id, selectedYear!, dateFrom, dateTo);
            totalFees += balance.fees;
            totalPaid += balance.paid;
            return { ...s, ...balance };
          })
        );
        
        // Apply payment status filter
        let filteredStudents = studentSummaries;
        if (paymentStatus === 'uptodate') {
          filteredStudents = studentSummaries.filter(s => s.balance <= 0);
        } else if (paymentStatus === 'outstanding') {
          filteredStudents = studentSummaries.filter(s => s.balance > 0);
          
          if (outstandingRange.length > 0) {
            filteredStudents = filteredStudents.filter(s => {
              const balanceDollars = s.balance / 100;
              return outstandingRange.some(range => {
                if (range === '0-500') return balanceDollars >= 0 && balanceDollars < 500;
                if (range === '500-1000') return balanceDollars >= 500 && balanceDollars < 1000;
                if (range === '1000+') return balanceDollars >= 1000;
                return false;
              });
            });
          }
        }
        
        setStatementData({
          type: 'school',
          year: academicYears.find(y => y.id === selectedYear),
          students: filteredStudents,
          totals: {
            students: filteredStudents.length,
            fees: filteredStudents.reduce((sum, s) => sum + s.fees, 0),
            paid: filteredStudents.reduce((sum, s) => sum + s.paid, 0),
            balance: filteredStudents.reduce((sum, s) => sum + s.balance, 0),
          },
          dateRange: { from: dateFrom, to: dateTo },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleOutstandingRange = (range: OutstandingRange) => {
    setOutstandingRange(prev => 
      prev.includes(range) 
        ? prev.filter(r => r !== range)
        : [...prev, range]
    );
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div>
      <div className="flex-between mb-4 no-print">
        <h2 style={{ margin: 0 }}>Financial Statements</h2>
        {statementData && (
          <button className="btn btn-primary" onClick={handlePrint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print Statement
          </button>
        )}
      </div>

      {/* Statement Type Selector */}
      <div className="card mb-4 no-print">
        <div className="flex-row gap-2 mb-4">
          {(['individual', 'class', 'grade', 'school'] as StatementType[]).map((type) => (
            <button
              key={type}
              className={`btn ${statementType === type ? 'btn-primary' : 'btn-sage'}`}
              onClick={() => {
                setStatementType(type);
                setStatementData(null);
              }}
            >
              {type === 'individual' && 'Individual Student'}
              {type === 'class' && 'Class'}
              {type === 'grade' && 'Grade Summary'}
              {type === 'school' && 'Whole School'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex-row gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex-col" style={{ minWidth: 150 }}>
            <label className="settings-label">Academic Year</label>
            <select
              className="input-default"
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          </div>

          {(statementType === 'individual' || statementType === 'class') && (
            <div className="flex-col" style={{ minWidth: 150 }}>
              <label className="settings-label">Grade</label>
              <select
                className="input-default"
                value={selectedGrade || ''}
                onChange={(e) => {
                  setSelectedGrade(Number(e.target.value) || null);
                  setSelectedStudent(null);
                }}
              >
                <option value="">Select Grade</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
          )}

          {statementType === 'individual' && selectedGrade && (
            <div className="flex-col" style={{ minWidth: 200 }}>
              <label className="settings-label">Student</label>
              <select
                className="input-default"
                value={selectedStudent || ''}
                onChange={(e) => setSelectedStudent(Number(e.target.value) || null)}
              >
                <option value="">Select Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label">Date From</label>
            <input
              type="date"
              className="input-default"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="flex-col" style={{ minWidth: 140 }}>
            <label className="settings-label">Date To</label>
            <input
              type="date"
              className="input-default"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Payment Status Filter */}
        {(statementType === 'class' || statementType === 'school') && (
          <div className="flex-row gap-4 mb-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="flex-col" style={{ minWidth: 150 }}>
              <label className="settings-label">Payment Status</label>
              <select
                className="input-default"
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value as PaymentStatus);
                  if (e.target.value !== 'outstanding') setOutstandingRange([]);
                }}
              >
                <option value="all">All Students</option>
                <option value="uptodate">Up to Date</option>
                <option value="outstanding">Outstanding Balance</option>
              </select>
            </div>

            {paymentStatus === 'outstanding' && (
              <div className="flex-col">
                <label className="settings-label">Outstanding Amount Range</label>
                <div className="flex-row gap-2">
                  {(['0-500', '500-1000', '1000+'] as OutstandingRange[]).map((range) => (
                    <label key={range} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={outstandingRange.includes(range)}
                        onChange={() => toggleOutstandingRange(range)}
                      />
                      {range === '0-500' && '$0-$500'}
                      {range === '500-1000' && '$500-$1,000'}
                      {range === '1000+' && '$1,000+'}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={generateStatement}
          disabled={loading || !selectedYear || (statementType === 'individual' && !selectedStudent) || (statementType === 'class' && !selectedGrade)}
        >
          {loading ? 'Generating...' : 'Generate Statement'}
        </button>
      </div>

      {/* Statement Preview */}
      {statementData && (
        <div className="card statement-preview">
          <div className="statement-header">
            <h2 className="statement-school-name">{schoolName}</h2>
            <h3 className="statement-title">FINANCIAL STATEMENT</h3>
            <p className="statement-meta">
              Academic Year: {statementData.year?.label}
              {statementData.dateRange?.from && statementData.dateRange?.to && (
                <> | Period: {formatDate(statementData.dateRange.from)} - {formatDate(statementData.dateRange.to)}</>
              )}
            </p>
          </div>

          {/* Individual Statement */}
          {statementData.type === 'individual' && (
            <div className="statement-body">
              <div className="statement-info">
                <p><strong>Student:</strong> {statementData.student?.full_name}</p>
                <p><strong>Grade:</strong> {statementData.student?.grade_label}</p>
                <p><strong>Student ID:</strong> #{statementData.student?.id}</p>
                <p><strong>Status:</strong> {statementData.balance > 0 ? (
                  <span style={{ color: '#dc2626' }}>Outstanding ({formatCurrency(statementData.balance)})</span>
                ) : (
                  <span style={{ color: '#16a34a' }}>Paid in Full</span>
                )}</p>
              </div>

              <div className="statement-summary">
                <div className="summary-row">
                  <span>Total Fees:</span>
                  <span>{formatCurrency(statementData.fees)}</span>
                </div>
                <div className="summary-row">
                  <span>Total Paid:</span>
                  <span>{formatCurrency(statementData.paid)}</span>
                </div>
                <div className="summary-row total">
                  <span>Balance:</span>
                  <span style={{ color: statementData.balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(statementData.balance)}
                  </span>
                </div>
              </div>

              {statementData.transactions.length > 0 && (
                <>
                  <h4>Payment History</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Receipt #</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.transactions.map((t: any, i: number) => (
                        <tr key={i}>
                          <td>{formatDate(t.date)}</td>
                          <td>{t.receipt_number}</td>
                          <td className="td-amount">{formatCurrency(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* Class Statement */}
          {statementData.type === 'class' && (
            <div className="statement-body">
              <div className="statement-info">
                <p><strong>Grade:</strong> {statementData.grade?.label}</p>
                <p><strong>Students:</strong> {statementData.students.length}</p>
              </div>

              <div className="statement-summary">
                <div className="summary-row">
                  <span>Total Fees:</span>
                  <span>{formatCurrency(statementData.totals.fees)}</span>
                </div>
                <div className="summary-row">
                  <span>Total Collected:</span>
                  <span>{formatCurrency(statementData.totals.paid)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Outstanding:</span>
                  <span style={{ color: statementData.totals.balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(statementData.totals.balance)}
                  </span>
                </div>
              </div>

              <h4>Student Details</h4>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Student Name</th>
                    <th>Fees</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.students.map((s: any) => (
                    <tr key={s.id}>
                      <td className="td-id">#{s.id}</td>
                      <td className="td-bold">{s.full_name}</td>
                      <td>{formatCurrency(s.fees)}</td>
                      <td>{formatCurrency(s.paid)}</td>
                      <td className="td-amount" style={{ color: s.balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(s.balance)}
                      </td>
                      <td>
                        {s.balance > 0 ? (
                          <span className="status-badge status-outstanding">Outstanding</span>
                        ) : (
                          <span className="status-badge status-paid">Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grade Summary Statement */}
          {statementData.type === 'grade' && (
            <div className="statement-body">
              <div className="statement-summary">
                <div className="summary-row">
                  <span>Total Students:</span>
                  <span>{statementData.totals.students}</span>
                </div>
                <div className="summary-row">
                  <span>Total Fees:</span>
                  <span>{formatCurrency(statementData.totals.fees)}</span>
                </div>
                <div className="summary-row">
                  <span>Total Collected:</span>
                  <span>{formatCurrency(statementData.totals.paid)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Outstanding:</span>
                  <span style={{ color: statementData.totals.balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(statementData.totals.balance)}
                  </span>
                </div>
              </div>

              <h4>Breakdown by Grade</h4>
              <table>
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Students</th>
                    <th>Total Fees</th>
                    <th>Collected</th>
                    <th>Outstanding</th>
                    <th>Collection Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.grades.map((g: any) => (
                    <tr key={g.id}>
                      <td className="td-bold">{g.label}</td>
                      <td>{g.studentCount}</td>
                      <td>{formatCurrency(g.fees)}</td>
                      <td>{formatCurrency(g.paid)}</td>
                      <td className="td-amount" style={{ color: g.balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(g.balance)}
                      </td>
                      <td>
                        {g.fees > 0 ? `${Math.round((g.paid / g.fees) * 100)}%` : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* School Statement */}
          {statementData.type === 'school' && (
            <div className="statement-body">
              <div className="statement-summary">
                <div className="summary-row">
                  <span>Total Students:</span>
                  <span>{statementData.totals.students}</span>
                </div>
                <div className="summary-row">
                  <span>Total Fees:</span>
                  <span>{formatCurrency(statementData.totals.fees)}</span>
                </div>
                <div className="summary-row">
                  <span>Total Collected:</span>
                  <span>{formatCurrency(statementData.totals.paid)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Outstanding:</span>
                  <span style={{ color: statementData.totals.balance > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(statementData.totals.balance)}
                  </span>
                </div>
                <div className="summary-row">
                  <span>Collection Rate:</span>
                  <span>
                    {statementData.totals.fees > 0 
                      ? `${Math.round((statementData.totals.paid / statementData.totals.fees) * 100)}%` 
                      : '0%'}
                  </span>
                </div>
              </div>

              <h4>All Students</h4>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Student Name</th>
                    <th>Grade</th>
                    <th>Fees</th>
                    <th>Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statementData.students.map((s: any) => (
                    <tr key={s.id}>
                      <td className="td-id">#{s.id}</td>
                      <td className="td-bold">{s.full_name}</td>
                      <td>{s.grade_label}</td>
                      <td>{formatCurrency(s.fees)}</td>
                      <td>{formatCurrency(s.paid)}</td>
                      <td className="td-amount" style={{ color: s.balance > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(s.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="statement-footer">
            <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialStatements;
