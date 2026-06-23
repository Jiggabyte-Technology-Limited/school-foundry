/**
 * ManageListsModal — the Custom Lists admin surface for StudentAccounts.
 *
 * Two views inside the modal:
 *   - "All lists"  : a table of every list (active + archived) with
 *                    rename/delete/restore actions and a "Builder"
 *                    button to edit members.
 *   - "Builder"    : live-search + multi-select students on the left;
 *                    the saved/working member set on the right; Save
 *                    persists and emits one LIST_MEMBERS_REPLACED audit row.
 *
 * Pure logic in `custom-list-selectors.ts` is reused. Persistence calls
 * the SQLite tables declared by migration v2.1.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../lib/db-client';
import { useToast } from '../Toast';
import { useAuth } from '../../lib/auth-context';
import {
  validateListName,
  toggleMembership as toggleMembershipId,
  describeMembershipDiff,
  type ListRow,
} from './custom-list-selectors';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Refresh hook so the parent can re-fetch the active list when this modal changes it. */
  onListsChanged?: () => void;
  /** All students loaded by the parent — used by the builder. */
  allStudents: { id: number; full_name: string; is_active?: number }[];
}

type Mode = 'index' | 'builder' | 'new';

const ManageListsModal: React.FC<Props> = ({ open, onClose, onListsChanged, allStudents }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [lists, setLists] = useState<ListRow[]>([]);
  const [mode, setMode] = useState<Mode>('index');
  const [activeList, setActiveList] = useState<ListRow | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const [search, setSearch] = useState('');
  const [workingMembers, setWorkingMembers] = useState<number[]>([]);
  const [savedMembers, setSavedMembers] = useState<number[]>([]);
  const [archiveView, setArchiveView] = useState(false);

  // ----- initial + every-open load -----
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const ls = await db.all(
          `SELECT id, name, description, created_at, updated_at, deleted_at
             FROM custom_lists
             WHERE deleted_at IS NULL
             ORDER BY name COLLATE NOCASE`
        );
        setLists(ls as ListRow[]);
      } catch (e) {
        console.error('ManageListsModal: load failed', e);
        showToast('error', 'Could not load lists', e instanceof Error ? e.message : String(e));
      }
    })();
  }, [open, showToast]);

  // ----- helpers -----
  const log = async (
    listId: number,
    action: string,
    details?: string
  ) => {
    try {
      await db.run(
        `INSERT INTO activity_log (user_id, username, action, entity, entity_id, details)
           VALUES (?, ?, ?, ?, ?, ?)`,
        [user?.id, user?.username, action, 'custom_lists', listId, details ?? null]
      );
    } catch (e) {
      console.warn('[activity_log] list mutation not recorded:', e);
    }
  };

  const enterNewList = () => {
    setActiveList(null);
    setNameDraft('');
    setNameError('');
    setWorkingMembers([]);
    setSavedMembers([]);
    setMode('new');
  };

  const enterBuilder = async (list: ListRow) => {
    setActiveList(list);
    setNameDraft(list.name);
    setNameError('');
    setMode('builder');
    setSearch('');
    const members = await db.all(
      `SELECT student_id FROM custom_list_members WHERE list_id = ?`,
      [list.id]
    );
    const ids = members.map((m: any) => Number(m.student_id));
    setWorkingMembers(ids);
    setSavedMembers(ids);
  };

  const submitNewList = async () => {
    const r = validateListName(lists, nameDraft);
    if (!r.ok) {
      setNameError(r.reason);
      return;
    }
    try {
      const ins = await db.run(
        `INSERT INTO custom_lists (name, created_by, created_at, updated_at)
           VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
        [r.name, user?.id]
      );
      const newId: number =
        (ins as any).lastInsertRowid ?? (ins as any).lastID ?? 0;
      await log(newId, 'LIST_CREATED', `name=${JSON.stringify(r.name)}`);

      // If the user had ticked some students before creating, persist them.
      if (workingMembers.length > 0) {
        await persistMembers(newId, [], workingMembers);

        // Re-enter builder mode so they can keep editing the new list.
        const fresh = (await db.get(
          `SELECT id, name, description, created_at, updated_at, deleted_at
             FROM custom_lists WHERE id = ?`,
          [newId]
        )) as ListRow;
        setActiveList(fresh);
        setSavedMembers(workingMembers);
        setMode('builder');
      } else {
        setMode('index');
      }
      await reloadLists();
      showToast('success', 'List created', `"${r.name}" is ready.`);
    } catch (e) {
      console.error(e);
      showToast('error', 'Could not create list', e instanceof Error ? e.message : String(e));
    }
  };

  const persistMembers = async (
    listId: number,
    before: number[],
    after: number[]
  ) => {
    const diff = describeMembershipDiff(before, after);
    if (diff.added.length > 0) {
      await db.run('BEGIN');
      try {
        for (const sid of diff.added) {
          await db.run(
            `INSERT OR IGNORE INTO custom_list_members (list_id, student_id) VALUES (?, ?)`,
            [listId, sid]
          );
        }
        for (const sid of diff.removed) {
          await db.run(
            `DELETE FROM custom_list_members WHERE list_id = ? AND student_id = ?`,
            [listId, sid]
          );
        }
        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
        throw e;
      }
      await log(
        listId,
        'LIST_MEMBERS_REPLACED',
        `added=${JSON.stringify(diff.added)} removed=${JSON.stringify(diff.removed)} total=${after.length}`
      );
    } else if (diff.removed.length > 0) {
      await db.run('BEGIN');
      try {
        for (const sid of diff.removed) {
          await db.run(
            `DELETE FROM custom_list_members WHERE list_id = ? AND student_id = ?`,
            [listId, sid]
          );
        }
        await db.run('COMMIT');
      } catch (e) {
        await db.run('ROLLBACK');
        throw e;
      }
      await log(
        listId,
        'LIST_MEMBERS_REPLACED',
        `removed=${JSON.stringify(diff.removed)} total=${after.length}`
      );
    }
  };

  const saveBuilder = async () => {
    if (!activeList) return;
    // Optional: rename inside the save.
    let listId = activeList.id;
    if (nameDraft.trim() !== activeList.name) {
      const r = validateListName(lists, nameDraft, activeList.id);
      if (!r.ok) {
        setNameError(r.reason);
        return;
      }
      try {
        await db.run(
          `UPDATE custom_lists SET name = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`,
          [r.name, activeList.id]
        );
        await log(activeList.id, 'LIST_RENAMED', `from=${JSON.stringify(activeList.name)} to=${JSON.stringify(r.name)}`);
        activeList.name = r.name;
      } catch (e) {
        showToast('error', 'Could not rename', e instanceof Error ? e.message : String(e));
        return;
      }
    }

    try {
      await persistMembers(listId, savedMembers, workingMembers);
      setSavedMembers(workingMembers);
      await reloadLists();
      onListsChanged?.();
      showToast('success', 'List saved', `${workingMembers.length} member(s).`);
    } catch (e) {
      console.error(e);
      showToast('error', 'Could not save list', e instanceof Error ? e.message : String(e));
    }
  };

  const deleteList = async (list: ListRow) => {
    if (!confirm(`Archive list "${list.name}"? You can restore it from the show-archived area.`)) {
      return;
    }
    try {
      await db.run(
        `UPDATE custom_lists SET deleted_at = datetime('now', 'localtime'),
                                 updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
        [list.id]
      );
      await log(list.id, 'LIST_DELETED', `name=${JSON.stringify(list.name)}`);
      await reloadLists();
      if (activeList?.id === list.id) setMode('index');
      onListsChanged?.();
      showToast('info', 'List archived', `"${list.name}" hidden from new work.`);
    } catch (e) {
      showToast('error', 'Could not archive', e instanceof Error ? e.message : String(e));
    }
  };

  const restoreList = async (list: ListRow) => {
    try {
      await db.run(
        `UPDATE custom_lists SET deleted_at = NULL,
                                 updated_at = datetime('now', 'localtime')
           WHERE id = ?`,
        [list.id]
      );
      await log(list.id, 'LIST_RESTORED', `name=${JSON.stringify(list.name)}`);
      await reloadLists();
      onListsChanged?.();
      showToast('success', 'List restored', `"${list.name}" is back.`);
    } catch (e) {
      showToast('error', 'Could not restore', e instanceof Error ? e.message : String(e));
    }
  };

  const reloadLists = async () => {
    const ls = await db.all(
      `SELECT id, name, description, created_at, updated_at, deleted_at
         FROM custom_lists
         ORDER BY (deleted_at IS NOT NULL) ASC, name COLLATE NOCASE`
    );
    setLists(ls as ListRow[]);
  };

  // ----- builder view derivation -----
  const searchHitStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allStudents;
    return allStudents.filter(
      s => s.full_name.toLowerCase().includes(q) || String(s.id).includes(q)
    );
    // allStudents identity is stable from parent; safe dep
  }, [allStudents, search]);

  if (!open) return null;

  const archivedOnly = lists.filter(l => l.deleted_at);
  const activeOnly = lists.filter(l => !l.deleted_at);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        className="card-surface"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 880,
          maxHeight: '90vh',
          overflow: 'auto',
          backgroundColor: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {mode === 'builder'
              ? `Edit list: ${activeList?.name ?? ''}`
              : mode === 'new'
                ? 'Create new list'
                : 'Custom Lists'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-secondary)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {mode === 'index' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Saved subsets of students. Use them to scope bulk exports,
                statements, and reports.
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={enterNewList}
                style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
              >
                + New list
              </button>
            </div>

            {activeOnly.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  border: '1px dashed var(--border)',
                  borderRadius: 10,
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                No saved lists yet. Click "New list" to create one.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
                {activeOnly.map(l => (
                  <div
                    key={l.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{l.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {l.updated_at ? `updated ${new Date(l.updated_at).toLocaleDateString()}` : 'never updated'}
                    </span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => enterBuilder(l)}
                      style={{ padding: '4px 12px', fontSize: 12, border: '1px solid var(--border)', background: 'transparent' }}
                    >
                      Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveList(l); setNameDraft(l.name); deleteList(l); }}
                      className="btn"
                      style={{
                        padding: '4px 12px',
                        fontSize: 12,
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Archive
                    </button>
                  </div>
                ))}
              </div>
            )}

            {archivedOnly.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setArchiveView(v => !v)}
                  className="btn"
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {archiveView ? 'Hide' : 'Show'} archived ({archivedOnly.length})
                </button>
                {archiveView && (
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      marginTop: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {archivedOnly.map(l => (
                      <div
                        key={l.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 14px',
                          background: 'rgba(0,0,0,0.03)',
                          opacity: 0.7,
                        }}
                      >
                        <span style={{ flex: 1, fontSize: 13, textDecoration: 'line-through' }}>{l.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>archived</span>
                        <button
                          type="button"
                          onClick={() => restoreList(l)}
                          className="btn btn-primary"
                          style={{ padding: '2px 12px', fontSize: 12 }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {(mode === 'new' || mode === 'builder') && (
          <>
            {nameError && (
              <div
                className="error-message"
                style={{
                  marginBottom: 10,
                  padding: 8,
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(249, 115, 22, 0.4)',
                  background: 'rgba(249, 115, 22, 0.08)',
                }}
              >
                {nameError}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                List name
              </label>
              <input
                type="text"
                value={nameDraft}
                onChange={e => { setNameDraft(e.target.value); setNameError(''); }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                }}
                placeholder="e.g. Term 3 owing"
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                alignItems: 'stretch',
              }}
            >
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, minHeight: 320 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setWorkingMembers(m => {
                      const next = new Set(m);
                      for (const s of searchHitStudents) next.add(s.id);
                      return Array.from(next);
                    })}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  >
                    Select visible
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setWorkingMembers([])}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {searchHitStudents.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', padding: 8 }}>
                      No students match.
                    </div>
                  ) : (
                    searchHitStudents.map(s => {
                      const isPicked = workingMembers.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: isPicked ? 'rgba(249, 115, 22, 0.08)' : 'transparent',
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isPicked}
                            onChange={() => setWorkingMembers(m => toggleMembershipId(m, s.id))}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span style={{ flex: 1 }}>{s.full_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>#{s.id}</span>
                          {(s.is_active ?? 1) === 0 && (
                            <span style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 999, border: '1px solid var(--border)' }}>
                              inactive
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, minHeight: 320 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    Members ({workingMembers.length})
                  </span>
                  {workingMembers.length !== savedMembers.length && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>unsaved changes</span>
                  )}
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {workingMembers.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', padding: 8 }}>
                      No members yet. Pick students on the left.
                    </div>
                  ) : (
                    workingMembers.map(sid => {
                      const student = allStudents.find(s => s.id === sid);
                      return (
                        <div
                          key={sid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 13,
                          }}
                        >
                          <span style={{ flex: 1 }}>{student?.full_name ?? `Unknown #${sid}`}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>#{sid}</span>
                          <button
                            type="button"
                            onClick={() => setWorkingMembers(m => toggleMembershipId(m, sid))}
                            aria-label={`Remove ${student?.full_name ?? sid}`}
                            className="btn"
                            style={{
                              padding: '0 6px',
                              fontSize: 14,
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setNameError('');
                  setMode('index');
                }}
                className="btn"
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={mode === 'new' ? submitNewList : saveBuilder}
                className="btn btn-primary"
                style={{ padding: '6px 16px', fontSize: 13, fontWeight: 700 }}
              >
                {mode === 'new' ? 'Create list' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ManageListsModal;
