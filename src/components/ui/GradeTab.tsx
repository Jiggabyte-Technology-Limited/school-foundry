import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db-client';
import { useToast } from '../Toast';
import ConfirmDialog from './ConfirmDialog';

interface Grade {
  id: number;
  label: string;
}

interface GradeTabProps {
  grades: Grade[];
  selectedYearId: number | null;
  onGradesChange: () => void;
}

const GradeTab: React.FC<GradeTabProps> = ({ grades, selectedYearId, onGradesChange }) => {
  const { showToast } = useToast();
  const [newGradeLabel, setNewGradeLabel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);
  const [studentCounts, setStudentCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    loadStudentCounts();
  }, [grades, selectedYearId]);

  const loadStudentCounts = async () => {
    if (!selectedYearId) {
      setStudentCounts({});
      return;
    }
    const counts: Record<number, number> = {};
    for (const grade of grades) {
      const result = await db.get(
        'SELECT COUNT(*) as count FROM student_year_enrollment WHERE grade_id = ? AND year_id = ? AND is_active = 1',
        [grade.id, selectedYearId]
      );
      counts[grade.id] = result?.count || 0;
    }
    setStudentCounts(counts);
  };

  const handleAdd = async () => {
    if (!newGradeLabel.trim()) {
      showToast('error', 'Error', 'Please enter a grade name.');
      return;
    }
    try {
      await db.run('INSERT INTO grades (label) VALUES (?)', [newGradeLabel.trim()]);
      showToast('success', 'Grade Added', `Grade ${newGradeLabel} has been added.`);
      setNewGradeLabel('');
      onGradesChange();
    } catch (err) {
      console.error('Failed to add grade:', err);
      showToast('error', 'Error', 'Failed to add grade.');
    }
  };

  const handleEdit = async (id: number) => {
    if (!editLabel.trim()) {
      showToast('error', 'Error', 'Please enter a grade name.');
      return;
    }
    try {
      await db.run('UPDATE grades SET label = ? WHERE id = ?', [editLabel.trim(), id]);
      showToast('success', 'Grade Updated', 'Grade has been updated.');
      setEditingId(null);
      setEditLabel('');
      onGradesChange();
    } catch (err) {
      console.error('Failed to update grade:', err);
      showToast('error', 'Error', 'Failed to update grade.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.run('DELETE FROM grades WHERE id = ?', [id]);
      showToast('success', 'Grade Deleted', 'Grade has been removed.');
      onGradesChange();
    } catch (err) {
      console.error('Failed to delete grade:', err);
      showToast(
        'error',
        'Error',
        'Failed to delete grade. There may be students enrolled in this grade.'
      );
    }
    setDeleteConfirm(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Grades / Forms</h3>
        <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>
          Add and manage the grades or forms at your school. Each grade can have its own fee
          structure.
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Add New Grade</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="input-default"
            placeholder="e.g. Form 1, Grade 9, Primary 1"
            value={newGradeLabel}
            onChange={e => setNewGradeLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>
            Add Grade
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {grades.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: 32,
              color: 'var(--color-sage-placeholder)',
            }}
          >
            No grades yet. Add one above to get started.
          </div>
        ) : (
          grades.map(grade => (
            <div
              key={grade.id}
              style={{
                padding: 20,
                background: 'var(--background)',
                borderRadius: 12,
                border: '1px solid var(--color-sage-border)',
              }}
            >
              {editingId === grade.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    className="input-default"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEdit(grade.id)}
                    autoFocus
                    placeholder="Grade name"
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary flex-1" onClick={() => handleEdit(grade.id)}>
                      Save
                    </button>
                    <button
                      className="btn btn-sage flex-1"
                      onClick={() => {
                        setEditingId(null);
                        setEditLabel('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 18 }}>{grade.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-sage-placeholder)' }}>
                        {studentCounts[grade.id] || 0} students{' '}
                        {selectedYearId ? `in ${selectedYearId}` : 'enrolled'}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                      }}
                    >
                      {grade.label.charAt(0)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sage flex-1"
                      onClick={() => {
                        setEditingId(grade.id);
                        setEditLabel(grade.label);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn flex-1"
                      onClick={() => setDeleteConfirm({ id: grade.id, label: grade.label })}
                      style={{
                        color: 'var(--color-posthog-orange)',
                        border: '1px solid var(--color-posthog-orange)',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Grade"
        message={`Are you sure you want to delete "${deleteConfirm?.label}"? This will also remove the grade from all students. This action cannot be undone.`}
        confirmLabel="Delete Grade"
        confirmVariant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default GradeTab;
