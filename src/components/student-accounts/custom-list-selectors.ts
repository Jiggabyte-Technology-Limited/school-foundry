/**
 * Pure helpers for Custom Lists (Task 6).
 *
 * Used by StudentAccounts (and any future list-aware surface) to
 * decide:
 *   - what constitutes a valid list name (trim + dedup + empty)
 *   - how to flip a student_id in and out of a member-set
 *   - how three independent filters (list, search, showInactive)
 *     compose into one ordered scope passed to print/export flows
 *
 * No DB, no React. Exercised in scratch/verify-task7.mjs.
 */

export interface StudentLite {
  id: number;
  full_name: string;
  is_active?: number; // 0 or 1
}

export interface ListRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export type EffectiveScopeInput = {
  /** Members of the active list (id-only); null = no list filter. */
  listMemberIds: number[] | null;
  /** Live search string (already in lower-case at call sites). */
  searchQuery: string;
  /** When false, exclude is_active=0. */
  showInactive: boolean;
};

// ---------------------------------------------------------------------------
// Name validation
// ---------------------------------------------------------------------------

export function validateListName(
  existing: ListRow[],
  raw: string,
  ignoreId?: number
): { ok: true; name: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Please enter a list name.' };
  }
  if (trimmed.length > 80) {
    return { ok: false, reason: 'List name must be 80 characters or fewer.' };
  }
  // Case-insensitive dedup — DB enforces COLLATE NOCASE so we mirror that here.
  const norm = trimmed.toLowerCase();
  const dup = existing.find(
    l => l.id !== ignoreId && l.name.trim().toLowerCase() === norm
  );
  if (dup) {
    return {
      ok: false,
      reason: `A list named "${dup.name}" already exists. Pick a different name.`,
    };
  }
  return { ok: true, name: trimmed };
}

// ---------------------------------------------------------------------------
// Member-set operations (idempotent)
// ---------------------------------------------------------------------------

export function addMember(memberIds: number[], studentId: number): number[] {
  if (memberIds.includes(studentId)) return memberIds;
  return [...memberIds, studentId];
}

export function removeMember(memberIds: number[], studentId: number): number[] {
  return memberIds.includes(studentId)
    ? memberIds.filter(id => id !== studentId)
    : memberIds;
}

export function toggleMembership(
  memberIds: number[],
  studentId: number
): number[] {
  return memberIds.includes(studentId)
    ? removeMember(memberIds, studentId)
    : addMember(memberIds, studentId);
}

export function memberCounts(memberIds: number[]): number {
  return memberIds.length;
}

// ---------------------------------------------------------------------------
// Scope composition. Single seam used by print/export/explore flows.
// ---------------------------------------------------------------------------

/**
 * Compute the filtered set of students given (a) an optional active
 * list, (b) the search box, and (c) the inactive toggle. Stable order
 * is preserved by sorting on `id` so the bulk ZIP/Excel output is
 * deterministic across runs.
 */
export function computeEffectiveScope<T extends StudentLite>(
  all: T[],
  input: EffectiveScopeInput
): T[] {
  const listSet = input.listMemberIds ? new Set(input.listMemberIds) : null;
  const q = input.searchQuery.trim().toLowerCase();
  return all
    .filter(s => {
      if (listSet && !listSet.has(s.id)) return false;
      if (!input.showInactive && (s.is_active ?? 1) === 0) return false;
      if (q) {
        const name = s.full_name.toLowerCase();
        const idStr = String(s.id);
        if (!name.includes(q) && !idStr.includes(q)) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export function formatListChip(name: string, memberCount: number): string {
  const safe = name.length > 24 ? name.slice(0, 23) + '…' : name;
  return `${safe} · ${memberCount}`;
}

/**
 * Diff helper used by the audit log when a list's membership is
 * saved. Produces stable membership deltas in a single string the
 * activity_log.details column can carry.
 */
export function describeMembershipDiff(
  before: number[],
  after: number[]
): { added: number[]; removed: number[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added: number[] = [];
  const removed: number[] = [];
  for (const id of before) if (!afterSet.has(id)) removed.push(id);
  for (const id of after) if (!beforeSet.has(id)) added.push(id);
  return { added, removed };
}
