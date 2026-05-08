import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import StudentWizard from './StudentWizard';
import EditStudentModal from './EditStudentModal';
import PaymentWizard from './PaymentWizard';
import StudentList from './StudentList';
import StatementPrintView from './StatementPrintView';
import GradeOverview from './GradeOverview';
import StudentStatementPreview from './StudentStatementPreview';
import { useAuth } from '../lib/auth-context';
import { generateOverviewHtml, printDocument } from '../lib/print-service';

interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  grade_id: number;
  balance: number;
  invoiced: number;
  paid: number;
  guardian_name: string;
  guardian_contact: string;
  guardian_name_2: string;
  guardian_contact_2: string;
  guardian_email: string;
  school_logo?: string;
}

interface Grade {
  id: number;
  label: string;
}
interface AcademicYear {
  id: number;
  label: string;
}
interface Term {
  id: number;
  label: string;
}

const StudentAccounts: React.FC = () => {
  const { user, canManageStudents } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [termsList, setTermsList] = useState<Term[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaid, setShowPaid] = useState(true);
  const [showOwing, setShowOwing] = useState(true);
  const [statementData, setStatementData] = useState<any>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [allStatementsData, setAllStatementsData] = useState<any[]>([]);

  const filteredStudents = students.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.id).includes(searchQuery);
    const isPaid = s.balance <= 0;
    const isOwing = s.balance > 0;
    const matchesStatus = (showPaid && isPaid) || (showOwing && isOwing);
    return matchesSearch && matchesStatus;
  });

  const printAllStatements = async () => {
    if (filteredStudents.length === 0) return;
    setIsPrintingAll(true);
    const statements = [];
    for (const student of filteredStudents) {
      try {
        const [payments, fees] = await Promise.all([
          db.all(
            `
                SELECT p.payment_date as date, p.receipt_number as ref, p.amount_paid_cents as amount,
                       'Payment' as type, t.label as term_label
                FROM payments p
                LEFT JOIN terms t ON p.term_id = t.id
                WHERE p.student_id = ? AND p.year_id = ?
                ORDER BY p.payment_date`,
            [student.id, selectedYear]
          ),
          db.all(
            `
                SELECT fs.description, fs.amount_cents as amount, 'Fee' as type,
                       t.label as term_label, fs.fee_type
                FROM fee_structure fs
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE fs.grade_id = ? AND fs.year_id = ?
                AND (t.start_date IS NULL OR t.start_date <= date('now'))`,
            [student.grade_id, selectedYear]
          ),
        ]);

        const totalFees = fees.reduce((sum: number, f: any) => sum + f.amount, 0);
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const balance = totalFees - totalPaid;

        statements.push({
          student,
          payments,
          fees,
          totalFees,
          totalPaid,
          balance,
          generatedAt: new Date().toLocaleDateString(),
        });
      } catch (err) {
        console.error(`Error loading statement for student ${student.id}:`, err);
      }
    }
    // Get current term for statements
    const currentTerm = termsList.length > 0 ? termsList[0].label : '';

    // Generate PDFs for each student and print them
    for (const data of statements) {
      const html = generateStudentStatementHtml({
        schoolName,
        schoolLogo: schoolLogo || undefined,
        schoolContact: schoolContact || undefined,
        currentTerm: currentTerm || undefined,
        generatedAt: data.generatedAt,
        studentName: data.student.full_name,
        grade: data.student.grade_label,
        studentId: String(data.student.id),
        guardianName: data.student.guardian_name,
        guardianContact: data.student.guardian_contact,
        isOwing: data.balance > 0,
        totalInvoiced: (data.totalFees / 100).toFixed(2),
        totalPaid: (data.totalPaid / 100).toFixed(2),
        balance: (data.balance / 100).toFixed(2),
        fees: data.fees.map((f: any) => ({
          termLabel: f.term_label,
          description: f.description,
          amount: (f.amount / 100).toFixed(2),
        })),
        payments: data.payments.map((p: any) => ({
          date: p.date,
          ref: p.ref,
          amount: (p.amount / 100).toFixed(2),
        })),
      });
      await printDocument({
        html,
        filename: `statement_${data.student.full_name.replace(/\s+/g, '_')}_${data.student.id}`,
        title: `Statement - ${data.student.full_name}`,
      });
    }
    setIsPrintingAll(false);
  };
  const [showWizard, setShowWizard] = useState(false);
  const [showPaymentWizard, setShowPaymentWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [schoolName, setSchoolName] = useState('School Management');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to manage students.</p>
      </div>
    );
  }

  const [schoolContact, setSchoolContact] = useState<string>('');

  const loadInitialData = async () => {
    try {
      const [years, availableGrades, nameSetting, logoSetting, phoneSetting, emailSetting] =
        await Promise.all([
          db.all('SELECT * FROM academic_years ORDER BY label DESC'),
          db.all('SELECT * FROM grades ORDER BY id ASC'),
          db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
          db.get("SELECT value FROM app_settings WHERE key = 'school_logo'"),
          db.get("SELECT value FROM app_settings WHERE key = 'school_phone'"),
          db.get("SELECT value FROM app_settings WHERE key = 'school_email'"),
        ]);
      setAcademicYears(years);
      setGrades(availableGrades);
      setSchoolName(nameSetting?.value || 'School Management');
      setSchoolLogo(logoSetting?.value || null);

      // Build contact string
      const phone = phoneSetting?.value || '';
      const email = emailSetting?.value || '';
      const contactParts = [phone, email].filter(Boolean);
      setSchoolContact(contactParts.join(' | '));

      if (years.length > 0) setSelectedYear(years[0].id);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadTermsForYear = async (yearId: number) => {
    try {
      const terms = await db.all(
        'SELECT id, label FROM terms WHERE year_id = ? ORDER BY start_date ASC',
        [yearId]
      );
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
          COALESCE((SELECT SUM(amount_cents) FROM fee_structure fs JOIN terms t ON fs.term_id = t.id WHERE fs.year_id = ? AND fs.grade_id = sye.grade_id AND (t.start_date IS NULL OR t.start_date <= date('now'))), 0) as invoiced,
          COALESCE((SELECT SUM(amount_paid_cents) FROM payments WHERE student_id = s.id AND year_id = ? AND is_voided = 0), 0) as paid
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
      // Map balance locally
      const resultWithBalance = result.map((s: any) => ({
        ...s,
        balance: s.invoiced - s.paid,
      }));
      setStudents(resultWithBalance);
    } catch (err) {
      console.error('Error loading students:', err);
    }
  };

  useEffect(() => {
    if (selectedYear) {
      loadStudents(selectedGrade);
      loadTermsForYear(selectedYear);
    }
  }, [selectedYear, selectedGrade]);

  // Helper function to get overview data - used by both UI preview and PDF
  const getOverviewData = () => {
    const isGrade = !!selectedGrade;
    const dataToUse = isGrade ? students : grades;

    const totalInvoiced = dataToUse.reduce((sum: number, item: any) => {
      if (isGrade) return sum + (item.invoiced || 0);
      const gradeStudents = students.filter(s => s.grade_id === item.id);
      return sum + gradeStudents.reduce((s, stu) => s + (stu.invoiced || 0), 0);
    }, 0);

    const totalPaid = dataToUse.reduce((sum: number, item: any) => {
      if (isGrade) return sum + (item.paid || 0);
      const gradeStudents = students.filter(s => s.grade_id === item.id);
      return sum + gradeStudents.reduce((s, stu) => s + (stu.paid || 0), 0);
    }, 0);

    const balance = totalInvoiced - totalPaid;

    const rows = isGrade
      ? students
          .filter(s => {
            const isPaid = s.balance <= 0;
            const isOwing = s.balance > 0;
            return (showPaid && isPaid) || (showOwing && isOwing);
          })
          .map(s => ({
            name: s.full_name,
            studentId: String(s.id),
            balance: s.balance,
            status: s.balance <= 0 ? 'Paid' : 'Owing',
          }))
      : grades
          .map(g => {
            const gradeStudents = students.filter(s => s.grade_id === g.id);
            const gradeBalance = gradeStudents.reduce((sum, s) => sum + s.balance, 0);
            return {
              name: g.label,
              balance: gradeBalance,
              status: gradeBalance <= 0 ? 'Paid' : 'Owing',
            };
          })
          .filter(g => {
            const isPaid = g.balance <= 0;
            const isOwing = g.balance > 0;
            return (showPaid && isPaid) || (showOwing && isOwing);
          });

    return {
      totalInvoiced,
      totalPaid,
      balance,
      isGrade,
      rows,
    };
  };

  const currentOverview = getOverviewData();

  const viewStatement = async (student: Student) => {
    setSelectedStudent(student);
    setIsLoadingDetail(true);
    setDetailError(null);
    setShowPrintView(true);
    if (selectedYear) await loadTermsForYear(selectedYear);
    try {
      const [payments, fees] = await Promise.all([
        db.all(
          `
                SELECT p.payment_date as date, p.receipt_number as ref, p.amount_paid_cents as amount,
                       'Payment' as type, t.label as term_label
                FROM payments p
                LEFT JOIN terms t ON p.term_id = t.id
                WHERE p.student_id = ? AND p.year_id = ?
                ORDER BY p.payment_date`,
          [student.id, selectedYear]
        ),
        db.all(
          `
                SELECT fs.description, fs.amount_cents as amount, 'Fee' as type,
                       t.label as term_label, fs.fee_type
                FROM fee_structure fs
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE fs.grade_id = ? AND fs.year_id = ?
                AND (t.start_date IS NULL OR t.start_date <= date('now'))`,
          [student.grade_id, selectedYear]
        ),
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
        generatedAt: new Date().toLocaleDateString(),
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
  };

  return (
    <div
      className="page-content"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        background: 'var(--background)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="flex-between">
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">
            Student Accounts
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Student
            </button>
          </div>
        </div>

        <div className="card-surface">
          <div className="flex-between mb-4">
            <div className="metric-label" style={{ margin: 0 }}>
              Filter by Grade/Form
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn ${showPaid ? 'btn-success' : 'btn-outline'}`}
                onClick={() => setShowPaid(!showPaid)}
                style={{ padding: '4px 12px', fontSize: '11px', opacity: showPaid ? 1 : 0.5 }}
              >
                Paid in Full
              </button>
              <button
                className={`btn ${showOwing ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setShowOwing(!showOwing)}
                style={{ padding: '4px 12px', fontSize: '11px', opacity: showOwing ? 1 : 0.5 }}
              >
                Owing
              </button>
            </div>
          </div>
          <div className="chip-list mb-4">
            <button
              className={`chip text-display ${selectedGrade === null ? 'chip-active' : ''}`}
              onClick={() => {
                setSelectedGrade(null);
                setSelectedStudent(null);
                setShowPrintView(false);
              }}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              All
            </button>
            {grades.map(g => (
              <button
                key={g.id}
                className={`chip text-display ${selectedGrade === g.id ? 'chip-active' : ''}`}
                onClick={() => {
                  setSelectedGrade(g.id);
                  setSelectedStudent(null);
                  setShowPrintView(false);
                }}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                className="input-default text-display"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.5,
                  display: 'flex',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
            </div>
            <button
              className="btn btn-outline"
              onClick={printAllStatements}
              disabled={isPrintingAll || filteredStudents.length === 0}
              style={{ whiteSpace: 'nowrap' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              {isPrintingAll ? 'Preparing...' : 'Print All Statements'}
            </button>
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
              {filteredStudents.map(s => {
                const isSelected = selectedStudent?.id === s.id;
                return (
                  <tr
                    key={s.id}
                    onClick={() => viewStatement(s)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'all 0.2s ease',
                    }}
                    className="hover:bg-secondary"
                  >
                    <td className="text-mono" style={{ opacity: 0.6, fontSize: '12px' }}>
                      {s.id}
                    </td>
                    <td style={{ fontWeight: 600 }} className="text-display">
                      {s.full_name}
                    </td>
                    <td
                      style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
                      className="text-display"
                    >
                      {s.grade_label}
                    </td>
                    <td
                      className="text-mono"
                      style={{
                        fontWeight: 700,
                        textAlign: 'right',
                        color: s.balance > 0 ? 'var(--primary)' : '#10B981',
                      }}
                    >
                      ${(s.balance / 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      padding: '48px',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                    }}
                    className="text-display"
                  >
                    No students found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {showPrintView && selectedStudent && (
          <StudentStatementPreview
            statementData={statementData}
            isLoadingDetail={isLoadingDetail}
            detailError={detailError}
            schoolName={schoolName}
            schoolLogo={schoolLogo}
            schoolContact={schoolContact}
            termsList={termsList}
            showOwing={showOwing}
            showPaid={showPaid}
            onExit={() => {
              setShowPrintView(false);
              setSelectedStudent(null);
            }}
            onEditProfile={() => setShowEditModal(true)}
            onRecordPayment={() => setShowPaymentWizard(true)}
            onRetry={() => viewStatement(selectedStudent)}
          />
        )}

        {!showPrintView && currentOverview && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!currentOverview) return;
                  try {
                    console.log(
                      '[StudentAccounts] Print overview clicked, currentOverview:',
                      currentOverview
                    );
                    // Get current term
                    const currentTerm = termsList.length > 0 ? termsList[0].label : '';
                    console.log(
                      '[StudentAccounts] Generating HTML with schoolName:',
                      schoolName,
                      'schoolLogo:',
                      schoolLogo ? 'present' : 'null'
                    );

                    const html = generateOverviewHtml({
                      schoolName,
                      schoolLogo: schoolLogo || undefined,
                      schoolContact: schoolContact || undefined,
                      reportTitle: currentOverview.isGrade
                        ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}`
                        : 'Master Financial Overview',
                      currentTerm: currentTerm || undefined,
                      generatedAt: new Date().toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }),
                      totalInvoiced: (currentOverview.totalInvoiced / 100).toFixed(2),
                      totalPaid: (currentOverview.totalPaid / 100).toFixed(2),
                      balance: (currentOverview.balance / 100).toFixed(2),
                      rows: currentOverview.rows.map((r: any) => ({
                        name: r.name,
                        studentId: r.studentId,
                        balance: (r.balance / 100).toFixed(2),
                        status: r.status,
                      })),
                    });
                    const result = await printDocument({
                      html,
                      filename: currentOverview.isGrade
                        ? `grade_report_${grades.find(g => g.id === selectedGrade)?.label?.replace(/\s+/g, '_')}`
                        : 'financial_overview',
                      title: currentOverview.isGrade
                        ? `Grade Report - ${grades.find(g => g.id === selectedGrade)?.label}`
                        : 'Financial Overview',
                    });
                    if (!result) {
                      console.error('Print failed - no result returned');
                    }
                  } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    console.error('Print overview error:', err);
                    alert(`Failed to print overview: ${errorMsg}`);
                  }
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print Overview
              </button>
            </div>
            <div className="a4-page" style={{ position: 'relative', margin: 0 }}>
              <div
                style={{
                  textAlign: 'center',
                  borderBottom: '2px solid #f97316',
                  paddingBottom: '20px',
                  marginBottom: '24px',
                }}
              >
                {schoolLogo && (
                  <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={schoolLogo}
                      alt="School Logo"
                      style={{ maxHeight: '60px', maxWidth: '150px' }}
                    />
                  </div>
                )}
                <h2
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    margin: '0 0 8px 0',
                    color: '#1f2937',
                  }}
                >
                  {schoolName}
                </h2>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#f97316',
                    marginBottom: '8px',
                  }}
                >
                  {currentOverview.isGrade
                    ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}`
                    : 'Master Financial Overview'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {termsList.length > 0 && <span>Term: {termsList[0].label}</span>}
                  <span style={{ margin: '0 8px' }}>|</span>
                  <span>
                    Generated:{' '}
                    {new Date().toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  {schoolContact && (
                    <>
                      <span style={{ margin: '0 8px' }}>|</span>
                      <span>Contact: {schoolContact}</span>
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: '#6b7280',
                      marginBottom: '4px',
                    }}
                  >
                    Total Fees Charged
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#374151' }}>
                    ${(currentOverview.totalInvoiced / 100).toFixed(2)}
                  </div>
                </div>
                <div
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: '#6b7280',
                      marginBottom: '4px',
                    }}
                  >
                    Total Paid
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#059669' }}>
                    ${(currentOverview.totalPaid / 100).toFixed(2)}
                  </div>
                </div>
                <div
                  style={{
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: '#6b7280',
                      marginBottom: '4px',
                    }}
                  >
                    Amount Outstanding
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>
                    ${(currentOverview.balance / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {currentOverview.isGrade ? 'Student Details' : 'Grade Details'}
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                    <tr>
                      <th>Name</th>
                      {currentOverview.isGrade && <th>ID</th>}
                      <th style={{ textAlign: 'right' }}>Amount Owing</th>
                      <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentOverview.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-secondary">
                        <td style={{ fontWeight: 600 }} className="text-display">
                          {row.name}
                        </td>
                        {currentOverview.isGrade && (
                          <td style={{ color: '#6b7280' }}>{row.studentId}</td>
                        )}
                        <td className="text-mono" style={{ fontWeight: 700, textAlign: 'right' }}>
                          ${(row.balance / 100).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: row.status === 'Paid' ? '#D1FAE5' : '#FEE2E2',
                              color: row.status === 'Paid' ? '#065F46' : '#991B1B',
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  border: '2px solid #374151',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f9fafb',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Total Outstanding Balance
                </span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                  ${(currentOverview.balance / 100).toFixed(2)}
                </span>
              </div>

              <div
                style={{
                  marginTop: '30px',
                  paddingTop: '16px',
                  borderTop: '2px dashed #e5e7eb',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#6b7280',
                }}
              >
                <div>
                  This report was generated using{' '}
                  <span style={{ fontWeight: 600, color: '#f97316' }}>FeesFoundry</span> - a product
                  of <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
                </div>
                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                  For support, contact your school administrator or visit www.jiggabyte.co.zm
                </div>
              </div>
            </div>
          </>
        )}

        {!showPrintView && !currentOverview && (
          <div
            className="card-surface"
            style={{
              padding: '64px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                backgroundColor: 'var(--secondary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.2, color: 'var(--text-secondary)' }}
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M7 15h.01"></path>
                <path d="M11 15h.01"></path>
              </svg>
            </div>
            <p className="metric-label" style={{ opacity: 0.4 }}>
              Syncing Financial Data Layer...
            </p>
          </div>
        )}
      </div>
      {showWizard && (
        <StudentWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
            loadStudents(selectedGrade);
          }}
        />
      )}
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

      {/* Print All Statements Hidden View */}
      {allStatementsData.length > 0 && (
        <div className="print-only" style={{ display: 'block', backgroundColor: 'white' }}>
          {allStatementsData.map((data, idx) => (
            <div
              key={idx}
              className="a4-page"
              style={{
                position: 'relative',
                padding: '20mm',
                pageBreakAfter: 'always',
                color: 'black',
                minHeight: 'auto',
                boxShadow: 'none',
                border: 'none',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  borderBottom: '2px solid #EEE',
                  paddingBottom: '24px',
                  marginBottom: '24px',
                }}
              >
                {schoolLogo && (
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={schoolLogo}
                      alt="School Logo"
                      style={{ maxHeight: '60px', maxWidth: '150px' }}
                    />
                  </div>
                )}
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px 0' }}>
                  {schoolName}
                </h2>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>
                  Statement of Account • {data.generatedAt}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '24px',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0' }}>
                    {data.student.full_name}
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>
                      {data.student.grade_label}
                    </span>
                    <span style={{ fontSize: '12px' }}>ID: {data.student.id}</span>
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <div>
                      Guardian: {data.student.guardian_name} | {data.student.guardian_contact}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      padding: '4px 10px',
                      border: '1px solid #000',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {data.balance > 0 ? 'Owing' : 'Paid'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ border: '1px solid #EEE', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Invoiced</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>
                    ${(data.totalFees / 100).toFixed(2)}
                  </div>
                </div>
                <div style={{ border: '1px solid #EEE', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Paid</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>
                    ${(data.totalPaid / 100).toFixed(2)}
                  </div>
                </div>
                <div style={{ border: '1px solid #000', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase' }}>Balance</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>
                    ${(data.balance / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Detail</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fees.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #EEE' }}>
                      <td style={{ padding: '8px' }}>
                        {item.term_label}: {item.description}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        ${(item.amount / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {data.payments.map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #EEE' }}>
                      <td style={{ padding: '8px' }}>
                        Payment - {item.date} (Ref: {item.ref})
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        -${(item.amount / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  marginTop: '20px',
                  padding: '16px',
                  border: '2px solid #374151',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f9fafb',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Account Balance
                </span>
                <span style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                  ${(data.balance / 100).toFixed(2)}
                </span>
              </div>

              <div
                style={{
                  marginTop: '30px',
                  paddingTop: '16px',
                  borderTop: '2px dashed #e5e7eb',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#6b7280',
                }}
              >
                <div>
                  This statement was generated using{' '}
                  <span style={{ fontWeight: 600, color: '#f97316' }}>FeesFoundry</span> - a product
                  of <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
                </div>
                <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                  For support, contact your school administrator or visit www.jiggabyte.co.zm
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print Overview Hidden View - always rendered for printing */}
      {currentOverview && (
        <div className="print-only" style={{ display: 'block', backgroundColor: 'white' }}>
          <div
            className="a4-page"
            style={{
              position: 'relative',
              padding: '20mm',
              pageBreakAfter: 'always',
              color: 'black',
              minHeight: 'auto',
              boxShadow: 'none',
              border: 'none',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                borderBottom: '2px solid #f97316',
                paddingBottom: '20px',
                marginBottom: '24px',
              }}
            >
              {schoolLogo && (
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={schoolLogo}
                    alt="School Logo"
                    style={{ maxHeight: '60px', maxWidth: '150px' }}
                  />
                </div>
              )}
              <h2
                style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#1f2937' }}
              >
                {schoolName}
              </h2>
              <div
                style={{ fontSize: '16px', fontWeight: 600, color: '#f97316', marginBottom: '8px' }}
              >
                {currentOverview.isGrade
                  ? `Grade Report: ${grades.find(g => g.id === selectedGrade)?.label}`
                  : 'Master Financial Overview'}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {termsList.length > 0 && <span>Term: {termsList[0].label}</span>}
                <span style={{ margin: '0 8px' }}>|</span>
                <span>
                  Generated:{' '}
                  {new Date().toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                {schoolContact && (
                  <>
                    <span style={{ margin: '0 8px' }}>|</span>
                    <span>Contact: {schoolContact}</span>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '28px',
              }}
            >
              <div
                style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: '#6b7280',
                    marginBottom: '4px',
                  }}
                >
                  Total Fees Charged
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#374151' }}>
                  ${(currentOverview.totalInvoiced / 100).toFixed(2)}
                </div>
              </div>
              <div
                style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: '#6b7280',
                    marginBottom: '4px',
                  }}
                >
                  Total Paid
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#059669' }}>
                  ${(currentOverview.totalPaid / 100).toFixed(2)}
                </div>
              </div>
              <div
                style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: '#6b7280',
                    marginBottom: '4px',
                  }}
                >
                  Amount Outstanding
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>
                  ${(currentOverview.balance / 100).toFixed(2)}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {currentOverview.isGrade ? 'Student Details' : 'Grade Details'}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #374151' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '12px 10px',
                      fontWeight: 600,
                      fontSize: '12px',
                      color: '#374151',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    Name
                  </th>
                  {currentOverview.isGrade && (
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px 10px',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: '#374151',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      ID
                    </th>
                  )}
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '12px 10px',
                      fontWeight: 600,
                      fontSize: '12px',
                      color: '#374151',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    Amount Owing
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '12px 10px',
                      fontWeight: 600,
                      fontSize: '12px',
                      color: '#374151',
                      backgroundColor: '#f9fafb',
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentOverview.rows.map((row: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>{row.name}</td>
                    {currentOverview.isGrade && (
                      <td style={{ padding: '12px 10px', color: '#6b7280' }}>{row.studentId}</td>
                    )}
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600 }}>
                      ${(row.balance / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: row.status === 'Paid' ? '#D1FAE5' : '#FEE2E2',
                          color: row.status === 'Paid' ? '#065F46' : '#991B1B',
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                border: '2px solid #374151',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9fafb',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                Total Outstanding Balance
              </span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>
                ${(currentOverview.balance / 100).toFixed(2)}
              </span>
            </div>

            <div
              style={{
                marginTop: '30px',
                paddingTop: '16px',
                borderTop: '2px dashed #e5e7eb',
                textAlign: 'center',
                fontSize: '11px',
                color: '#6b7280',
              }}
            >
              <div>
                This report was generated using{' '}
                <span style={{ fontWeight: 600, color: '#f97316' }}>FeesFoundry</span> - a product
                of <span style={{ color: '#374151' }}>Jiggabyte Technology Limited</span>
              </div>
              <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                For support, contact your school administrator or visit www.jiggabyte.co.zm
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAccounts;
