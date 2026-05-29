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
  showInactive: boolean;
  onAddStudent: () => void;
  onSelectGrade: (gradeId: number | null) => void;
  onTogglePaid: () => void;
  onToggleOwing: () => void;
  onSearchChange: (value: string) => void;
  onPrintAll: () => void;
  onToggleInactive: () => void;
}

const StudentAccountsFilters: React.FC<StudentAccountsFiltersProps> = ({
  grades,
  selectedGrade,
  showPaid,
  showOwing,
  searchQuery,
  filteredStudents,
  isPrintingAll,
  showInactive,
  onAddStudent,
  onSelectGrade,
  onTogglePaid,
  onToggleOwing,
  onSearchChange,
  onPrintAll,
  onToggleInactive,
}) => (
  <>
    <div className="flex-between">
      <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }} className="text-display">
        Learner Accounts
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
        Add Learner
      </button>
    </div>

    <div className="card-surface">
      <div className="flex-between mb-4">
        <div className="metric-label" style={{ margin: 0 }}>
          Filter by Grade/Form
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
              checked={showPaid}
              onChange={onTogglePaid}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            Paid in Full
          </label>
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
              checked={showOwing}
              onChange={onToggleOwing}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            Owing
          </label>
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
              onChange={onToggleInactive}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
            Inactive
          </label>
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

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
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
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '4px',
              marginLeft: '2px',
            }}
          >
            {filteredStudents.length} learner{filteredStudents.length !== 1 ? 's' : ''} found
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          {isPrintingAll ? 'Preparing...' : 'Download Statements'}
        </button>
      </div>
    </div>
  </>
);

export default StudentAccountsFilters;
