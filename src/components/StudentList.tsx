import React from 'react';

interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  balance: number;
}

interface Grade {
  id: number;
  label: string;
}

interface StudentListProps {
  students: Student[];
  filteredStudents: Student[];
  selectedStudent: Student | null;
  selectedGrade: number | null;
  grades: Grade[];
  searchQuery: string;
  isPrintingAll: boolean;
  onSelectStudent: (student: Student) => void;
  onGradeChange: (gradeId: number | null) => void;
  onSearchChange: (query: string) => void;
  onPrintAll: () => void;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  filteredStudents,
  selectedStudent,
  selectedGrade,
  grades,
  searchQuery,
  isPrintingAll,
  onSelectStudent,
  onGradeChange,
  onSearchChange,
  onPrintAll,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="flex-between">
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">
          Student Accounts
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => {}}>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`chip text-display ${selectedGrade === null ? 'chip-active' : ''}`}
              onClick={() => {
                onGradeChange(null);
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
                  onGradeChange(g.id);
                }}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              className="input-default text-display"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
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
            onClick={onPrintAll}
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
                  onClick={() => onSelectStudent(s)}
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
                      color: s.balance > 0 ? '#dc2626' : '#10B981',
                    }}
                  >
                    {s.balance > 0 ? '+$' : s.balance < 0 ? '+$' : ''}
                    {Math.abs(s.balance / 100).toFixed(2)}
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
  );
};

export default StudentList;
