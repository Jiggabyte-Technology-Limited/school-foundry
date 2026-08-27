import React, { useEffect, useState } from 'react';
import { db } from '../lib/db-client';
import { useAuth } from '../lib/auth-context';
import { buildClassListTitle } from '../lib/print-service';
import ClassListPrintPreview from './ClassListPrintPreview';
import StudentWizard from './StudentWizard';
import ManageListsModal from './student-accounts/ManageListsModal';
import { formatListChip, type ListRow } from './student-accounts/custom-list-selectors';

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

  // Custom Lists
  const [activeList, setActiveList] = useState<ListRow | null>(null);
  const [listsAvailable, setListsAvailable] = useState<ListRow[]>([]);
  const [showManageListsModal, setShowManageListsModal] = useState(false);

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

  // Custom Lists helpers
  const loadLists = async () => {
    try {
      const ls = await db.all(
        `SELECT id, name, description, created_at, updated_at, deleted_at
           FROM custom_lists
           WHERE deleted_at IS NULL
           ORDER BY name COLLATE NOCASE`
      );
      setListsAvailable(ls as ListRow[]);
      if (activeList) {
        const stillThere = (ls as ListRow[]).some(l => l.id === activeList.id);
        if (!stillThere) {
          setActiveList(null);
        }
      }
    } catch (err) {
      console.error('Error loading custom lists:', err);
    }
  };

  const setActiveListAndLoadMembers = async (list: ListRow | null) => {
    if (!list) {
      setActiveList(null);
      return;
    }
    setActiveList(list);
  };

  useEffect(() => {
    loadLists();
  }, []);

  const loadStudents = async () => {
    if (selectedGrade === null) return;

    try {
      const year = await db.get('SELECT id FROM academic_years ORDER BY label DESC LIMIT 1');
      if (!year) return;

      let query = `
        SELECT s.id, s.student_number, s.full_name, s.gender, s.is_active, s.is_vulnerable_child,
               e.grade_id,
               CASE
                 WHEN c.label IS NULL OR c.label = '' THEN g.label
                 ELSE g.label || ' - ' || c.label
               END as grade_label,
               e.class_section_id, c.label as class_section_label,
               sp.name as subsidy_provider_name,
               CASE
                 WHEN ss.id IS NOT NULL AND ss.prevent_academic_exclusion = 1 THEN 1
                 WHEN s.is_vulnerable_child = 1 THEN 1
                 ELSE 0
               END as is_protected
        FROM students s
        JOIN student_year_enrollment e ON s.id = e.student_id
        JOIN grades g ON e.grade_id = g.id
        LEFT JOIN class_sections c ON e.class_section_id = c.id
        LEFT JOIN student_subsidies ss ON s.id = ss.student_id AND ss.year_id = e.year_id AND ss.is_active = 1
        LEFT JOIN subsidy_providers sp ON ss.provider_id = sp.id
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
      setStudents(result.map((r: any) => ({
        ...r,
        is_protected: Boolean(r.is_protected),
      })));
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
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          background: 'var(--background)',
        }}
      >
        {/* Custom Lists — full width at top */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--secondary)',
            borderRadius: 10,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              className="text-display"
              style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}
            >
              Custom Lists
            </span>
            {activeList ? (
              <>
                <span className="chip chip-active text-display" style={{ padding: '4px 10px', fontSize: 12 }}>
                  {formatListChip(activeList.name, 0)}
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setActiveListAndLoadMembers(null)}
                  style={{ padding: '2px 10px', fontSize: 12, border: '1px solid var(--border)', background: 'transparent' }}
                >
                  Clear
                </button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No list selected
              </span>
            )}
            <span style={{ flex: 1 }} />
            <select
              aria-label="Apply a saved list"
              value=""
              onChange={async e => {
                const v = e.target.value;
                e.target.value = '';
                if (v === '__manage__') { setShowManageListsModal(true); return; }
                if (v === '') return;
                const list = listsAvailable.find(l => String(l.id) === v);
                if (list) await setActiveListAndLoadMembers(list);
              }}
              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
            >
              <option value="">Apply list…</option>
              <option value="__manage__">Manage lists…</option>
              {listsAvailable.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Two columns below: grade selector + preview */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 210mm',
            gap: '24px',
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

          {/* Preview */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
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

      <ManageListsModal
        open={showManageListsModal}
        onClose={() => setShowManageListsModal(false)}
        onListsChanged={loadLists}
        allStudents={[]}
      />
    </>
  );
};

export default ClassLists;
