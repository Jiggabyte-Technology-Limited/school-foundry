import React from 'react';
import { formatCurrencyCents, getBalanceColor } from './formatters';
import type { Student } from './types';

interface StudentAccountsTableProps {
  students: Student[];
  selectedStudent: Student | null;
  onViewStatement: (student: Student) => void;
  onEditStudent: (student: Student) => void;
  onDeactivateStudent: (student: Student) => void;
  onActivateStudent: (student: Student) => void;
}

const StudentAccountsTable: React.FC<StudentAccountsTableProps> = ({
  students,
  selectedStudent,
  onViewStatement,
  onEditStudent,
  onDeactivateStudent,
  onActivateStudent,
}) => (
  <div className="card-surface" style={{ padding: 0, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <tr>
          <th style={{ width: '60px' }}>ID</th>
          <th>Name</th>
          <th>Grade</th>
          <th style={{ textAlign: 'right' }}>Balance</th>
          <th style={{ width: '140px', textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {students.map(student => {
          const isSelected = selectedStudent?.id === student.id;
          const isInactive = student.is_active === 0;
          return (
            <tr
              key={student.id}
              onClick={() => onViewStatement(student)}
              style={{
                cursor: 'pointer',
                backgroundColor: isSelected
                  ? 'rgba(249, 115, 22, 0.08)'
                  : isInactive
                    ? 'rgba(0,0,0,0.03)'
                    : 'transparent',
                borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                transition: 'all 0.2s ease',
              }}
              className={isInactive ? '' : 'hover:bg-secondary'}
            >
              <td className="text-mono" style={{ opacity: 0.6, fontSize: '12px' }}>
                {student.id}
              </td>
              <td
                style={{ fontWeight: 600, opacity: isInactive ? 0.6 : 1 }}
                className="text-display"
              >
                {student.full_name}
                {student.is_protected && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: '10px',
                      color: '#065f46',
                      background: '#d1fae5',
                      border: '1px solid #a7f3d0',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                    title={
                      student.subsidy_name
                        ? `Protected under ${student.subsidy_name} (Shielded from exclusion)`
                        : 'Child Safeguarding Protected'
                    }
                  >
                    🛡️ {student.subsidy_name ? 'SPONSORED' : 'PROTECTED'}
                  </span>
                )}
                {isInactive && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: '10px',
                      color: '#ef4444',
                      background: '#fee2e2',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                    title={
                      student.deactivated_at
                        ? `Deactivated on ${new Date(student.deactivated_at).toLocaleString()}`
                        : 'Deactivated'
                    }
                  >
                    INACTIVE
                    {student.deactivated_at
                      ? ` ${new Date(student.deactivated_at).toLocaleDateString()}`
                      : ''}
                  </span>
                )}
              </td>
              <td
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  opacity: isInactive ? 0.6 : 1,
                }}
                className="text-display"
              >
                {student.grade_label}
              </td>
              <td
                className="text-mono"
                style={{
                  fontWeight: 700,
                  textAlign: 'right',
                  color: getBalanceColor(student.balance),
                  opacity: isInactive ? 0.6 : 1,
                }}
              >
                {formatCurrencyCents(student.balance)}
              </td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onEditStudent(student);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#374151',
                    }}
                    title="Edit Profile"
                  >
                    Edit
                  </button>
                  {isInactive ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onActivateStudent(student);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'white',
                      }}
                      title="Activate Learner"
                    >
                      Activate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onDeactivateStudent(student);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        background: '#ef4444',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'white',
                      }}
                      title="Deactivate Learner"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        {students.length === 0 && (
          <tr>
            <td
              colSpan={5}
              style={{
                textAlign: 'center',
                padding: '48px',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
              }}
              className="text-display"
            >
              No learners found matching your filters
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export default StudentAccountsTable;
