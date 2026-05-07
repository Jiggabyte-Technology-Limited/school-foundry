import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import StudentWizard from './StudentWizard';
import EditStudentModal from './EditStudentModal';
import PaymentWizard from './PaymentWizard';
import { useAuth } from '../lib/auth-context';

interface Student { id: number; full_name: string; grade_label: string; grade_id: number; balance: number; guardian_name: string; guardian_contact: string; }
interface Grade { id: number; label: string; }
interface AcademicYear { id: number; label: string; }
interface Term { id: number; label: string; }

const StudentAccounts: React.FC = () => {
  const { user } = useAuth();
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
  const [showPaymentWizard, setShowPaymentWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [schoolName, setSchoolName] = useState('School Management');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
        const [years, availableGrades, setting] = await Promise.all([
            db.all('SELECT * FROM academic_years ORDER BY label DESC'),
            db.all('SELECT * FROM grades ORDER BY id ASC'),
            db.get("SELECT value FROM app_settings WHERE key = 'school_name'")
        ]);
        setAcademicYears(years);
        setGrades(availableGrades);
        setSchoolName(setting?.value || 'School Management');
        if (years.length > 0) setSelectedYear(years[0].id);
    } catch (err) {
        console.error('Error loading initial data:', err);
    }
  };

  const loadTermsForYear = async (yearId: number) => {
    try {
      const terms = await db.all('SELECT id, label FROM terms WHERE year_id = ? ORDER BY start_date ASC', [yearId]);
      setTermsList(terms);
    } catch (err) {
      console.error('Error loading terms:', err);
    }
  };

  const loadStudents = async (gradeId: number | null) => {
    if (!selectedYear) return;
    try {
      let query = `
        SELECT s.id, s.full_name, g.label as grade_label, g.id as grade_id, 
          s.guardian_name, s.guardian_contact, s.guardian_name_2, s.guardian_contact_2, s.guardian_email,
          COALESCE((SELECT SUM(amount_cents) FROM fee_structure fs JOIN terms t ON fs.term_id = t.id WHERE fs.year_id = ? AND fs.grade_id = sye.grade_id AND (t.start_date IS NULL OR t.start_date <= date('now'))), 0) -
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
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  const loadOverview = async (yearId: number, gradeId: number | null) => {
    setIsOverviewLoading(true);
    try {
        let invoicedQuery = `SELECT SUM(fs.amount_cents) as total FROM fee_structure fs JOIN student_year_enrollment sye ON fs.grade_id = sye.grade_id AND fs.year_id = sye.year_id WHERE fs.year_id = ?`;
        let paidQuery = `SELECT SUM(amount_paid_cents) as total FROM payments WHERE year_id = ?`;
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

  useEffect(() => { 
    if (selectedYear) { 
        loadStudents(selectedGrade); 
        loadTermsForYear(selectedYear); 
        if (!selectedStudent) { 
            loadOverview(selectedYear, selectedGrade); 
        } 
    } 
  }, [selectedYear, selectedGrade, selectedStudent]);

  const viewStatement = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoadingDetail(true);
    setDetailError(null);
    setShowPrintView(true);
    if (selectedYear) await loadTermsForYear(selectedYear);
    try {
        const [payments, fees, upcoming] = await Promise.all([
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
                WHERE fs.grade_id = ? AND fs.year_id = ?
                AND (t.start_date IS NULL OR t.start_date <= date('now'))`, [student.grade_id, selectedYear]),
            db.all(`
                SELECT t.label as term_label, t.start_date, SUM(fs.amount_cents) as amount
                FROM terms t
                JOIN fee_structure fs ON t.id = fs.term_id
                WHERE fs.grade_id = ? AND fs.year_id = ? AND t.start_date > date('now')
                GROUP BY t.id
                ORDER BY t.start_date ASC`, [student.grade_id, selectedYear])
        ]);

        const totalFees = fees.reduce((sum: number, f: any) => sum + f.amount, 0);
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const balance = totalFees - totalPaid;

        setStatementData({
            student,
            payments,
            fees,
            upcoming,
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

  const handlePaymentSuccess = () => {
    setShowPaymentWizard(false);
    if (selectedStudent) {
        viewStatement(selectedStudent);
    }
    loadStudents(selectedGrade);
    loadOverview(selectedYear!, selectedGrade);
  };

  return (
    <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: 'var(--background)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="flex-between">
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">Student Accounts</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowPaymentWizard(true)}
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  Record Payment
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowWizard(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Student
                </button>
            </div>
        </div>
        
        <div className="card-surface">
          <div className="metric-label">Filter by Grade/Form</div>
          <div className="chip-list mb-4">
             <button
                className={`chip text-display ${selectedGrade === null ? 'chip-active' : ''}`}
                onClick={() => { setSelectedGrade(null); setSelectedStudent(null); setShowPrintView(false); }}
                style={{ border: 'none', cursor: 'pointer' }}
            >
                All
            </button>
             {grades.map(g => (
                <button
                    key={g.id}
                    className={`chip text-display ${selectedGrade === g.id ? 'chip-active' : ''}`}
                    onClick={() => { setSelectedGrade(g.id); setSelectedStudent(null); setShowPrintView(false); }}
                    style={{ border: 'none', cursor: 'pointer' }}
                >
                    {g.label}
                </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <input 
              className="input-default text-display" 
              placeholder="Search by name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} 
              style={{ paddingLeft: '40px' }}
            />
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, display: 'flex' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>
        </div>

        <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th>Name</th>
                    <th>Grade</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                    {students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.id).includes(searchQuery)).map(s => {
                        const isSelected = selectedStudent?.id === s.id;
                        return (
                            <tr
                                key={s.id}
                                onClick={() => viewStatement(s)}
                                style={{ 
                                    cursor: 'pointer', 
                                    backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                                    borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                                    transition: 'all 0.2s ease'
                                }}
                                className="hover:bg-secondary"
                            >
                                <td className="text-mono" style={{ opacity: 0.6, fontSize: '12px' }}>{s.id}</td>
                                <td style={{ fontWeight: 600 }} className="text-display">{s.full_name}</td>
                                <td style={{ fontSize: '14px', color: 'var(--text-secondary)' }} className="text-display">{s.grade_label}</td>
                                <td className="text-mono" style={{ fontWeight: 700, textAlign: 'right', color: s.balance > 0 ? 'var(--primary)' : '#10B981' }}>
                                    ${(s.balance/100).toFixed(2)}
                                </td>
                            </tr>
                        );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)', fontStyle: 'italic' }} className="text-display">
                          No students found for this selection
                        </td>
                      </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {showPrintView && selectedStudent ? (
            <>
                <div className="card-surface" style={{ padding: '32px', minHeight: '500px', position: 'relative', border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
                {isLoadingDetail && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(4px)', borderRadius: '16px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '48px', height: '48px', border: '4px solid var(--secondary)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ marginTop: '16px', fontWeight: 700, color: 'var(--text-primary)' }} className="text-display">Accessing records...</p>
                        </div>
                    </div>
                )}

                {detailError ? (
                    <div style={{ textAlign: 'center', padding: '80px 0' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: '#FEE2E2', color: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <p style={{ fontWeight: 500, marginBottom: '24px' }} className="text-display">{detailError}</p>
                        <button className="btn btn-primary" onClick={() => viewStatement(selectedStudent)}>Retry Connection</button>
                    </div>
                ) : statementData ? (
                    <>
                        <div style={{ textAlign: 'center', borderBottom: '2px solid rgba(249, 115, 22, 0.1)', paddingBottom: '32px', marginBottom: '32px' }}>
                            <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '-0.02em' }} className="text-display">{schoolName}</h2>
                            <div className="metric-label" style={{ margin: 0, opacity: 0.5 }}>Statement of Account • {statementData.generatedAt}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>      
                            <div>
                                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', tracking: '-0.02em' }} className="text-display">{statementData.student.full_name}</h3>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <span className="text-display" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{statementData.student.grade_label}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <span className="metric-label" style={{ fontSize: '10px', margin: 0 }}>Student ID</span>
                                    <span className="text-mono" style={{ fontSize: '12px', fontWeight: 700 }}>{statementData.student.id}</span>
                                  </div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }} className="text-display">
                                    <div style={{ marginBottom: '4px' }}>
                                        <span className="metric-label" style={{ fontSize: '10px', marginRight: '8px' }}>Primary Guardian</span>
                                        <span style={{ fontWeight: 600 }}>{statementData.student.guardian_name}</span>
                                        <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                                        <span className="text-mono">{statementData.student.guardian_contact}</span>
                                    </div>
                                    {statementData.student.guardian_name_2 && (
                                        <div style={{ marginBottom: '4px' }}>
                                            <span className="metric-label" style={{ fontSize: '10px', marginRight: '8px' }}>Secondary Guardian</span>
                                            <span style={{ fontWeight: 600 }}>{statementData.student.guardian_name_2}</span>
                                            {statementData.student.guardian_contact_2 && (
                                                <>
                                                    <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                                                    <span className="text-mono">{statementData.student.guardian_contact_2}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {statementData.student.guardian_email && (
                                        <div>
                                            <span className="metric-label" style={{ fontSize: '10px', marginRight: '8px' }}>Email Address</span>
                                            <span style={{ fontWeight: 600 }}>{statementData.student.guardian_email}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <span style={{ 
                                    padding: '6px 12px', 
                                    borderRadius: '8px', 
                                    fontSize: '10px', 
                                    fontWeight: 800, 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.05em',
                                    border: '1.5px solid',
                                    backgroundColor: statementData.balance > 0 ? 'rgba(249, 115, 22, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                    borderColor: statementData.balance > 0 ? 'var(--primary)' : '#10B981',
                                    color: statementData.balance > 0 ? 'var(--primary)' : '#059669'
                                }} className="text-display">
                                    {statementData.balance > 0 ? 'Payment Required' : 'Account Cleared'}
                                </span>
                                <button 
                                  className="btn btn-outline" 
                                  onClick={() => setShowEditModal(true)}
                                  style={{ padding: '4px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                  Edit Profile
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
                            <div style={{ backgroundColor: 'var(--secondary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <div className="metric-label" style={{ margin: '0 0 8px 0', fontSize: '10px' }}>Invoiced</div>
                                <div className="metric-value" style={{ fontSize: '24px' }}>${(statementData.totalFees/100).toFixed(2)}</div>
                            </div>
                            <div style={{ backgroundColor: 'var(--secondary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                                <div className="metric-label" style={{ margin: '0 0 8px 0', fontSize: '10px' }}>Payments</div>
                                <div className="metric-value" style={{ fontSize: '24px', color: '#10B981' }}>${(statementData.totalPaid/100).toFixed(2)}</div>
                            </div>
                            <div style={{ backgroundColor: 'var(--secondary)', padding: '20px', borderRadius: '16px', border: '1.5px solid var(--primary)', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.08)' }}>
                                <div className="metric-label" style={{ margin: '0 0 8px 0', fontSize: '10px' }}>Current Arrears</div>
                                <div className="metric-value" style={{ fontSize: '24px', color: 'var(--primary)' }}>
                                    ${(statementData.balance/100).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.03)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="text-display" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Total Remaining Financial Commitment for {selectedYear ? academicYears.find(y => y.id === selectedYear)?.label : 'Year'}
                            </div>
                            <div className="text-mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                ${( (statementData.balance + (statementData.upcoming?.reduce((s:any,u:any)=>s+u.amount,0) || 0)) / 100 ).toFixed(2)}
                            </div>
                        </div>

                        <div className="metric-label" style={{ marginBottom: '16px', opacity: 0.5 }}>Financial History</div>
                        <div style={{ maxHeight: '35vh', overflowY: 'auto', paddingRight: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                                    <tr>
                                        <th>Date / Term</th>
                                        <th>Details</th>
                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statementData.fees.map((item:any, i:any) => (
                                        <tr key={`fee-${i}`} className="hover:bg-secondary">
                                            <td className="text-display" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{item.term_label || 'Term -'}</td>       
                                            <td className="text-display" style={{ fontSize: '13px', fontWeight: 600 }}>
                                              {item.description} 
                                              <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '4px', fontSize: '9px', fontWeight: 800, border: '1px solid #FDE68A', textTransform: 'uppercase' }}>Debit</span>
                                            </td>    
                                            <td className="text-mono" style={{ fontSize: '14px', fontWeight: 700, textAlign: 'right' }}>${(item.amount/100).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {statementData.payments.map((item:any, i:any) => (
                                        <tr key={`pay-${i}`} className="hover:bg-secondary">
                                            <td className="text-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.date}</td>
                                            <td className="text-display" style={{ fontSize: '13px', fontWeight: 600 }}>
                                                Credit Receipt #{item.ref.split('-')[1]?.substring(0,6) || item.ref}
                                                <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '4px', fontSize: '9px', fontWeight: 800, border: '1px solid #A7F3D0', textTransform: 'uppercase' }}>Credit</span>
                                            </td>
                                            <td className="text-mono" style={{ fontSize: '14px', fontWeight: 700, textAlign: 'right', color: '#10B981' }}>-${(item.amount/100).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {statementData.fees.length === 0 && statementData.payments.length === 0 && (  
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.5 }} className="text-display">No transactional records exist for this student account</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {statementData.upcoming && statementData.upcoming.length > 0 && (
                            <div style={{ marginTop: '40px' }}>
                                <div className="metric-label" style={{ marginBottom: '16px', opacity: 0.5 }}>Upcoming Academic Schedule</div>
                                <div style={{ backgroundColor: 'var(--secondary)', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ background: 'transparent', padding: '0 0 12px 0' }}>Term</th>
                                                <th style={{ background: 'transparent', padding: '0 0 12px 0' }}>Expected Start</th>
                                                <th style={{ background: 'transparent', padding: '0 0 12px 0', textAlign: 'right' }}>Projected Fee</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statementData.upcoming.map((u: any, i: number) => (
                                                <tr key={`up-${i}`}>
                                                    <td style={{ padding: '12px 0', fontWeight: 700 }} className="text-display">{u.term_label}</td>
                                                    <td style={{ padding: '12px 0' }} className="text-mono">{u.start_date || 'TBA'}</td>
                                                    <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700 }} className="text-mono">${(u.amount/100).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(249, 115, 22, 0.05)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                        <span>Projections based on current approved fee structure for this academic year.</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }} className="no-print">
                            <button className="btn btn-primary" style={{ flex: 1, padding: '16px' }} onClick={() => window.print()}>Print Statement</button>
                            <button className="btn btn-outline" style={{ padding: '0 32px' }} onClick={() => { setShowPrintView(false); setSelectedStudent(null); }}>Exit</button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '96px 0', color: 'var(--text-secondary)', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }} className="text-display">
                      Record Entry Pending
                    </div>
                )}
            </div>
            </>
          ) : overviewData ? (
            <div className="card-surface" style={{ padding: '40px', minHeight: '500px', position: 'relative' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid rgba(249, 115, 22, 0.1)', paddingBottom: '32px', marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0', tracking: '-0.02em' }} className="text-display uppercase">{schoolName}</h2>
                    <div className="metric-label" style={{ margin: 0, opacity: 0.6 }}>
                        {overviewData.isGrade ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}` : 'Master Financial Overview'}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '40px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        <div style={{ backgroundColor: 'var(--secondary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div className="metric-label" style={{ fontSize: '10px' }}>Total Invoiced</div>
                            <div className="metric-value" style={{ fontSize: '20px' }}>${(overviewData.totalInvoiced/100).toFixed(2)}</div>
                        </div>
                        <div style={{ backgroundColor: 'var(--secondary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                            <div className="metric-label" style={{ fontSize: '10px' }}>Collected</div>
                            <div className="metric-value" style={{ fontSize: '20px', color: '#10B981' }}>${(overviewData.totalPaid/100).toFixed(2)}</div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(249, 115, 22, 0.05)', padding: '20px', borderRadius: '16px', border: '1.5px solid var(--primary)' }}>
                            <div className="metric-label" style={{ fontSize: '10px', color: 'var(--primary)' }}>Unpaid Balance</div>
                            <div className="metric-value" style={{ fontSize: '20px', color: 'var(--primary)' }}>
                                ${(overviewData.balance/100).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="metric-label" style={{ marginBottom: '24px', opacity: 0.5 }}>
                    {overviewData.isGrade ? 'Student Enrollment Breakdown' : 'Institutional Performance by Grade'}
                </div>
                <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                            <tr>
                                <th>{overviewData.isGrade ? 'Student Identity' : 'Academic Form'}</th>
                                <th style={{ textAlign: 'right' }}>Net Balance</th>
                                <th style={{ textAlign: 'center', width: '128px' }}>Compliance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overviewData.isGrade ? (
                                students.map(s => (
                                    <tr key={s.id} onClick={() => viewStatement(s)} style={{ cursor: 'pointer', transition: 'all 0.2s ease' }} className="hover:bg-secondary">
                                        <td style={{ fontWeight: 700 }} className="text-display">{s.full_name}</td>
                                        <td className="text-mono" style={{ fontWeight: 800, textAlign: 'right' }}>${(s.balance/100).toFixed(2)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                fontSize: '9px', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase', 
                                                letterSpacing: '0.05em',
                                                border: '1px solid',
                                                backgroundColor: s.balance > 0 ? 'rgba(249, 115, 22, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                                borderColor: s.balance > 0 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                color: s.balance > 0 ? 'var(--primary)' : '#059669'
                                            }} className="text-display">
                                                {s.balance > 0 ? 'Action Needed' : 'In Good Standing'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                grades.map(g => {
                                    const gradeStudents = students.filter(s => s.grade_id === g.id);
                                    const gradeOutstanding = gradeStudents.reduce((sum, s) => sum + s.balance, 0);
                                    return (
                                        <tr key={g.id} className="hover:bg-secondary" style={{ transition: 'background-color 0.2s ease' }}>
                                            <td style={{ fontWeight: 700 }} className="text-display">{g.label}</td>
                                            <td className="text-mono" style={{ fontWeight: 800, textAlign: 'right' }}>${(gradeOutstanding/100).toFixed(2)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '9px', 
                                                    fontWeight: 800, 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.05em',
                                                    border: '1px solid',
                                                    backgroundColor: gradeOutstanding > 0 ? 'rgba(249, 115, 22, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                                    borderColor: gradeOutstanding > 0 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                    color: gradeOutstanding > 0 ? 'var(--primary)' : '#059669'
                                                }} className="text-display">
                                                    {gradeOutstanding > 0 ? 'Arrears Present' : 'No Arrears'}
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
            <div className="card-surface" style={{ padding: '64px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, color: 'var(--text-secondary)' }}>
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <path d="M7 15h.01"></path>
                      <path d="M11 15h.01"></path>
                  </svg>
                </div>
                <p className="metric-label" style={{ opacity: 0.4 }}>Syncing Financial Data Layer...</p>
            </div>
          )}
      </div>
      {showWizard && <StudentWizard onClose={() => setShowWizard(false)} onSuccess={() => { setShowWizard(false); loadStudents(selectedGrade); }} />}
      {showPaymentWizard && (
        <PaymentWizard 
          onClose={() => setShowPaymentWizard(false)} 
          onSuccess={handlePaymentSuccess}
          preSelectedStudent={selectedStudent?.id}
        />
      )}
      {showEditModal && selectedStudent && selectedYear && (
        <EditStudentModal 
          studentId={selectedStudent.id} 
          yearId={selectedYear}
          onClose={() => setShowEditModal(false)} 
          onSuccess={() => { 
            setShowEditModal(false); 
            viewStatement(selectedStudent);
            loadStudents(selectedGrade);
          }} 
        />
      )}
    </div>
  );
};

export default StudentAccounts;
