import React from 'react';
import { formatCurrencyCents, getBalanceColor } from './formatters';
import type { Student } from './types';

interface StudentAccountsTableProps {
  students: Student[];
  selectedStudent: Student | null;
  onViewStatement: (student: Student) => void;
}

const StudentAccountsTable: React.FC<StudentAccountsTableProps> = ({
  students,
  selectedStudent,
  onViewStatement,
}) => (
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
        {students.map(student => {
          const isSelected = selectedStudent?.id === student.id;
          return (
            <tr
              key={student.id}
              onClick={() => onViewStatement(student)}
              style={{
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                transition: 'all 0.2s ease',
              }}
              className="hover:bg-secondary"
            >
              <td className="text-mono" style={{ opacity: 0.6, fontSize: '12px' }}>
                {student.id}
              </td>
              <td style={{ fontWeight: 600 }} className="text-display">
                {student.full_name}
              </td>
              <td
                style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
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
                }}
              >
                {formatCurrencyCents(student.balance)}
              </td>
            </tr>
          );
        })}
        {students.length === 0 && (
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
);

export default StudentAccountsTable;
