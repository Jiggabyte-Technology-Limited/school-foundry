import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import StudentWizard from './StudentWizard';
import EditStudentModal from './EditStudentModal';
import PaymentWizard from './PaymentWizard';
import StudentStatementPreview from './StudentStatementPreview';
import { useAuth } from '../lib/auth-context';
import { generateStudentStatementHtml, printDocument } from '../lib/print-service';
import FinancialOverviewPanel from './student-accounts/FinancialOverviewPanel';
import StudentAccountsFilters from './student-accounts/StudentAccountsFilters';
import StudentAccountsTable from './student-accounts/StudentAccountsTable';
import { buildOverviewData } from './student-accounts/overview';
import type { AcademicYear, Grade, Student, Term } from './student-accounts/types';

const StudentAccounts: React.FC = () => {
  const { user, canManageStudents } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [termsList, setTermsList] = useState<Term[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<Term | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaid, setShowPaid] = useState(true);
  const [showOwing, setShowOwing] = useState(true);
  const [statementData, setStatementData] = useState<any>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isPrintingAll, setIsPrintingAll] = useState(false);

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
                SELECT DATE(p.payment_date) as date, p.receipt_number as ref, p.amount_paid_cents as amount,
                       'Payment' as type, t.label as term_label
                FROM payments p
                LEFT JOIN terms t ON p.term_id = t.id
                WHERE p.student_id = ? AND p.year_id = ? AND p.is_voided = 0
                ORDER BY p.payment_date`,
            [student.id, selectedYear]
          ),
          db.all(
            `
                SELECT sf.debit_date as date, fs.description, sf.amount_cents as amount, 'Fee' as type,
                       t.label as term_label, fs.fee_type
                FROM student_fees sf
                JOIN fee_structure fs ON sf.fee_structure_id = fs.id
                JOIN student_year_enrollment sye ON sye.student_id = sf.student_id AND sye.year_id = fs.year_id
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE sf.student_id = ? AND fs.year_id = ?
                  AND (t.end_date IS NULL OR date(t.end_date) >= date(sye.created_at))
                ORDER BY sf.debit_date`,
            [student.id, selectedYear]
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
    // Get current period for statements
    const currentTerm = currentPeriod?.label || (termsList.length > 0 ? termsList[0].label : '');

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
          date: f.date,
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
        'SELECT id, label, start_date, end_date FROM terms WHERE year_id = ? ORDER BY term_number ASC',
        [yearId]
      );
      setTermsList(terms);

      // Find current period based on today's date
      const now = new Date().toISOString().split('T')[0];
      const currentPeriod = terms.find(
        (t: any) => t.start_date && t.end_date && t.start_date <= now && t.end_date >= now
      );

      // If no current period found, use first upcoming or last
      const activePeriod =
        currentPeriod || terms.find((t: any) => t.end_date >= now) || terms[terms.length - 1];
      if (activePeriod) {
        setCurrentPeriod(activePeriod);
      }
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
          COALESCE((
            SELECT SUM(sf.amount_cents)
            FROM student_fees sf
            JOIN fee_structure fs ON sf.fee_structure_id = fs.id
            JOIN terms t ON fs.term_id = t.id
            JOIN student_year_enrollment enrollment ON enrollment.student_id = sf.student_id AND enrollment.year_id = fs.year_id
            WHERE sf.student_id = s.id
              AND fs.year_id = ?
              AND (t.end_date IS NULL OR date(t.end_date) >= date(enrollment.created_at))
          ), 0) as invoiced,
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

  const currentOverview = buildOverviewData({
    students,
    grades,
    selectedGrade,
    showPaid,
    showOwing,
  });

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
                SELECT DATE(p.payment_date) as date, p.receipt_number as ref, p.amount_paid_cents as amount,
                       'Payment' as type, t.label as term_label
                FROM payments p
                LEFT JOIN terms t ON p.term_id = t.id
                WHERE p.student_id = ? AND p.year_id = ? AND p.is_voided = 0
                ORDER BY p.payment_date`,
          [student.id, selectedYear]
        ),
        db.all(
          `
                SELECT sf.debit_date as date, fs.description, sf.amount_cents as amount, 'Fee' as type,
                       t.label as term_label, fs.fee_type
                FROM student_fees sf
                JOIN fee_structure fs ON sf.fee_structure_id = fs.id
                JOIN student_year_enrollment sye ON sye.student_id = sf.student_id AND sye.year_id = fs.year_id
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE sf.student_id = ? AND fs.year_id = ?
                  AND (t.end_date IS NULL OR date(t.end_date) >= date(sye.created_at))
                ORDER BY sf.debit_date`,
          [student.id, selectedYear]
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
        <StudentAccountsFilters
          grades={grades}
          selectedGrade={selectedGrade}
          showPaid={showPaid}
          showOwing={showOwing}
          searchQuery={searchQuery}
          filteredStudents={filteredStudents}
          isPrintingAll={isPrintingAll}
          onAddStudent={() => setShowWizard(true)}
          onSelectGrade={gradeId => {
            setSelectedGrade(gradeId);
            setSelectedStudent(null);
            setShowPrintView(false);
          }}
          onTogglePaid={() => setShowPaid(!showPaid)}
          onToggleOwing={() => setShowOwing(!showOwing)}
          onSearchChange={setSearchQuery}
          onPrintAll={printAllStatements}
        />

        <StudentAccountsTable
          students={filteredStudents}
          selectedStudent={selectedStudent}
          onViewStatement={viewStatement}
        />
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
          <FinancialOverviewPanel
            overview={currentOverview}
            grades={grades}
            selectedGrade={selectedGrade}
            schoolName={schoolName}
            schoolLogo={schoolLogo}
            schoolContact={schoolContact}
            currentPeriod={currentPeriod}
            termsList={termsList}
          />
        )}{' '}
      </div>
    </div>
  );
};

export default StudentAccounts;
