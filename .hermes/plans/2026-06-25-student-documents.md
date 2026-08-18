# Student Documents Feature Implementation Plan

> **For Hermes:** This is a design/architecture plan only — no execution yet. Review, discuss with Seward, then we'll implement.

**Goal:** Allow admins to upload, store, and view per-student documents (photos, birth certificates, report cards, consent forms, etc.) accessible directly from the student detail view.

**Architecture:** Files are stored on disk in `app.getPath('userData')/student-docs/<student_id>/` with metadata (filename, size, type, uploaded_at, description) in a new `student_documents` SQLite table. The renderer never touches the filesystem directly — all file I/O goes through IPC handlers in the main process, consistent with the existing pattern (guide-media, print-output, xlsx export).

**Tech Stack:** Electron `dialog.showOpenDialog` for file picker, `fs.copyFile` for storage, SQLite BLOB fallback for small files (< 1 MB), `electron.shell.openPath` for viewing.

---

## Current State Analysis

### What exists today
- **File storage pattern**: `app.getPath('userData')` is the root for all app data (`data.db`, `guide-media/`, `print-output/`, `license.lic`)
- **IPC bridge**: `preload.ts` exposes `window.api.*` methods → `ipc.ts` / `import-ipc.ts` handle in main process
- **Student detail**: `EditStudentModal` is the primary editing surface; `StudentStatementPreview` shows financial details
- **StudentAccounts page**: Right panel shows either `FinancialOverviewPanel` (no student selected) or `StudentStatementPreview` (student selected)
- **Logo upload**: `SettingsModal` already does base64 image upload via `FileReader.readAsDataURL` → store in `app_settings` table

### What's missing
- No `student_documents` table
- No file picker IPC handler
- No document storage directory
- No UI for upload/view/manage documents

---

## Proposed Design

### Data Model

```sql
CREATE TABLE IF NOT EXISTS student_documents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,              -- original filename (e.g. "birth_cert.pdf")
  stored_name     TEXT NOT NULL UNIQUE,       -- UUID-based name on disk (e.g. "a1b2c3.pdf")
  file_size       INTEGER NOT NULL,           -- bytes
  mime_type       TEXT,                       -- e.g. "image/jpeg", "application/pdf"
  category        TEXT NOT NULL DEFAULT 'other',  -- 'photo', 'certificate', 'report_card', 'consent_form', 'medical', 'other'
  description     TEXT,                       -- admin-entered label
  file_path       TEXT NOT NULL,              -- absolute path on disk
  uploaded_by     INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_category ON student_documents(category);
```

### File Storage Strategy

```
%APPDATA%/schoolfoundry/
  data.db
  student-docs/
    <student_id>/
      <uuid>-birth_cert.pdf
      <uuid>-photo.jpg
      <uuid>-report_card.pdf
```

**Why disk, not BLOB:**
- SQLite BLOBs work but bloat the DB file, slow down backups, and make the DB harder to manage
- Disk files can be opened with native OS apps via `shell.openPath()`
- The existing codebase already uses disk storage for guide-media and print-output
- Keeps the DB lean for the backup/restore flow

**File naming:** UUID-based stored name prevents collisions and path traversal. Original filename preserved in `file_name` for display.

### IPC Handlers (main process)

| Handler | Purpose |
|---------|---------|
| `upload-student-documents` | Open file dialog → copy files to disk → insert metadata rows |
| `get-student-documents` | Return all documents for a student (metadata only, no binary) |
| `open-student-document` | Open file with OS default app via `shell.openPath()` |
| `delete-student-document` | Delete file from disk + remove metadata row |
| `get-documents-storage-info` | Return total size per student (for storage management) |

### UI Integration

**Where it lives:** A new "Documents" tab/section in the `EditStudentModal`, accessible alongside the existing Personal Information and Guardian Information sections.

**Components:**
1. **`StudentDocumentsPanel`** — list/grid of documents with thumbnails for images, file type icons for PDFs/other
2. **Upload button** — opens native file dialog (multi-select)
3. **Category dropdown** — classify each document at upload time
4. **Document card** — shows thumbnail/icon, filename, size, date, category badge
5. **Actions** — View (open in OS app), Download (save copy), Delete (with confirm)

**Access points:**
- From `EditStudentModal` → new "Documents" tab
- From `StudentAccounts` → when a student is selected, show a compact document indicator (e.g. "📎 3 files") that opens the full panel

### Migration Strategy

**Migration 2.3** (follows the 2.2 name-split migration):
1. Create `student_documents` table
2. Create `student-docs/` directory in userData
3. No backfill needed (new feature, no existing data)

---

## Step-by-Step Implementation

### Task 1: Database Migration 2.3
**Files:**
- Modify: `src/db/migrations.ts` — append new migration entry
- Modify: `src/db/schema.sql` — add `student_documents` table DDL

**Migration logic:**
```typescript
{
  version: '2.3',
  description: 'Add student_documents table for file storage',
  run: async db => {
    await runSql(db, `
      CREATE TABLE IF NOT EXISTS student_documents (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        file_name       TEXT NOT NULL,
        stored_name     TEXT NOT NULL UNIQUE,
        file_size       INTEGER NOT NULL,
        mime_type       TEXT,
        category        TEXT NOT NULL DEFAULT 'other',
        description     TEXT,
        file_path       TEXT NOT NULL,
        uploaded_by     INTEGER REFERENCES users(id),
        created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `);
    await runSql(db, `CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);`);
    await runSql(db, `CREATE INDEX IF NOT EXISTS idx_student_documents_category ON student_documents(category);`);
    await runSql(db, `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2.3', datetime('now'));`);
  },
}
```

### Task 2: IPC Handlers — File Operations
**Files:**
- Create: `src/db/student-docs-ipc.ts` — all document IPC handlers
- Modify: `src/main.ts` — register `registerStudentDocHandlers()`

**Handlers:**

```typescript
// student-docs-ipc.ts
import { ipcMain, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import db from './init';

function getStudentDocsRoot(): string {
  const root = path.join(app.getPath('userData'), 'student-docs');
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

function getStudentDir(studentId: number): string {
  const dir = path.join(getStudentDocsRoot(), String(studentId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
```

**`upload-student-documents`:**
1. `dialog.showOpenDialog` with multiSelect, filters for images + PDFs + common docs
2. For each file: generate UUID name, copy to `student-docs/<student_id>/<uuid><ext>`
3. Insert metadata row
4. Return array of created records

**`get-student-documents`:**
1. `SELECT * FROM student_documents WHERE student_id = ? ORDER BY created_at DESC`
2. Return metadata array

**`open-student-document`:**
1. `shell.openPath(filePath)` — opens with OS default app
2. Return success/error

**`delete-student-document`:**
1. Get file_path from DB row
2. `fs.unlink(filePath)` — delete from disk
3. `DELETE FROM student_documents WHERE id = ?`
4. Return success

### Task 3: Preload Bridge
**Files:**
- Modify: `src/preload.ts` — add document APIs

```typescript
uploadStudentDocuments: (studentId: number) =>
  ipcRenderer.invoke('upload-student-documents', studentId),
getStudentDocuments: (studentId: number) =>
  ipcRenderer.invoke('get-student-documents', studentId),
openStudentDocument: (docId: number) =>
  ipcRenderer.invoke('open-student-document', docId),
deleteStudentDocument: (docId: number) =>
  ipcRenderer.invoke('delete-student-document', docId),
```

### Task 4: StudentDocumentsPanel Component
**Files:**
- Create: `src/components/student-accounts/StudentDocumentsPanel.tsx`

**Features:**
- Grid layout: image thumbnails render inline; PDFs show a PDF icon; others show file-type icon
- Upload button (multi-select file dialog via IPC)
- Category selector at upload (photo, certificate, report_card, consent_form, medical, other)
- Per-document actions: Open, Download, Delete
- File size display (human-readable: KB/MB)
- Empty state: "No documents uploaded yet"

**Props:**
```typescript
interface StudentDocumentsPanelProps {
  studentId: number;
  onClose?: () => void;  // if shown as modal
}
```

### Task 5: Integrate into EditStudentModal
**Files:**
- Modify: `src/components/EditStudentModal.tsx`

**Changes:**
- Add a tab bar at the top: "Personal" | "Guardian" | "Documents"
- When "Documents" tab active, render `<StudentDocumentsPanel studentId={studentId} />`
- Pass `user.id` for `uploaded_by` audit

### Task 6: Compact Document Indicator in StudentAccounts
**Files:**
- Modify: `src/components/StudentAccounts.tsx`

**Changes:**
- When a student is selected, fetch document count
- Show compact indicator: "📎 3 documents" next to student name
- Clicking opens the documents panel (either inline or modal)

### Task 7: Storage Management (Danger Zone)
**Files:**
- Modify: `src/components/SettingsModal.tsx` — add to Danger Zone tab

**Features:**
- Show total storage used by student documents
- "Clear all student documents" button (with confirmation phrase)
- Per-student breakdown (optional, admin-only)

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/db/migrations.ts` | Modify | Add migration 2.3 |
| `src/db/schema.sql` | Modify | Add table DDL |
| `src/db/student-docs-ipc.ts` | **Create** | All document IPC handlers |
| `src/main.ts` | Modify | Register handlers |
| `src/preload.ts` | Modify | Expose `window.api.*` document methods |
| `src/components/student-accounts/StudentDocumentsPanel.tsx` | **Create** | Document grid + upload UI |
| `src/components/EditStudentModal.tsx` | Modify | Add Documents tab |
| `src/components/StudentAccounts.tsx` | Modify | Document count indicator |
| `src/components/SettingsModal.tsx` | Modify | Storage management in Danger Zone |

---

## Risks & Decisions

| Decision | Rationale |
|----------|-----------|
| **Disk storage, not BLOB** | Consistent with existing patterns; avoids DB bloat; enables native file opening |
| **UUID filenames** | Prevents path traversal and name collisions |
| **Keep `full_name` column** | Backwards compat — all existing queries/displays use it. Migration 2.2 backfills `first_name`/`surname` but `full_name` stays. |
| **No file size limit in DB** | Enforce 25 MB per file at IPC level (prevent abuse) |
| **Categories as free TEXT with suggested values** | Flexible — schools may have document types we haven't anticipated |

## Open Questions for Seward

1. **File size limit?** — Suggest 25 MB per file. Photos are typically < 5 MB, PDFs < 10 MB.
2. **Allowed file types?** — Suggest: images (jpg, png, gif, webp), PDF, Word (doc, docx). Or allow all?
3. **Should documents be included in backup/restore?** — The `student-docs/` folder is in `userData` alongside `data.db`. If we backup just the DB, documents are lost. Should the backup manager zip the entire `userData` folder?
4. **Document access for non-admin users?** — Currently only admins can edit students. Should regular users (e.g. teachers) be able to *view* documents?
5. **Thumbnail generation?** — For images, render actual thumbnails. For PDFs, show a PDF icon. Acceptable?

---

## Verification

After implementation:
1. Open a student → Documents tab → upload a photo → see thumbnail
2. Upload a PDF → see PDF icon → click Open → opens in system PDF viewer
3. Delete a document → file removed from disk + DB
4. Close and reopen app → documents persist
5. Check `%APPDATA%/schoolfoundry/student-docs/<id>/` → files on disk
6. Run migration on a fresh DB → table created, no errors
7. Run migration on existing DB → no errors (idempotent)
