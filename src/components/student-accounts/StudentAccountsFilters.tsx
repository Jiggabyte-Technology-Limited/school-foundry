import React from 'react';
import type { Grade, Student } from './types';

interface StudentAccountsFiltersProps {
  grades: Grade[];
  selectedGrade: number | null;
  showPaid: boolean;
  showOwing: boolean;
  searchQuery: string;
  filteredStudents: Student[];
  isPrintingAll: boolean;
  onAddStudent: () => void;
  onSelectGrade: (gradeId: number | null) => void;
  onTogglePaid: () => void;
  onToggleOwing: () => void;
  onSearchChange: (value: string) => void;
  onPrintAll: () => void;
}

const StudentAccountsFilters: React.FC<StudentAccountsFiltersProps> = ({
  grades,
  selectedGrade,
  showPaid,
  showOwing,
  searchQuery,
  filteredStudents,
  isPrintingAll,
  onAddStudent,
  onSelectGrade,
  onTogglePaid,
  onToggleOwing,
  onSearchChange,
  onPrintAll,
}) => (
  <>
    <div className="flex-between">
      <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">
        Student Accounts
      </h2>
      <button className="btn btn-primary" onClick={onAddStudent}>
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

    <div className="card-surface">
      <div className="flex-between mb-4">
        <div className="metric-label" style={{ margin: 0 }}>
          Filter by Grade/Form
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${showPaid ? 'btn-success' : 'btn-outline'}`}
            onClick={onTogglePaid}
            style={{ padding: '4px 12px', fontSize: '11px', opacity: showPaid ? 1 : 0.5 }}
          >
            Paid in Full
          </button>
          <button
            className={`btn ${showOwing ? 'btn-primary' : 'btn-outline'}`}
            onClick={onToggleOwing}
            style={{ padding: '4px 12px', fontSize: '11px', opacity: showOwing ? 1 : 0.5 }}
          >
            Owing
          </button>
        </div>
      </div>

      <div className="chip-list mb-4">
        <button
          className={`chip text-display ${selectedGrade === null ? 'chip-active' : ''}`}
          onClick={() => onSelectGrade(null)}
          style={{ border: 'none', cursor: 'pointer' }}
        >
          All
        </button>
        {grades.map(grade => (
          <button
            key={grade.id}
            className={`chip text-display ${selectedGrade === grade.id ? 'chip-active' : ''}`}
            onClick={() => onSelectGrade(grade.id)}
            style={{ border: 'none', cursor: 'pointer' }}
          >
            {grade.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="input-default text-display"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
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
  </>
);

export default StudentAccountsFilters;
