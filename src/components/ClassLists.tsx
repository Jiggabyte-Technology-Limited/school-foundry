import React, { useEffect, useState } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { buildClassListTitle } from '../lib/print-service';
import ClassListPrintPreview from './ClassListPrintPreview';
import StudentWizard from './StudentWizard';

interface Student {
  id: number;
  student_number: string;
  full_name: string;
  gender: string;
  grade_id: number;
  grade_label: string;
  class_section_id: number | null;
  class_section_label: string | null;
  is_active?: number;
}

interface Grade {
  id: number;
  label: string;
}

interface ClassSection {
  id: number;
  grade_id: number;
  label: string;
}

interface ClassListsProps {
  onViewStudentAccount?: (studentId: number) => void;
}

const ClassLists: React.FC<ClassListsProps> = ({ onViewStudentAccount }) => {
  const { canManageStudents } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enableSubgrades, setEnableSubgrades] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeCounts, setGradeCounts] = useState<Record<number, number>>({});
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [schoolName, setSchoolName] = useState('School Management');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolContact, setSchoolContact] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [setting, nameSetting, logoSetting, phoneSetting, emailSetting] = await Promise.all([
        db.get("SELECT value FROM app_settings WHERE key = 'enable_subgrades'"),
        db.get("SELECT value FROM app_settings WHERE key = 'school_name'"),
        db.get("SELECT value FROM app_settings WHERE key = 'school_logo'"),
        db.get("SELECT value FROM app_settings WHERE key = 'school_phone'"),
        db.get("SELECT value FROM app_settings WHERE key = 'school_email'"),
      ]);

      const isSubgradesEnabled = setting?.value === 'true';
      setEnableSubgrades(isSubgradesEnabled);
      setSchoolName(nameSetting?.value || 'School Management');
      setSchoolLogo(logoSetting?.value || null);
      setSchoolContact(
        [phoneSetting?.value || '', emailSetting?.value || ''].filter(Boolean).join(' | ')
      );

      const [gradesData, sectionsData] = await Promise.all([
        db.all('SELECT * FROM grades ORDER BY id ASC'),
        isSubgradesEnabled
          ? db.all('SELECT * FROM class_sections ORDER BY grade_id ASC, label ASC')
          : Promise.resolve([]),
      ]);

      setGrades(gradesData);
      setClassSections(sectionsData);
      if (gradesData.length > 0) {
        setSelectedGrade(gradesData[0].id);
        setSelectedSection(null);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGrade !== null) {
      loadStudents();
    }
  }, [selectedGrade, selectedSection, showInactive]);

  useEffect(() => {
    if (grades.length > 0) {
      loadGradeCounts();
    }
  }, [grades, showInactive]);

  const loadGradeCounts = async () => {
    try {
      const year = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
      if (!year) return;

      let query = `
        SELECT e.grade_id, COUNT(DISTINCT s.id) as count
        FROM students s
        JOIN student_year_enrollment e ON s.id = e.student_id
        WHERE e.year_id = ?
      `;
      const params: Array<number> = [year.id];

      if (!showInactive) {
        query += ` AND e.is_active = 1`;
      }

      query += ` GROUP BY e.grade_id`;

      const result = await db.all(query, params);
      const nextCounts: Record<number, number> = {};
      for (const row of result) {
        nextCounts[row.grade_id] = row.count;
      }
      setGradeCounts(nextCounts);
    } catch (err) {
      console.error('Error loading grade counts:', err);
    }
  };

  const loadStudents = async () => {
    if (selectedGrade === null) return;

    try {
      const year = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
      if (!year) return;

      let query = `
        SELECT s.id, s.student_number, s.full_name, s.gender, s.is_active,
               e.grade_id,
               CASE
                 WHEN c.label IS NULL OR c.label = '' THEN g.label
                 ELSE g.label || ' - ' || c.label
               END as grade_label,
               e.class_section_id, c.label as class_section_label
        FROM students s
        JOIN student_year_enrollment e ON s.id = e.student_id
        JOIN grades g ON e.grade_id = g.id
        LEFT JOIN class_sections c ON e.class_section_id = c.id
        WHERE e.year_id = ? AND e.grade_id = ?
      `;
      const params = [year.id, selectedGrade];

      if (!showInactive) {
        query += ` AND e.is_active = 1`;
      }

      if (selectedSection !== null) {
        query += ` AND e.class_section_id = ?`;
        params.push(selectedSection);
      }

      query += ` ORDER BY s.full_name ASC`;

      const result = await db.all(query, params);
      setStudents(result);
    } catch (err) {
      console.error('Error loading students for class list:', err);
    }
  };

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <div>Loading Class Lists...</div>
      </div>
    );
  }

  if (!canManageStudents) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3 style={{ color: '#ef4444' }}>Access Denied</h3>
        <p>You do not have permission to view class lists.</p>
      </div>
    );
  }

  const selectedGradeLabel = grades.find(grade => grade.id === selectedGrade)?.label || '';
  const selectedSectionLabel =
    classSections.find(section => section.id === selectedSection)?.label || null;
  const classListTitle = buildClassListTitle(selectedGradeLabel, selectedSectionLabel);
  const generatedAt = new Date().toLocaleDateString();
  const academicYear = String(new Date().getFullYear());

  return (
    <>
      <div
        className="page-content"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 210mm',
          gap: '24px',
          background: 'var(--background)',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="flex-between" style={{ gap: '16px', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">
              Class Lists
            </h2>
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
              Add Learner
            </button>
          </div>

          <div className="card-surface" style={{ padding: '24px', position: 'sticky', top: '24px' }}>
            <div className="flex-between mb-4">
              <div className="metric-label" style={{ margin: 0 }}>
                Filter by Grade/Form
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#374151',
                }}
              >
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={event => setShowInactive(event.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Inactive
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {grades.map(grade => {
                const isGradeSelected = selectedGrade === grade.id;
                const gradeSections = classSections.filter(
                  section => section.grade_id === grade.id
                );
                const isAllLearnersSelected = isGradeSelected && selectedSection === null;

                return (
                  <div
                    key={grade.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedGrade(grade.id);
                      setSelectedSection(null);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedGrade(grade.id);
                        setSelectedSection(null);
                      }
                    }}
                    style={{
                      border: isGradeSelected
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border)',
                      borderRadius: '8px',
                      background: isGradeSelected ? 'var(--primary-light)' : 'var(--surface)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px 10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          color: isGradeSelected ? 'var(--primary)' : 'var(--text-primary)',
                          fontWeight: isGradeSelected ? 700 : 600,
                          fontSize: '15px',
                        }}
                      >
                        {grade.label}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isGradeSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          background: isGradeSelected ? 'white' : 'var(--secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '999px',
                          padding: '4px 10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {gradeCounts[grade.id] ?? 0} learners
                      </div>
                    </div>

                    {enableSubgrades && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          padding: '0 14px 14px 14px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            setSelectedGrade(grade.id);
                            setSelectedSection(null);
                          }}
                          className={`chip text-display ${
                            isAllLearnersSelected ? 'chip-active' : ''
                          }`}
                          style={{
                            border: 'none',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          All Learners
                        </button>

                        {gradeSections.map(section => {
                          const isSectionSelected =
                            isGradeSelected && selectedSection === section.id;

                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setSelectedGrade(grade.id);
                                setSelectedSection(section.id);
                              }}
                              className={`chip text-display ${isSectionSelected ? 'chip-active' : ''}`}
                              style={{
                                border: 'none',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {section.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 'calc(100vh - 120px)',
            alignItems: 'flex-end',
            minWidth: 0,
          }}
        >
          <ClassListPrintPreview
            title={classListTitle}
            academicYear={academicYear}
            generatedAt={generatedAt}
            schoolName={schoolName}
            schoolLogo={schoolLogo}
            schoolContact={schoolContact}
            students={students}
            onSelectStudent={onViewStudentAccount}
          />
        </div>
      </div>

      {showWizard && (
        <StudentWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
            loadStudents();
          }}
          preSelectedGrade={selectedGrade || undefined}
          preSelectedClassSection={selectedSection || undefined}
        />
      )}
    </>
  );
};

export default ClassLists;
