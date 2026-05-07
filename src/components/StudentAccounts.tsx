import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import StudentWizard from './StudentWizard';
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
  const [termsList, setTermsList] = useState<Term[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentTermId, setPaymentTermId] = useState<number | null>(null);
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
        SELECT s.id, s.full_name, g.label as grade_label, g.id as grade_id, s.guardian_name, s.guardian_contact,    
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

  const addPayment = async () => {
    if (!selectedStudent || !selectedYear || !paymentTermId) return;
    const amountCents = Math.round(parseFloat(paymentAmount) * 100);
    const receiptNumber = `REC-${Date.now()}`;
    try {
        await db.run(`
            INSERT INTO payments (student_id, year_id, term_id, grade_id, amount_paid_cents, payment_date, receipt_number, payment_method, recorded_by)
            VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
        `, [selectedStudent.id, selectedYear, paymentTermId, selectedStudent.grade_id, amountCents, receiptNumber, paymentMethod, user?.id]);
        
        // Refresh data
        await viewStatement(selectedStudent);
        loadStudents(selectedGrade);
        loadOverview(selectedYear, selectedGrade);
        
        setPaymentAmount('');
        setPaymentMethod('cash');
        setPaymentTermId(null);
    } catch (err) {
        console.error('Failed to record payment', err);
        alert('Error recording payment');
    }
  };

  const viewStatement = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoadingDetail(true);
    setDetailError(null);
    setShowPrintView(true);
    if (selectedYear) await loadTermsForYear(selectedYear);
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
                WHERE fs.grade_id = ? AND fs.year_id = ?
                AND (t.start_date IS NULL OR t.start_date <= date('now'))`, [student.grade_id, selectedYear])     
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
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-background min-h-full">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold font-display text-text-primary">Student Accounts</h2>
            <button 
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm" 
              onClick={() => setShowWizard(true)}
            >
              Add Student
            </button>
        </div>
        
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Filter by Grade/Form</label>
          <div className="grid grid-cols-4 gap-2 mb-6">
             <button
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedGrade === null ? 'bg-primary text-white shadow-md' : 'bg-secondary text-text-primary hover:bg-border'}`}
                onClick={() => { setSelectedGrade(null); setSelectedStudent(null); setShowPrintView(false); }}    
            >
                All
            </button>
             {grades.map(g => (
                <button
                    key={g.id}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedGrade === g.id ? 'bg-primary text-white shadow-md' : 'bg-secondary text-text-primary hover:bg-border'}`}
                    onClick={() => { setSelectedGrade(g.id); setSelectedStudent(null); setShowPrintView(false); }}
                >
                    {g.label}
                </button>
            ))}
          </div>
          <div className="relative">
            <input 
              className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
              placeholder="Search by name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
            <div className="absolute left-3 top-2.5 text-text-secondary opacity-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <table className="w-full text-left border-collapse">
                <thead className="bg-secondary/80 text-text-secondary text-[10px] uppercase font-bold tracking-widest sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Grade</th>
                    <th className="px-6 py-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {students.filter(s => s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || String(s.id).includes(searchQuery)).map(s => {
                        const isSelected = selectedStudent?.id === s.id;
                        return (
                            <tr
                                key={s.id}
                                onClick={() => viewStatement(s)}
                                className={`group cursor-pointer transition-all hover:bg-primary/5 ${isSelected ? 'bg-primary/10 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                            >
                                <td className="px-6 py-4 text-sm font-mono opacity-60">{s.id}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-text-primary">{s.full_name}</td>
                                <td className="px-6 py-4 text-sm text-text-secondary">{s.grade_label}</td>
                                <td className={`px-6 py-4 text-sm font-mono font-bold text-right ${s.balance > 0 ? 'text-primary' : 'text-emerald-500'}`}>
                                    ${(s.balance/100).toFixed(2)}
                                </td>
                            </tr>
                        );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-text-secondary italic opacity-60">No students found for this selection</td>
                      </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      <div className="space-y-6">
          {showPrintView && selectedStudent ? (
            <div className="bg-white border border-border rounded-xl p-8 shadow-xl min-h-[500px] relative animate-in fade-in slide-in-from-right-4 duration-300">
                {isLoadingDetail && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20 backdrop-blur-sm rounded-xl">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-secondary border-t-primary rounded-full animate-spin" />
                            <p className="mt-4 font-bold text-text-primary tracking-tight">Accessing records...</p>
                        </div>
                    </div>
                )}

                {detailError ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <p className="text-text-primary font-medium mb-6">{detailError}</p>
                        <button className="px-6 py-2 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20" onClick={() => viewStatement(selectedStudent)}>Retry Connection</button>
                    </div>
                ) : statementData ? (
                    <>
                        <div className="text-center border-b-2 border-primary/20 pb-8 mb-8">
                            <h2 className="text-3xl font-black font-display text-text-primary uppercase tracking-tighter mb-1">{schoolName}</h2>
                            <p className="text-text-secondary text-xs font-bold uppercase tracking-[0.2em] opacity-60">Statement of Account • {statementData.generatedAt}</p>
                        </div>

                        <div className="flex justify-between items-start mb-8">      
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-text-primary tracking-tight">{statementData.student.full_name}</h3>
                                <div className="flex gap-4 items-center">
                                  <p className="text-xs text-text-secondary font-bold uppercase"><span className="opacity-50">Grade:</span> {statementData.student.grade_label}</p>
                                  <p className="text-xs text-text-secondary font-bold uppercase"><span className="opacity-50">ID:</span> {statementData.student.id}</p>
                                </div>
                                <p className="text-xs text-text-secondary font-medium"><span className="opacity-50 font-bold uppercase mr-1">Guardian:</span> {statementData.student.guardian_name} ({statementData.student.guardian_contact})</p>
                            </div>
                            <div className="text-right">
                                <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border-2 ${statementData.balance > 0 ? 'bg-orange-50 border-primary text-primary' : 'bg-emerald-50 border-emerald-500 text-emerald-600'}`}>
                                    {statementData.balance > 0 ? 'Payment Required' : 'Account Cleared'}
                                </span>
                            </div>
                        </div>

                        <div className="mb-10 p-6 border-2 border-dashed border-border rounded-xl bg-secondary/20">
                          <h4 className="text-xs font-black text-text-primary mb-4 uppercase tracking-widest">Record New Transaction</h4>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="relative">
                              <input type="number" step="0.01" min="0.01" placeholder="Amount ($)" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full pl-8 pr-4 py-2.5 bg-white border border-border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20" />
                              <span className="absolute left-3 top-2.5 text-text-secondary font-bold">$</span>
                            </div>
                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                              <option value="cash">Cash Payment</option>
                              <option value="ecocash">EcoCash / Mobile</option>
                              <option value="bank_transfer">Direct Deposit</option>
                              <option value="other">Other Method</option>
                            </select>
                          </div>
                          <div className="flex gap-3">
                            <select value={paymentTermId || ''} onChange={e => setPaymentTermId(Number(e.target.value) || null)} className="flex-1 px-4 py-2.5 bg-white border border-border rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                              <option value="">Allocate to Term...</option>
                              {termsList.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            <button 
                              className="px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-primary/20" 
                              onClick={addPayment} 
                              disabled={!paymentAmount || !paymentTermId}
                            >
                              Post
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-10">
                            <div className="bg-secondary/40 p-5 rounded-2xl border border-border group hover:border-primary/30 transition-colors">
                                <p className="text-[10px] uppercase font-black text-text-secondary mb-2 tracking-widest opacity-60">Invoiced</p>
                                <p className="text-2xl font-black font-mono text-text-primary tracking-tighter">${(statementData.totalFees/100).toFixed(2)}</p>
                            </div>
                            <div className="bg-secondary/40 p-5 rounded-2xl border border-border group hover:border-emerald-500/30 transition-colors">
                                <p className="text-[10px] uppercase font-black text-text-secondary mb-2 tracking-widest opacity-60">Payments</p>
                                <p className="text-2xl font-black font-mono text-emerald-500 tracking-tighter">${(statementData.totalPaid/100).toFixed(2)}</p>
                            </div>
                            <div className="bg-secondary/40 p-5 rounded-2xl border-2 border-primary shadow-lg shadow-primary/5">
                                <p className="text-[10px] uppercase font-black text-text-secondary mb-2 tracking-widest opacity-60">Balance</p>
                                <p className={`text-2xl font-black font-mono tracking-tighter ${statementData.balance > 0 ? 'text-primary' : 'text-emerald-500'}`}>
                                    ${(statementData.balance/100).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <h4 className="text-[10px] font-black text-text-primary mb-4 uppercase tracking-[0.3em] opacity-40">Financial History</h4>
                        <div className="overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '35vh' }}>
                            <table className="w-full text-left">
                                <thead className="bg-secondary/50 text-text-secondary text-[9px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-4 py-2 rounded-l-lg">Date / Term</th>
                                        <th className="px-4 py-2">Details</th>
                                        <th className="px-4 py-2 text-right rounded-r-lg">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {statementData.fees.map((item:any, i:any) => (
                                        <tr key={`fee-${i}`} className="hover:bg-secondary/20">
                                            <td className="px-4 py-4 text-[11px] font-bold text-text-secondary uppercase">{item.term_label || 'Term -'}</td>       
                                            <td className="px-4 py-4 text-xs font-semibold text-text-primary">
                                              {item.description} 
                                              <span className="ml-2 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-black border border-amber-200 uppercase tracking-tighter">Debit</span>
                                            </td>    
                                            <td className="px-4 py-4 text-sm font-mono font-black text-right text-text-primary">${(item.amount/100).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {statementData.payments.map((item:any, i:any) => (
                                        <tr key={`pay-${i}`} className="hover:bg-secondary/20">
                                            <td className="px-4 py-4 text-[11px] font-bold text-text-secondary">{item.date}</td>
                                            <td className="px-4 py-4 text-xs font-semibold text-text-primary">
                                                Credit Receipt #{item.ref.split('-')[1]?.substring(0,6) || item.ref}
                                                <span className="ml-2 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black border border-emerald-200 uppercase tracking-tighter">Credit</span>
                                            </td>
                                            <td className="px-4 py-4 text-sm font-mono font-black text-right text-emerald-500">-${(item.amount/100).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {statementData.fees.length === 0 && statementData.payments.length === 0 && (  
                                        <tr><td colSpan={3} className="px-4 py-16 text-center text-sm text-text-secondary italic opacity-40 font-medium tracking-tight">No transactional records exist for this student account</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-8 flex gap-4 no-print">
                            <button className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-[0.98]" onClick={() => window.print()}>Print Statement</button>
                            <button className="px-6 py-3 bg-secondary text-text-primary rounded-xl font-black uppercase tracking-widest hover:bg-border transition-all active:scale-[0.98]" onClick={() => { setShowPrintView(false); setSelectedStudent(null); }}>Exit</button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-24 text-text-secondary opacity-40 font-bold uppercase tracking-widest text-sm">
                      Record Entry Pending
                    </div>
                )}
            </div>
          ) : overviewData ? (
            <div className="bg-surface border border-border rounded-xl p-10 shadow-sm min-h-[500px] relative animate-in fade-in duration-500">
                <div className="text-center border-b-2 border-primary/20 pb-8 mb-10">
                    <h2 className="text-2xl font-black font-display text-text-primary tracking-tighter uppercase">{schoolName}</h2>
                    <p className="text-text-secondary text-xs font-bold uppercase tracking-[0.2em] opacity-60">
                        {overviewData.isGrade ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}` : 'Master Financial Overview'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <div className="bg-secondary/20 p-6 rounded-2xl border border-border hover:border-primary/20 transition-all">
                        <p className="text-[10px] uppercase font-black text-text-secondary mb-2 tracking-widest opacity-60">Total Invoiced</p>
                        <p className="text-2xl font-black font-mono text-text-primary tracking-tighter">${(overviewData.totalInvoiced/100).toFixed(2)}</p>
                    </div>
                    <div className="bg-secondary/20 p-6 rounded-2xl border border-border hover:border-emerald-500/20 transition-all">
                        <p className="text-[10px] uppercase font-black text-text-secondary mb-2 tracking-widest opacity-60">Collected</p>
                        <p className="text-2xl font-black font-mono text-emerald-500 tracking-tighter">${(overviewData.totalPaid/100).toFixed(2)}</p>
                    </div>
                    <div className="bg-primary/5 p-6 rounded-2xl border-2 border-primary shadow-lg shadow-primary/5">
                        <p className="text-[10px] uppercase font-black text-text-secondary mb-2 tracking-widest opacity-60">Unpaid Balance</p>
                        <p className={`text-2xl font-black font-mono tracking-tighter ${overviewData.balance > 0 ? 'text-primary' : 'text-emerald-500'}`}>
                            ${(overviewData.balance/100).toFixed(2)}
                        </p>
                    </div>
                </div>

                <h4 className="text-[10px] font-black text-text-primary mb-6 uppercase tracking-[0.3em] opacity-40">
                    {overviewData.isGrade ? 'Student Enrollment Breakdown' : 'Institutional Performance by Grade'}
                </h4>
                <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '45vh' }}>
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-secondary/30 text-text-secondary text-[9px] uppercase font-black tracking-widest sticky top-0">
                            <tr>
                                <th className="px-5 py-3 rounded-l-lg">{overviewData.isGrade ? 'Student Identity' : 'Academic Form'}</th>
                                <th className="px-5 py-3 text-right">Net Balance</th>
                                <th className="px-5 py-3 text-center w-32 rounded-r-lg">Compliance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {overviewData.isGrade ? (
                                students.map(s => (
                                    <tr key={s.id} onClick={() => viewStatement(s)} className="group cursor-pointer hover:bg-primary/5 transition-all">
                                        <td className="px-5 py-4 text-sm font-bold text-text-primary group-hover:text-primary transition-colors">{s.full_name}</td>
                                        <td className="px-5 py-4 text-sm font-mono font-black text-right text-text-primary">${(s.balance/100).toFixed(2)}</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter border ${s.balance > 0 ? 'bg-orange-50 border-primary/20 text-primary' : 'bg-emerald-50 border-emerald-500/20 text-emerald-600'}`}>
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
                                        <tr key={g.id} className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-5 py-4 text-sm font-bold text-text-primary">{g.label}</td>
                                            <td className="px-5 py-4 text-sm font-mono font-black text-right text-text-primary">${(gradeOutstanding/100).toFixed(2)}</td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-tighter border ${gradeOutstanding > 0 ? 'bg-orange-50 border-primary/20 text-primary' : 'bg-emerald-50 border-emerald-500/20 text-emerald-600'}`}>
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
            <div className="bg-surface border border-border rounded-xl p-16 text-center flex flex-col items-center gap-6 animate-pulse">
                <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 text-text-secondary">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <path d="M7 15h.01"></path>
                      <path d="M11 15h.01"></path>
                  </svg>
                </div>
                <p className="text-text-secondary text-xs font-black uppercase tracking-[0.3em] opacity-40">Syncing Financial Data Layer...</p>
            </div>
          )}
      </div>
      {showWizard && <StudentWizard onClose={() => setShowWizard(false)} onSuccess={() => { setShowWizard(false); loadStudents(selectedGrade); }} />}
    </div>
  );
};

export default StudentAccounts;
