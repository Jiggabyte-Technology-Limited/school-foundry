import React, { useState, useEffect } from 'react';
import { db } from '../../lib/db-client';
import { useToast } from '../Toast';
import ConfirmDialog from './ConfirmDialog';

interface AcademicYear {
  id: number;
  label: string;
}

interface AcademicYearTabProps {
  years: AcademicYear[];
  selectedYearId: number | null;
  onYearsChange: () => void;
  onSelectYear: (yearId: number) => void;
}

const AcademicYearTab: React.FC<AcademicYearTabProps> = ({
  years,
  selectedYearId,
  onYearsChange,
  onSelectYear,
}) => {
  const { showToast } = useToast();
  const [newYearLabel, setNewYearLabel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);
  const [studentCounts, setStudentCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    loadStudentCounts();
  }, [years]);

  const loadStudentCounts = async () => {
    const counts: Record<number, number> = {};
    for (const year of years) {
      const result = await db.get(
        'SELECT COUNT(*) as count FROM student_year_enrollment WHERE year_id = ? AND is_active = 1',
        [year.id]
      );
      counts[year.id] = result?.count || 0;
    }
    setStudentCounts(counts);
  };

  const handleAdd = async () => {
    if (!newYearLabel.trim()) {
      showToast('error', 'Error', 'Please enter a year label.');
      return;
    }
    try {
      await db.run('INSERT INTO academic_years (label) VALUES (?)', [newYearLabel.trim()]);
      showToast('success', 'Year Added', `Academic year ${newYearLabel} has been added.`);
      setNewYearLabel('');
      onYearsChange();
    } catch (err) {
      console.error('Failed to add year:', err);
      showToast('error', 'Error', 'Failed to add academic year.');
    }
  };

  const handleEdit = async (id: number) => {
    if (!editLabel.trim()) {
      showToast('error', 'Error', 'Please enter a year label.');
      return;
    }
    try {
      await db.run('UPDATE academic_years SET label = ? WHERE id = ?', [editLabel.trim(), id]);
      showToast('success', 'Year Updated', 'Academic year has been updated.');
      setEditingId(null);
      setEditLabel('');
      onYearsChange();
    } catch (err) {
      console.error('Failed to update year:', err);
      showToast('error', 'Error', 'Failed to update academic year.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.run('DELETE FROM academic_years WHERE id = ?', [id]);
      showToast('success', 'Year Deleted', 'Academic year has been removed.');
      if (selectedYearId === id) {
        const remaining = years.filter(y => y.id !== id);
        if (remaining.length > 0) onSelectYear(remaining[0].id);
      }
      onYearsChange();
    } catch (err) {
      console.error('Failed to delete year:', err);
      showToast('error', 'Error', 'Failed to delete academic year.');
    }
    setDeleteConfirm(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 4 }}>Academic Years</h3>
        <p style={{ color: 'var(--color-sage-placeholder)', margin: 0 }}>
          Manage the academic years for your school. Each year contains its own payment periods and
          fee structure.
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Add New Year</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="input-default"
            placeholder="e.g. 2026-2027"
            value={newYearLabel}
            onChange={e => setNewYearLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>
            Add Year
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {years.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-sage-placeholder)' }}>
            No academic years yet. Add one above to get started.
          </div>
        ) : (
          years.map(year => (
            <div
              key={year.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                background: selectedYearId === year.id ? 'var(--primary)' : 'var(--background)',
                color: selectedYearId === year.id ? 'white' : 'inherit',
                borderRadius: 8,
                border: selectedYearId === year.id ? 'none' : '1px solid var(--color-sage-border)',
              }}
            >
              {editingId === year.id ? (
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <input
                    className="input-default"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEdit(year.id)}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-primary" onClick={() => handleEdit(year.id)}>
                    Save
                  </button>
                  <button
                    className="btn btn-sage"
                    onClick={() => {
                      setEditingId(null);
                      setEditLabel('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}
                    onClick={() => onSelectYear(year.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{year.label}</div>
                      <div
                        style={{ fontSize: 13, opacity: selectedYearId === year.id ? 0.8 : 0.6 }}
                      >
                        {studentCounts[year.id] || 0} students enrolled
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sage"
                      onClick={() => {
                        setEditingId(year.id);
                        setEditLabel(year.label);
                      }}
                      style={{
                        background: selectedYearId === year.id ? 'rgba(255,255,255,0.2)' : 'white',
                        color: selectedYearId === year.id ? 'white' : 'inherit',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() => setDeleteConfirm({ id: year.id, label: year.label })}
                      style={{
                        background: selectedYearId === year.id ? 'rgba(255,255,255,0.2)' : 'white',
                        color: selectedYearId === year.id ? 'white' : 'var(--color-posthog-orange)',
                        border:
                          selectedYearId === year.id
                            ? 'none'
                            : '1px solid var(--color-posthog-orange)',
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
        title="Delete Academic Year"
        message={`Are you sure you want to delete "${deleteConfirm?.label}"? This will also delete all associated payment periods and fee structures. This action cannot be undone.`}
        confirmLabel="Delete Year"
        confirmVariant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default AcademicYearTab;
