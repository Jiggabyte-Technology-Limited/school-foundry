import React, { useState, useEffect } from 'react';
import { db } from '../lib/db-client';
import StudentWizard from './StudentWizard';
import EditStudentModal from './EditStudentModal';
import PaymentWizard from './PaymentWizard';
import StudentStatementPreview from './StudentStatementPreview';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';
import FinancialOverviewPanel from './student-accounts/FinancialOverviewPanel';
import StudentAccountsFilters from './student-accounts/StudentAccountsFilters';
import StudentAccountsTable from './student-accounts/StudentAccountsTable';
import { buildOverviewData } from './student-accounts/overview';
import type { AcademicYear, Grade, Student, Term } from './student-accounts/types';
import ManageListsModal from './student-accounts/ManageListsModal';
import { formatListChip, type ListRow } from './student-accounts/custom-list-selectors';

interface StudentAccountsProps {
  preselectedStudentId?: number | null;
  onStatementViewed?: () => void;
}

const StudentAccounts: React.FC<StudentAccountsProps> = ({
  preselectedStudentId,
  onStatementViewed,
}) => {
  const { user, canManageStudents } = useAuth();
  const { showLoading, updateLoading, dismissToast, showToast } = useToast();
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
  const [showInactive, setShowInactive] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isPrintingAll, setIsPrintingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('School Management');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolContact, setSchoolContact] = useState<string>('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Custom Lists (Task 6): the active list, the page-loadable set of
  // available lists, and a flag for opening the ManageListsModal.
  const [activeList, setActiveList] = useState<ListRow | null>(null);
  const [activeListMembers, setActiveListMembers] = useState<number[] | null>(null);
  const [listsAvailable, setListsAvailable] = useState<ListRow[]>([]);
  const [showManageListsModal, setShowManageListsModal] = useState(false);

  // Early return for loading state - before any computations
  const statusFilteredStudents = students.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.id).includes(searchQuery);
    const isPaid = s.balance <= 0;
    const isOwing = s.balance > 0;
    const matchesStatus = (showPaid && isPaid) || (showOwing && isOwing);
    // When showInactive is false, only show active students
    // When showInactive is true, show all students
    // Default to active (1) if is_active is undefined
    const isActive = s.is_active !== undefined ? s.is_active : 1;
    const matchesActive = showInactive ? true : isActive === 1;
    return matchesSearch && matchesStatus && matchesActive;
  });

  // Task 6 — Custom Lists: intersect the active list's members over
  // the status-filtered set. Null = "no list filter applied".
  const filteredStudents = activeListMembers === null
    ? statusFilteredStudents
    : statusFilteredStudents.filter(s => activeListMembers.includes(s.id));

  const printAllStatements = async () => {
    if (filteredStudents.length === 0) {
      if (activeList) {
        showToast(
          'error',
          'Active list is empty',
          `Add members to "${activeList.name}" in Manage Lists, or clear the active list.`
        );
      }
      return;
    }
    setIsPrintingAll(true);

    const loadingId = showLoading(
      'Preparing Statements',
      `Loading data for ${filteredStudents.length} learner(s)...`
    );

    const statements: Array<{
      filename: string;
      workbook: {
        sheetName: string;
        topRows?: Array<{ value: string; styleId?: number; mergeAcross?: number }>;
        columns: Array<{ key: string; header: string; width?: number; type?: string }>;
        rows: Array<Record<string, any>>;
        summaryRows?: Array<{
          label: string;
          value: string | number;
          valueType?: string;
          valueStyleId?: number;
        }>;
        freezeRows?: number;
        autoFilter?: boolean;
      };
    }> = [];
    const totalStudents = filteredStudents.length;

    for (let i = 0; i < filteredStudents.length; i++) {
      const student = filteredStudents[i];
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
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE sf.student_id = ? AND fs.year_id = ?
                ORDER BY sf.debit_date`,
            [student.id, selectedYear]
          ),
        ]);

        const totalFees = fees.reduce((sum: number, f: any) => sum + f.amount, 0);
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const balance = totalFees - totalPaid;

        statements.push({
          filename: `statement_${student.full_name.replace(/\s+/g, '_')}_${student.id}`,
          workbook: {
            sheetName: 'Statement',
            topRows: [
              { value: schoolName, mergeAcross: 3 },
              { value: `Learner Statement: ${student.full_name}`, mergeAcross: 3 },
              {
                value: `Grade: ${student.grade_label || '-'} | Student ID: ${student.id}`,
                mergeAcross: 3,
              },
              {
                value:
                  [
                    `Guardian: ${student.guardian_name || '-'}`,
                    `Contact: ${student.guardian_contact || '-'}`,
                  ].join(' | '),
                mergeAcross: 3,
              },
              {
                value:
                  [new Date().toLocaleDateString(), schoolContact].filter(Boolean).join(' | ') ||
                  'Learner statement export',
                mergeAcross: 3,
              },
            ],
            columns: [
              { key: 'date', header: 'Date', width: 14 },
              { key: 'type', header: 'Type', width: 12 },
              { key: 'details', header: 'Details', width: 42 },
              { key: 'amount', header: 'Amount', width: 16, type: 'currency' },
            ],
            rows: [
              ...fees.map((f: any) => ({
                date: f.date,
                type: 'Fee',
                details: `${f.term_label || ''}${f.description ? `: ${f.description}` : ''}`.replace(
                  /^:\s*/,
                  ''
                ),
                amount: f.amount / 100,
              })),
              ...payments.map((p: any) => ({
                date: p.date,
                type: 'Payment',
                details: `Receipt Number: ${p.ref}`,
                amount: p.amount / 100,
              })),
            ].sort((a, b) => {
              if (!a.date) return 1;
              if (!b.date) return -1;
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            }),
            summaryRows: [
              {
                label: 'Total Invoiced',
                value: totalFees / 100,
                valueType: 'currency',
              },
              {
                label: 'Total Paid',
                value: totalPaid / 100,
                valueType: 'currency',
              },
              {
                label: 'Balance',
                value: balance / 100,
                valueType: 'currency',
              },
            ],
            freezeRows: 6,
            autoFilter: true,
          },
        });

        const progress = Math.round(((i + 1) / totalStudents) * 50);
        updateLoading(loadingId, progress, `Loading data for ${student.full_name}...`);
      } catch (err) {
        console.error(`Error loading statement for student ${student.id}:`, err);
      }
    }

    updateLoading(loadingId, 60, 'Generating Excel workbooks...');

    updateLoading(loadingId, 80, 'Creating ZIP file...');

    const listSuffix = activeList
      ? `_${activeList.name.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 32)}`
      : '';
    const result = await window.api.exportXlsxStatementsToZip({
      suggestedFileName: `Student_Statements${listSuffix}_${new Date().toISOString().slice(0, 10)}`,
      statements,
    });

    dismissToast(loadingId);

    if (result.success) {
      showToast('success', 'Statements Downloaded', `Saved to ${result.filePath}`);
    } else if (!result.canceled) {
      showToast('error', 'Download Failed', result.error || 'Unknown error');
    }

    setIsPrintingAll(false);
  };
  const [showWizard, setShowWizard] = useState(false);
  const [showPaymentWizard, setShowPaymentWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setSelectedStudent(student);
    setShowEditModal(true);
  };

  const handleDeactivateStudent = async (student: Student) => {
    if (
      !confirm(
        `Are you sure you want to deactivate ${student.full_name}? They will not be able to receive new fees or record payments.`
      )
    ) {
      return;
    }
    try {
      await db.run('UPDATE students SET is_active = 0, deactivated_at = datetime(\'now\') WHERE id = ?', [student.id]);
      await db.run('UPDATE student_year_enrollment SET is_active = 0 WHERE student_id = ?', [
        student.id,
      ]);
      loadStudents(selectedGrade);
    } catch (err) {
      console.error('Error deactivating student:', err);
    }
  };

  const handleActivateStudent = async (student: Student) => {
    try {
      await db.run('UPDATE students SET is_active = 1, deactivated_at = NULL WHERE id = ?', [student.id]);
      await db.run('UPDATE student_year_enrollment SET is_active = 1 WHERE student_id = ?', [
        student.id,
      ]);
      loadStudents(selectedGrade);
    } catch (err) {
      console.error('Error activating student:', err);
    }
  };

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
    loadLists();

    // Safety timeout - ensure loading stops after 10 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  // Custom Lists helpers — keep tiny and reversible so any list edit
  // by the ManageListsModal forces a refresh here.
  const loadLists = async () => {
    try {
      const ls = await db.all(
        `SELECT id, name, description, created_at, updated_at, deleted_at
           FROM custom_lists
           WHERE deleted_at IS NULL
           ORDER BY name COLLATE NOCASE`
      );
      setListsAvailable(ls as ListRow[]);
      // If the active list was just archived (deleted_at flipped),
      // drop the active state so the UI falls back to "all students".
      if (activeList) {
        const stillThere = (ls as ListRow[]).some(l => l.id === activeList.id);
        if (!stillThere) {
          setActiveList(null);
          setActiveListMembers(null);
        }
      }
    } catch (err) {
      console.error('Error loading custom lists:', err);
    }
  };

  const setActiveListAndLoadMembers = async (list: ListRow | null) => {
    if (!list) {
      setActiveList(null);
      setActiveListMembers(null);
      return;
    }
    setActiveList(list);
    try {
      const rows = await db.all(
        `SELECT student_id FROM custom_list_members WHERE list_id = ?`,
        [list.id]
      );
      setActiveListMembers(rows.map((r: any) => Number(r.student_id)));
    } catch (err) {
      console.error('Error loading list members:', err);
      setActiveListMembers([]);
    }
  };

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
      setLoading(false);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setLoading(false);
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
      // Get all students first, then get grade info separately
      const allStudents = await db.all('SELECT * FROM students ORDER BY full_name');

      // Get enrollments for the selected year
      const enrollments = await db.all('SELECT * FROM student_year_enrollment WHERE year_id = ?', [
        selectedYear,
      ]);

      // Get grades and class sections
      const [grades, classSections] = await Promise.all([
        db.all('SELECT * FROM grades'),
        db.all('SELECT id, grade_id, label FROM class_sections'),
      ]);
      const gradeMap = Object.fromEntries(grades.map((g: any) => [g.id, g]));
      const sectionMap = Object.fromEntries(classSections.map((c: any) => [c.id, c]));

      // Build enrollment map - keep the active one if exists, otherwise keep the latest
      const enrollmentMap: Record<number, any> = {};
      for (const e of enrollments) {
        if (!enrollmentMap[e.student_id]) {
          enrollmentMap[e.student_id] = e;
        } else if (e.is_active === 1) {
          // Prefer active enrollment
          enrollmentMap[e.student_id] = e;
        }
      }

      // Calculate financials for each student
      const studentsWithData = await Promise.all(
        allStudents.map(async (s: any) => {
          const enrollment = enrollmentMap[s.id];
          const grade = enrollment ? gradeMap[enrollment.grade_id] : null;
          const classSection = enrollment?.class_section_id ? sectionMap[enrollment.class_section_id] : null;

          // Get invoiced - include all enrollments (active and inactive) to show historical fees
          const invoiced = await db.get(
            `
            SELECT COALESCE(SUM(sf.amount_cents), 0) as total
            FROM student_fees sf
            JOIN fee_structure fs ON sf.fee_structure_id = fs.id
            JOIN terms t ON fs.term_id = t.id
            JOIN student_year_enrollment enrollment ON enrollment.student_id = sf.student_id AND enrollment.year_id = fs.year_id
            WHERE sf.student_id = ? AND fs.year_id = ?
              AND (t.end_date IS NULL OR date(t.end_date) >= date(enrollment.created_at))
          `,
            [s.id, selectedYear]
          );

          const paid = await db.get(
            `
            SELECT COALESCE(SUM(amount_paid_cents), 0) as total
            FROM payments WHERE student_id = ? AND year_id = ? AND is_voided = 0
          `,
            [s.id, selectedYear]
          );

          return {
            ...s,
            grade_id: enrollment?.grade_id,
            class_section_id: enrollment?.class_section_id,
            grade_label: classSection ? `${grade?.label} - ${classSection.label}` : grade?.label,
            invoiced: invoiced?.total || 0,
            paid: paid?.total || 0,
            balance: (invoiced?.total || 0) - (paid?.total || 0),
          };
        })
      );

      // Filter by grade if needed - compare as numbers
      let result = studentsWithData;
      if (gradeId) {
        result = result.filter((s: any) => Number(s.grade_id) === Number(gradeId));
      }

      setStudents(result);
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

  // Handle preselected student from Dashboard
  useEffect(() => {
    if (preselectedStudentId && students.length > 0) {
      const student = students.find(s => s.id === preselectedStudentId);
      if (student) {
        void viewStatement(student);
        onStatementViewed?.();
      }
    }
  }, [preselectedStudentId, students]);

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
    setShowPrintView(false);
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
                LEFT JOIN terms t ON fs.term_id = t.id
                WHERE sf.student_id = ? AND fs.year_id = ?
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
      setShowPrintView(true);
    } catch (err: any) {
      console.error('Error loading statement:', err);
      setDetailError(err.message || 'Failed to load financial records');
      setShowPrintView(true);
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

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 40px',
          gap: '16px',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
        }}
        className="text-display"
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid #e5e7eb',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ color: '#6b7280', fontSize: '14px' }}>Loading accounts...</span>
      </div>
    );
  }

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to manage learners.</p>
      </div>
    );
  }

  return (
    <>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--secondary)',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <span
              className="text-display"
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-secondary)',
              }}
            >
              Saved Lists
            </span>
            {activeList ? (
              <>
                <span
                  className="chip chip-active text-display"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  title={`Filtering by "${activeList.name}"`}
                >
                  {formatListChip(activeList.name, activeListMembers?.length ?? 0)}
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setActiveListAndLoadMembers(null)}
                  style={{
                    padding: '2px 10px',
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                  }}
                >
                  Clear
                </button>
              </>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                }}
              >
                No list selected — showing all students.
              </span>
            )}
            <span style={{ flex: 1 }} />
            <select
              aria-label="Apply a saved list"
              value=""
              onChange={async e => {
                const v = e.target.value;
                e.target.value = '';
                if (v === '__manage__') {
                  setShowManageListsModal(true);
                  return;
                }
                if (v === '') return;
                const list = listsAvailable.find(l => String(l.id) === v);
                if (list) await setActiveListAndLoadMembers(list);
              }}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Apply list…</option>
              <option value="__manage__">Manage lists…</option>
              {listsAvailable.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <StudentAccountsFilters
            grades={grades}
            selectedGrade={selectedGrade}
            showPaid={showPaid}
            showOwing={showOwing}
            searchQuery={searchQuery}
            filteredStudents={filteredStudents}
            isPrintingAll={isPrintingAll}
            showInactive={showInactive}
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
            onToggleInactive={() => setShowInactive(!showInactive)}
          />

          <StudentAccountsTable
            students={filteredStudents}
            selectedStudent={selectedStudent}
            onViewStatement={viewStatement}
            onEditStudent={handleEditStudent}
            onDeactivateStudent={handleDeactivateStudent}
            onActivateStudent={handleActivateStudent}
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
              onRecordPayment={() => {
                if (selectedStudent?.is_active === 0) {
                  alert('Cannot record payment for inactive learner');
                  return;
                }
                setShowPaymentWizard(true);
              }}
              onRetry={() => viewStatement(selectedStudent)}
              activeListName={activeList?.name ?? null}
            />
          )}
          {!showPrintView && selectedStudent && isLoadingDetail && (
            <div
              className="card-surface"
              style={{
                minHeight: 420,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  border: '4px solid var(--secondary)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                Loading learner statement...
              </div>
            </div>
          )}
          {!showPrintView && !selectedStudent && currentOverview && (
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
          )}
        </div>
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

      {showEditModal && editingStudent && selectedYear && (
        <EditStudentModal
          studentId={editingStudent.id}
          yearId={selectedYear}
          onClose={() => {
            setShowEditModal(false);
            setEditingStudent(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingStudent(null);
            loadStudents(selectedGrade);
            if (selectedStudent) viewStatement(selectedStudent);
          }}
        />
      )}

      {showPaymentWizard && selectedStudent && selectedYear && (
        <PaymentWizard
          preSelectedStudent={selectedStudent.id}
          yearId={selectedYear}
          onClose={() => setShowPaymentWizard(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <ManageListsModal
        open={showManageListsModal}
        onClose={() => setShowManageListsModal(false)}
        onListsChanged={loadLists}
        allStudents={students}
      />
    </>
  );
};

export default StudentAccounts;
