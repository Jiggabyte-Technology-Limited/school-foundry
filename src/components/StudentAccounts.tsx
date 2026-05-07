import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import StudentWizard from './StudentWizard';

interface Student { id: number; full_name: string; grade_label: string; grade_id: number; balance: number; guardian_name: string; guardian_contact: string; }
interface Grade { id: number; label: string; }
interface AcademicYear { id: number; label: string; }

const StudentAccounts: React.FC = () => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statementData, setStatementData] = useState<any>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [schoolName, setSchoolName] = useState('School Management');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  useEffect(() => { loadInitialData(); }, []);

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
    // Using LEFT JOIN to ensure students are at least listed even if something is slightly off with enrollment
    let query = `
      SELECT s.id, s.full_name, g.label as grade_label, g.id as grade_id, s.guardian_name, s.guardian_contact,
        COALESCE((SELECT SUM(amount_cents) FROM fee_structure WHERE year_id = ? AND grade_id = sye.grade_id), 0) -
        COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ?), 0) as balance
      FROM students s
      LEFT JOIN student_year_enrollment sye ON s.id = sye.student_id AND sye.year_id = ?
      LEFT JOIN grades g ON sye.grade_id = g.id
      WHERE 1=1`;
    const params: any[] = [selectedYear, selectedYear, selectedYear];

    if (gradeId) { 
        query += ' AND sye.grade_id = ?'; 
        params.push(gradeId); 
    }

    const result = await db.all(query + ' ORDER BY s.full_name', params);
    setStudents(result);
  };

  // Load students whenever year changes
  useEffect(() => { 
    if (selectedYear) {
        loadStudents(selectedGrade); 
        if (!selectedStudent) {
            loadOverview(selectedYear, selectedGrade);
        }
    }
  }, [selectedYear, selectedGrade]);

  const loadOverview = async (yearId: number, gradeId: number | null) => {
    setIsOverviewLoading(true);
    try {
        let invoicedQuery = `
            SELECT SUM(fs.amount_cents) as total
            FROM fee_structure fs
            JOIN student_year_enrollment sye ON fs.year_id = sye.year_id AND fs.grade_id = sye.grade_id
            WHERE fs.year_id = ?`;
        let paidQuery = `SELECT SUM(amount_paid_cents) as total FROM payments WHERE year_id = ? AND is_voided = 0`;
        const params: any[] = [yearId];

        if (gradeId) {
            invoicedQuery += ` AND fs.grade_id = ?`;
            paidQuery += ` AND grade_id = ?`;
            params.push(gradeId);
        }

        const [invoicedResult, paidResult] = await Promise.all([
            db.get(invoicedQuery, params),
            db.get(paidQuery, params)
        ]);

        const totalInvoiced = invoicedResult?.total || 0;
        const totalPaid = paidResult?.total || 0;
        
        setOverviewData({
            totalInvoiced,
            totalPaid,
            balance: totalInvoiced - totalPaid,
            isGrade: !!gradeId
        });
    } catch (err) {
        console.error('Error loading overview:', err);
    } finally {
        setIsOverviewLoading(false);
    }
  };

  // Keep loadStudents as it was, but remove the second useEffect call.


  const viewStatement = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoadingDetail(true);
    setDetailError(null);
    setShowPrintView(true); // Show the panel immediately

    try {
        const [payments, fees] = await Promise.all([
            db.all(`
                SELECT p.payment_date as date, p.receipt_number as ref, p.amount_paid_cents as amount, 
                       'Payment' as type, t.label as term_label
                FROM payments p
                LEFT JOIN terms t ON p.term_id = t.id
                WHERE p.student_id = ? AND p.year_id = ?
                ORDER BY p.payment_date`, [student.id, selectedYear]),
            db.all(`
                SELECT fs.description, fs.amount_cents as amount, 'Fee' as type, 
                       t.label as term_label, fs.fee_type
                FROM fee_structure fs
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE fs.grade_id = ? AND fs.year_id = ?`, [student.grade_id, selectedYear])
        ]);
        
        const totalFees = fees.reduce((sum: number, f: any) => sum + f.amount, 0);
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const balance = totalFees - totalPaid;

        setStatementData({ 
            student, 
            payments, 
            fees, 
            totalFees, 
            totalPaid, 
            balance,
            generatedAt: new Date().toLocaleDateString() 
        });
    } catch (err: any) {
        console.error('Error loading statement:', err);
        setDetailError(err.message || 'Failed to load financial records');
    } finally {
        setIsLoadingDetail(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <div>
        <div className="flex-between mb-4">
            <h2>Student Accounts</h2>
            <button className="btn btn-primary" onClick={() => setShowWizard(true)}>Add Student</button>
        </div>
        <div className="card mb-4">
          <label className="settings-label">Filter by Grade/Form</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
             <button 
                className={`btn ${selectedGrade === null ? 'btn-primary' : 'btn-sage'}`} 
                onClick={() => { setSelectedGrade(null); setSelectedStudent(null); setShowPrintView(false); }}
            >
                All
            </button>
             {grades.map(g => (
                <button 
                    key={g.id} 
                    className={`btn ${selectedGrade === g.id ? 'btn-primary' : 'btn-sage'}`} 
                    onClick={() => { setSelectedGrade(g.id); setSelectedStudent(null); setShowPrintView(false); }}
                >
                    {g.label}
                </button>
            ))}
          </div>
          <input className="input-default" placeholder="Search by name or ID..." onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div className="card" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table style={{ width: '100%' }}>
                <thead><tr><th>ID</th><th>Name</th><th>Grade</th><th>Balance</th></tr></thead>
                <tbody>
                    {students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.id).includes(searchQuery)).map(s => {
                        const isSelected = selectedStudent?.id === s.id;
                        return (
                            <tr 
                                key={s.id} 
                                onClick={() => viewStatement(s)} 
                                style={{ 
                                    cursor: 'pointer', 
                                    backgroundColor: isSelected ? 'var(--color-accent-teal-light)' : 'transparent',
                                    borderLeft: isSelected ? '4px solid var(--color-accent-teal)' : '4px solid transparent',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <td style={{ fontWeight: isSelected ? 700 : 400 }}>{s.id}</td>
                                <td style={{ fontWeight: isSelected ? 700 : 400 }}>{s.full_name}</td>
                                <td>{s.grade_label}</td>
                                <td style={{ color: s.balance > 0 ? 'var(--color-posthog-orange)' : 'var(--color-accent-emerald)', fontWeight: 600 }}>
                                    ${(s.balance/100).toFixed(2)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>

      {/* RIGHT: Statement Preview OR Dashboard Overview */}
      <div>
          {showPrintView && selectedStudent ? (
            <div className="card" style={{ padding: '32px', backgroundColor: 'white', minHeight: '400px', position: 'relative' }}>
                {/* ... (Existing Student Statement UI) ... */}
                {isLoadingDetail && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <div className="flex-col items-center">
                            <div style={{ width: 40, height: 40, border: '3px solid var(--color-sage-border)', borderTopColor: 'var(--color-accent-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ marginTop: 12, fontWeight: 600 }}>Loading account details...</p>
                        </div>
                    </div>
                )}

                {detailError ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <p style={{ color: 'red', marginBottom: 16 }}>{detailError}</p>
                        <button className="btn btn-primary" onClick={() => viewStatement(selectedStudent)}>Retry</button>
                    </div>
                ) : statementData ? (
                    <>
                        <div style={{ textAlign: 'center', borderBottom: '2px solid var(--color-deep-olive)', paddingBottom: 20, marginBottom: 24 }}>
                            <h2 style={{ fontSize: 24, marginBottom: 4 }}>{schoolName}</h2>
                            <p style={{ color: 'var(--color-sage-placeholder)', fontSize: 14 }}>Student Account Statement | {statementData.generatedAt}</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                            <div>
                                <h3 style={{ marginBottom: 4 }}>{statementData.student.full_name}</h3>
                                <p style={{ fontSize: 14, margin: 0 }}><strong>Grade:</strong> {statementData.student.grade_label}</p>
                                <p style={{ fontSize: 14, margin: 0 }}><strong>Guardian:</strong> {statementData.student.guardian_name} ({statementData.student.guardian_contact})</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className={`status-badge ${statementData.balance > 0 ? 'status-outstanding' : 'status-paid'}`}>
                                    {statementData.balance > 0 ? 'Outstanding' : 'Cleared'}
                                </span>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                            <div className="card-surface" style={{ padding: 16 }}>
                                <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', margin: '0 0 4px' }}>Total Invoiced</p>
                                <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>${(statementData.totalFees/100).toFixed(2)}</p>
                            </div>
                            <div className="card-surface" style={{ padding: 16 }}>
                                <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', margin: '0 0 4px' }}>Total Paid</p>
                                <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-accent-emerald)' }}>${(statementData.totalPaid/100).toFixed(2)}</p>
                            </div>
                            <div className="card-surface" style={{ padding: 16, border: '1px solid var(--color-sage-border)' }}>
                                <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', margin: '0 0 4px' }}>Balance</p>
                                <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: statementData.balance > 0 ? 'var(--color-posthog-orange)' : 'var(--color-accent-emerald)' }}>
                                    ${(statementData.balance/100).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        
                        <h4 style={{ fontSize: 16, marginBottom: 12 }}>Transaction History</h4>
                        <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                            <table style={{ width: '100%' }}>
                                <thead>
                                    <tr style={{ background: 'var(--color-sage-cream)' }}>
                                        <th>Date / Term</th>
                                        <th>Description</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Fees first */}
                                    {statementData.fees.map((item:any, i:any) => (
                                        <tr key={`fee-${i}`}>
                                            <td style={{ fontSize: 13 }}>{item.term_label || 'Term -'}</td>
                                            <td style={{ fontSize: 13 }}>{item.description} <span className="status-badge" style={{ fontSize: 10, padding: '1px 4px', background: '#fef3c7', color: '#d97706' }}>FEE</span></td>
                                            <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>${(item.amount/100).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {/* Payments next */}
                                    {statementData.payments.map((item:any, i:any) => (
                                        <tr key={`pay-${i}`}>
                                            <td style={{ fontSize: 13 }}>{item.date}</td>
                                            <td style={{ fontSize: 13 }}>
                                                Payment (Ref: {item.ref}) 
                                                <span className="status-badge" style={{ fontSize: 10, padding: '1px 4px', background: '#d1fae5', color: '#059669', marginLeft: 4 }}>PAID</span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--color-accent-emerald)' }}>-${(item.amount/100).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {statementData.fees.length === 0 && statementData.payments.length === 0 && (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-sage-placeholder)' }}>No financial records found for this period</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 no-print" style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-primary" onClick={() => window.print()}>Print Statement</button>
                            <button className="btn btn-sage" onClick={() => { setShowPrintView(false); setSelectedStudent(null); }}>Close</button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-sage-placeholder)' }}>
                        Select a student to view their details
                    </div>
                )}
            </div>
          ) : overviewData ? (
            <div className="card" style={{ padding: '32px', backgroundColor: 'white', minHeight: '400px', position: 'relative' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid var(--color-deep-olive)', paddingBottom: 20, marginBottom: 24 }}>
                    <h2 style={{ fontSize: 24, marginBottom: 4 }}>{schoolName}</h2>
                    <p style={{ color: 'var(--color-sage-placeholder)', fontSize: 14 }}>
                        {overviewData.isGrade ? `Grade: ${grades.find(g => g.id === selectedGrade)?.label}` : 'School Financial Overview'} | {new Date().toLocaleDateString()}
                    </p>
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                    <div className="card-surface" style={{ padding: 16 }}>
                        <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', margin: '0 0 4px' }}>Total Invoiced</p>
                        <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>${(overviewData.totalInvoiced/100).toFixed(2)}</p>
                    </div>
                    <div className="card-surface" style={{ padding: 16 }}>
                        <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', margin: '0 0 4px' }}>Total Paid</p>
                        <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--color-accent-emerald)' }}>${(overviewData.totalPaid/100).toFixed(2)}</p>
                    </div>
                    <div className="card-surface" style={{ padding: 16, border: '1px solid var(--color-sage-border)' }}>
                        <p style={{ fontSize: 12, color: 'var(--color-sage-placeholder)', margin: '0 0 4px' }}>Outstanding</p>
                        <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: overviewData.balance > 0 ? 'var(--color-posthog-orange)' : 'var(--color-accent-emerald)' }}>
                            ${(overviewData.balance/100).toFixed(2)}
                        </p>
                    </div>
                </div>

                <h4 style={{ fontSize: 16, marginBottom: 12 }}>
                    {overviewData.isGrade ? 'Student Payment Status' : 'Grade-wise Breakdown'}
                </h4>
                <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr style={{ background: 'var(--color-sage-cream)' }}>
                                <th>{overviewData.isGrade ? 'Student Name' : 'Grade'}</th>
                                <th style={{ textAlign: 'right' }}>{overviewData.isGrade ? 'Balance' : 'Outstanding'}</th>
                                <th style={{ textAlign: 'center', width: 100 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overviewData.isGrade ? (
                                students.map(s => (
                                    <tr key={s.id} onClick={() => viewStatement(s)} style={{ cursor: 'pointer' }}>
                                        <td style={{ fontSize: 14 }}>{s.full_name}</td>
                                        <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>${(s.balance/100).toFixed(2)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`status-badge ${s.balance > 0 ? 'status-outstanding' : 'status-paid'}`} style={{ fontSize: 11 }}>
                                                {s.balance > 0 ? 'Owing' : 'Paid'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                grades.map(g => {
                                    const gradeStudents = students.filter(s => s.grade_id === g.id);
                                    const gradeOutstanding = gradeStudents.reduce((sum, s) => sum + s.balance, 0);
                                    return (
                                        <tr key={g.id}>
                                            <td style={{ fontSize: 14 }}>{g.label}</td>
                                            <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>${(gradeOutstanding/100).toFixed(2)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`status-badge ${gradeOutstanding > 0 ? 'status-outstanding' : 'status-paid'}`} style={{ fontSize: 11 }}>
                                                    {gradeOutstanding > 0 ? 'Owing' : 'Cleared'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#999', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="7" y1="15" x2="7.01" y2="15" />
                    <line x1="11" y1="15" x2="11.01" y2="15" />
                </svg>
                Loading overview...
            </div>
          )}
      </div>
      {showWizard && <StudentWizard onClose={() => setShowWizard(false)} onSuccess={() => { setShowWizard(false); loadStudents(selectedGrade); }} />}
    </div>
  );
};

export default StudentAccounts;
