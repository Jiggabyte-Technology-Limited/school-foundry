# School Foundry - Comprehensive Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** To build a robust, user-friendly, and secure school management system that addresses key pain points in student data, fee management, and administrative workflows, laying a foundation for future AI-driven enhancements.

**Architecture:** A modern, scalable web application leveraging Next.js/React on Vercel for the frontend, Neon PostgreSQL for the primary data store (with Prisma ORM), and Cloud Run for backend services (e.g., payment webhooks, data processing, future LangGraph bots). Clerk will handle authentication and user management, ensuring a secure and streamlined user experience.

**Tech Stack:** Next.js (React), TypeScript, Tailwind CSS, Vercel, Neon PostgreSQL, Prisma ORM, Clerk Authentication, Cloud Run (Docker), LangGraph (for future AI features), OpenRouter (LLM provider).

---

## Problems We're Solving

The current system has several critical gaps and areas for improvement that impact administrative efficiency, data integrity, and financial transparency:

1.  **Limited Student Information:** Missing key demographic data (age, deactivation date) and lack of flexible student grouping.
2.  **Inefficient Data Management:** Manual data entry and lack of bulk import capabilities for students and payments lead to errors and significant time investment.
3.  **Ambiguous Fee Logic:** Unclear rules for fee calculation, outstanding balances, and discount application, leading to billing disputes and revenue loss.
4.  **Administrative Overhead:** No simple way to generate user guides or easily reset admin passwords, increasing support burden.
5.  **Rigid Setup:** Inflexible initial grade setup doesn't accommodate diverse school structures.
6.  **Security & Compliance:** Implicit need for robust user management (admin password reset) and data privacy (POPIA compliance).

## Inferred and Additional Features

Based on the stated problems, the user's preferred stack, and common requirements for school management systems, I propose incorporating the following features to enhance functionality and future-proof the system:

*   **Enhanced Student Profiles:** Beyond age and deactivation date, include comprehensive parent/guardian contact information (multiple contacts per student), enrollment history, and basic attendance tracking (present/absent).
*   **Flexible Fee Management:** Implement robust payment plans (monthly, termly, annual), discount management (siblings, early payment), and automated payment reminders (via SMS/Email).
*   **Role-Based Access Control (RBAC):** Introduce distinct roles for Admin, Staff, Teachers, and Finance personnel to ensure data security and appropriate access levels, crucial for POPIA compliance.
*   **Communication Hub:** Integrate with SMS/WhatsApp gateways (aligning with EcoCash/MoMo context) for sending bulk announcements, payment reminders, and urgent alerts.
*   **Reporting Suite:** Generate printable student directories, financial reports (outstanding fees, revenue), and attendance summaries.
*   **Audit Logs:** Track significant changes made by users within the system for accountability and troubleshooting.
*   **Payment Gateway Integration:** Support popular African payment gateways like Peach, PayFast, or Flutterwave for seamless online fee collection.
*   **Future AI Integration (LangGraph + OpenRouter):** Lay the groundwork for AI-powered features like personalized student insights, automated Q&A for parents, or smart financial forecasting.

---

# Implementation Plan — Phased Roadmap

This plan is structured into three priorities based on technical complexity and value delivery, following TDD principles. Each feature includes its objective, technical complexity, prerequisites, high-level steps, key files, and verification.

**Status legend:** ✅ Done · ⏳ In progress · ⬜ Pending

---

## Phase 1: Foundational Data & Quick Wins (Low Complexity)

> These features provide immediate value with minimal development effort, focusing on data enrichment and essential administrative functions.

### Task 1: Add Student Age Calculation and Display ✅ DONE
### Task 2: Display Deactivation Date for Deactivated Students ✅ DONE
### Task 3: Implement Admin Password Reset with License Key ✅ DONE (now supports both password-reset and bootstrap-new-admin)

---

## Phase 2: Workflow & Reporting Improvements (Moderate Complexity)

> These features harden everyday workflows, build on Phase 1 data, and unlock the analytics + admin support tooling that schools ask for first after launch.

### Task 4: Print User Guide + School-Name Integrity After DB Import ✅ DONE

**Objective:** Give admins a one-click "Print User Guide" action that produces a PDF in the user's local print folder, and ensure the school name shown in the printed guide always reflects the current `app_settings.school_name` (not a hardcoded fallback). This bug-bites hard after a database import/restore, where the guide can show a stale school name.

**Technical Complexity:** Moderate. New helper + IPC reuse; school-name normalisation across existing call sites.

**Prerequisites:** Existing `window.api.printToPdf` IPC handler, `app_settings.school_name` key, and `lib/db-client.ts` `db.get(...)` wrapper are already in place.

**High-Level Steps:**

1.  **Audit usage spots.** Inventory every component that reads `school_name` so we can verify they all fall back to the live DB value (no lingering hardcoded fallback strings).
2.  **Read school name in `UserGuide.tsx`.** Add a `useEffect` that fetches the live `school_name` from `app_settings` and stores it in state. Show it in the guide header (and footer) instead of any hardcoded "SchoolFoundry" string.
3.  **Build a printable HTML snapshot of the guide.** Either (a) extract the rendered guide nodes into a standalone HTML string with embedded CSS print styles, or (b) reuse the existing window-print flow (`window.print()`) via a dedicated "Print this guide" button. Stay consistent with the existing print pipeline.
4.  **Add the "Print / Save PDF" button to the guide header.** Place it next to the existing brand block. On click, call `printDocument({ html, filename: 'schoolfoundry-user-guide.pdf', title: 'SchoolFoundry User Guide — <schoolName>' })`.
5.  **Handle fallback** if `school_name` is missing — render "SchoolFoundry" as a neutral default and surface a one-line warning toast (`"School name not set — open Settings to set it"`).
6.  **Reuse after-import.** Because every print run re-reads the DB value, a school that restores from a backup automatically sees the new school name in the next guide print.

**Key Files:**
*   `src/components/UserGuide.tsx` (add print button, live schoolName state, fallback handling)
*   `src/lib/print/user-guide.ts` (new — HTML builder that mirrors the on-screen guide + injects print-safe CSS)
*   `src/lib/print/index.ts` (re-export the new builder)
*   `src/db/ipc.ts` (no change; existing `print-to-pdf` handledream is reused — verify only)

**Verification:**
1.  Open the User Guide in the running app and confirm the school name in the header matches `app_settings.school_name`.
2.  Click "Print / Save PDF" — verify a PDF appears in the configured print output directory named `schoolfoundry-user-guide.pdf`.
3.  Open the PDF, confirm the school name in the title/header is correct (not "SchoolFoundry" unless that's the live value).
4.  Change the school name in Settings → click Print again → confirm the new name is reflected.
5.  Simulate a restore-from-backup that brings a different school_name → confirm the next guide print reflects the imported name.
6.  Set `school_name` to null/empty → confirm a fallback warning toast fires and the guide still prints with a neutral default.

**Status (2026-06-23):** All 6 verification steps are covered by `scratch/verify-task4.mjs` (run via `node scratch/verify-task4.mjs`) for the pure-print-pipeline parts (steps 1, 3, 4, 5, 6). Steps 2 (PDF lands in print dir) and the toast firings require a full Electron run — these are exercised manually before merge. The verification script also caught an XSS bug in the original `escapeHtml` helper: `replace(/</g, '\u003c')` is a no-op because `\u003c` resolves to `<` itself. Fixed to use real HTML entities (`<`, `>`, `"`, `'`, `&`).

### Task 5: Initial Setup — No Pre-Selected Grades, Allow On-the-Fly Grade Creation ✅ DONE
*(Moderate complexity — needs setup-wizard refactor)*

**Objective:** First-run setup should NOT seed a fixed default grade list. Schools define their own grade names ("Form 1", "Grade 5", "Senior Infants", etc.). Grades can be renamed, added, archived from a dedicated "School Structure" admin page.

**High-Level Steps:**
1.  Remove default grade seeding from `SetupWizard.tsx`.
2.  Add a guided "Add your grades" step inline in the wizard with bulk-add UX (paste a comma-separated list, or add row-by-row).
3.  Persist to the existing `grades` table — no schema change needed.
4.  Add a new "School Structure" page to Settings that lists grades + class sections, lets you add/rename/archive, and logs every change in `activity_log`.

**Verification:** Run first-run setup with no grades; confirm wizard asks the school to enter grade names; confirm the new School Structure page accepts CRUD on grades.

**Status (2026-06-23):** Shipped across 3 commits on `main`:

- `feat(wizard): empty-start grades step with configurable selection`
  - First-run wizard now lands on a dedicated `grades` step between
    `periods` and `fees` with an empty starting state. Palette is
    11 un-selected options (Grade 1-7 + Form 1-4); admins tick what
    they run or add custom names. Min 1 enforced.
  - Pure helpers live in `src/components/setup-wizard/grade-selectors.ts`.
  - `scratch/verify-task5.mjs` runs 23 assertions over the wizard's
    pure selectors. All pass.

- `feat(settings): School Structure surface (add/rename/archive/reorder)`
  - Replaces the tiny "Grades/Forms" inline card in
    `FeeStructureManager.tsx` with a full School Structure admin
    panel: add (input + suggested-name chips), per-row
    Rename / Archive / Move up / Move down, plus a "Show archived
    (N)" toggle with one-click Restore.
  - Pure helpers live in `src/components/setup-wizard/school-structure-actions.ts`.
  - `scratch/verify-task6.mjs` runs 19 assertions over the pure
    helpers. All pass.

- Persistence is unchanged at the schema level. Activity log gets
  five new tags for grade mutations:
  - `SCHOOL_STRUCTURE_DEFINED` — wizard completion (one per setup)
  - `GRADE_CREATED`, `GRADE_RENAMED`, `GRADE_ARCHIVED`,
    `GRADE_RESTORED`, `GRADE_REORDERED` — admin panel mutations
    (one each).
- Backwards compat: existing installs with `setup_complete=1` are
  untouched by the wizard change (the wizard never runs for them).
  School Structure admin panel becomes their first/only path for
  grade edits — no migration needed.

**Manual / Electron-only checks still required before merge:**
  - Fresh install: wizard shows `School Structure` as Step 04 with 11
    un-ticked checkboxes; try Next empty -> validation error fires;
    pick Grade 1 + Form 4 -> Next -> fees step shows read-only chips
    + working "Change grades" back-button; complete setup;
    `SELECT label FROM grades;` returns just those two.
  - Existing install: open School Structure; add a custom grade;
    rename (collision guard fires); archive; reorder up/down; confirm
    each mutation produces one matching row in `activity_log`.

### Task 6: Custom Student Lists ⬜ PENDING
*(Moderate complexity — search + multi-select + persisted named lists)*

**Objective:** Let admins build reusable subsets of students ("Class B owing", "Term 3 reminders", "Scholarship candidates") and reuse them across statement printing, communication, and reporting.

**High-Level Steps:**
1.  Add `custom_lists` (id, name, created_by, created_at) and `custom_list_members` (list_id, student_id) tables.
2.  Add a "List Builder" side-panel in StudentAccounts with: live search, multi-select checkbox per row, live preview pane, "Save as new list".
3.  Hook the list selector to existing print/export flows so admins can print/export just the selected list.
4.  Audit-log every list creation / deletion.

**Verification:** Create two custom lists, save, reload — confirm persistence. Print statements scoped to one list — confirm only those students render.

---

## Phase 3: Heavy Lifters (High Complexity)

> These require significant backend and validation work — best tackled once Phase 2 is stable and the team has real user feedback.

### Task 7: Excel Import for Students + Payments + Schedules ⬜ PENDING
*(High complexity — schema mapping, dry-run validation, transactional commit, error report)*

**Objective:** Onboard legacy schools by importing their existing student and payment data from Excel without manual re-typing.

**High-Level Steps:**
1.  Define a downloadable Excel template with frozen headers and an example row per table.
2.  Add an "Import" screen with file dropzone, sheet-to-table picker, and a column-mapping wizard.
3.  Build a row validator (required fields, enum validation, FK existence) that produces a downloadable error report before commit.
4.  Commit inside a single SQLite transaction; rollback on any error.
5.  Audit-log every import (who, what file, how many rows, errors).

**Key Files / new modules:**
*   `src/lib/import/excel-parser.ts`
*   `src/lib/import/validator.ts`
*   `src/lib/import/students.ts`, `src/lib/import/payments.ts`
*   `src/components/ImportWizard.tsx`
*   `assets/import-templates/*.xlsx`

**Verification:** Import a sample file with deliberate errors — confirm the system catches them and denies the commit. Import a clean file — confirm rows land in the DB and appear in the UI.

### Task 8: Solidify Fee Logic + `docs/fee-logic.md` Improvement Plan ⬜ PENDING
*(High complexity — domain modelling + docs)*

**Objective:** Eliminate ambiguity around "what is owed, when, and how discounts apply". Document the rules in `docs/fee-logic.md` so the next developer (or AI assistant) can extend the system safely.

**High-Level Steps:**
1.  Model fee structures explicitly: per-term base fee + per-learner add-ons, with proration rules for mid-term joins.
2.  Encode discount types: sibling, early-payment, bursary — each with explicit eligibility and precedence.
3.  Refactor `PaymentManager` balance computation into a pure function `computeBalance(studentId, yearId)` with unit tests.
4.  Add automated overdue reminders (cron-style hook for future SMS/email integration; stub for now).
5.  Write `docs/fee-logic.md` covering: data model, edge cases (transfers mid-term, refunds, write-offs), extension points, test scenarios.
6.  Add audit-log entries on every balance mutation.

**Key Files:**
*   `src/lib/fees/balance.ts` (new pure function)
*   `src/lib/fees/discounts.ts`
*   `src/components/FeeStructureManager.tsx`, `PaymentManager.tsx` (refactors)
*   `src/lib/fees/reminders.ts` (stub for future SMS/email integration)
*   `docs/fee-logic.md` (new)

**Verification:** Run unit tests on `computeBalance` across fixture scenarios (paid, owing, partial, refunded, written-off). Read `docs/fee-logic.md` and confirm every rule from stakeholder conversations in Phase 2 is documented.

---

## Phase 4: Strategic Inferred Features (Post-MVP)

These are mentioned for completeness; they aren't planned for a specific phase yet.

*   **Enhanced Student Profiles:** enrollment history, attendance tracking.
*   **Role-Based Access Control (RBAC):** Admin, Staff, Teacher, Finance roles.
*   **Communication Hub:** SMS / WhatsApp bulk sends, payment reminders.
*   **Reporting Suite:** printable directories, financial summaries, attendance.
*   **Audit Logs (extended):** cross-cutting audit trail visualiser.
*   **Payment Gateway Integration:** Peach, PayFast, Flutterwave; aligns with EcoCash/MoMo for the African market.
*   **Future AI Integration:** LangGraph + OpenRouter foundation for personalised insights, parent Q&A bots, smart forecasting.

---

## Cross-Cutting Standards

*   **TDD where it pays off:** Fee balance logic, age calculation, license-key validation, custom-list filtering — write the test first.
*   **Backwards compat:** Every schema change is a real SQLite migration with an idempotent guard (`try/catch ADD COLUMN`).
*   **Activity log:** every mutation to students / payments / users / lists / structure must log `actor, action, entity, before/after`.
*   **Accessibility:** every interactive control meets keyboard + focus-visible standards; modal dialogs trap focus.
*   **POPIA-friendly defaults:** no logging of DOB, contact, or guardian email to console; redact before printing logs.
*   **Local-first:** no cloud call for printing, balance calc, or list management — all offline-safe.
