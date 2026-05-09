# Student Accounts Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the student accounts area into focused modules under 400 lines each, preserving the current UI and print behavior while making future debugging safer.

**Architecture:** Keep `StudentAccounts.tsx` as a thin page orchestrator and move data loading, overview calculations, print actions, and JSX sections into dedicated files. Extract shared money/status formatting so signs, colors, and PDF values stay consistent across screen and print views.

**Tech Stack:** React 19, TypeScript, Electron preload API, Vite 8, existing `db-client` and `print-service`.

---

## File Structure

- Modify: `src/components/StudentAccounts.tsx`
  - Target: page state wiring and composition only, under 350 lines.
- Create: `src/components/student-accounts/types.ts`
  - Shared `Student`, `Grade`, `AcademicYear`, `Term`, overview, and statement types.
- Create: `src/components/student-accounts/formatters.ts`
  - `formatCurrencyCents`, `getBalanceTone`, `getBalancePrefix`.
- Create: `src/components/student-accounts/useStudentAccountsData.ts`
  - Loads years, grades, terms, students, statement details, and school branding.
- Create: `src/components/student-accounts/overview.ts`
  - Pure overview calculation from students, grades, filters, and selected grade.
- Create: `src/components/student-accounts/printActions.ts`
  - `printStudentStatement`, `printAllStatements`, and `printOverview`.
- Create: `src/components/student-accounts/StudentAccountsToolbar.tsx`
  - Year, grade, search, paid/owing filters, and primary actions.
- Create: `src/components/student-accounts/StudentAccountsTable.tsx`
  - Student account rows and selection behavior.
- Create: `src/components/student-accounts/FinancialOverviewPanel.tsx`
  - Overview cards, rows, totals, and print button.
- Create: `src/components/student-accounts/EmptyFinancialState.tsx`
  - Empty/loading overview state.
- Modify: `src/components/StatementPrintView.tsx`
  - Replace inline formatting with shared formatter helpers.

## Task 1: Lock Current Behavior With Compile Checks

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add a typecheck script**

```json
"scripts": {
  "dev": "vite & electron .",
  "build": "vite build && electron-builder",
  "start": "electron .",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 2: Run the baseline check**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

## Task 2: Extract Types And Formatters

**Files:**
- Create: `src/components/student-accounts/types.ts`
- Create: `src/components/student-accounts/formatters.ts`
- Modify: `src/components/StudentAccounts.tsx`
- Modify: `src/components/StatementPrintView.tsx`

- [ ] **Step 1: Move shared interfaces into `types.ts`**

```ts
export interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  grade_id: number;
  balance: number;
  invoiced: number;
  paid: number;
  guardian_name: string;
  guardian_contact: string;
  guardian_name_2: string;
  guardian_contact_2: string;
  guardian_email: string;
  school_logo?: string;
}
```

- [ ] **Step 2: Add currency helpers**

```ts
export function formatCurrencyCents(cents: number): string {
  const prefix = cents === 0 ? '' : '+';
  return `${prefix}$${Math.abs(cents / 100).toFixed(2)}`;
}

export function getBalanceColor(cents: number): string {
  if (cents > 0) return '#dc2626';
  if (cents < 0) return '#10B981';
  return '#059669';
}
```

- [ ] **Step 3: Replace inline balance rendering**

Use `formatCurrencyCents(balance)` and `getBalanceColor(balance)` everywhere balances are rendered.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`

Expected: PASS.

## Task 3: Extract Pure Overview Logic

**Files:**
- Create: `src/components/student-accounts/overview.ts`
- Modify: `src/components/StudentAccounts.tsx`

- [ ] **Step 1: Move `getOverviewData` into a pure function**

```ts
export function buildOverviewData(input: {
  students: Student[];
  grades: Grade[];
  selectedGrade: number | null;
  showPaid: boolean;
  showOwing: boolean;
}) {
  // Move the existing calculation here without changing its output shape.
}
```

- [ ] **Step 2: Replace local function usage**

```ts
const currentOverview = buildOverviewData({
  students,
  grades,
  selectedGrade,
  showPaid,
  showOwing,
});
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`

Expected: PASS.

## Task 4: Extract Data Hook

**Files:**
- Create: `src/components/student-accounts/useStudentAccountsData.ts`
- Modify: `src/components/StudentAccounts.tsx`

- [ ] **Step 1: Move database loading into the hook**

The hook owns `academicYears`, `grades`, `termsList`, `currentPeriod`, `students`, `schoolName`, `schoolLogo`, `schoolContact`, and loading functions.

- [ ] **Step 2: Keep page-owned UI state in `StudentAccounts.tsx`**

The page keeps modal visibility, selected student, filters, search, and print preview state.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`

Expected: PASS.

## Task 5: Extract Visual Sections

**Files:**
- Create: `src/components/student-accounts/StudentAccountsToolbar.tsx`
- Create: `src/components/student-accounts/StudentAccountsTable.tsx`
- Create: `src/components/student-accounts/FinancialOverviewPanel.tsx`
- Create: `src/components/student-accounts/EmptyFinancialState.tsx`
- Modify: `src/components/StudentAccounts.tsx`

- [ ] **Step 1: Extract toolbar controls**

Move the year/grade/search/filter/action JSX into `StudentAccountsToolbar`.

- [ ] **Step 2: Extract student table**

Move `filteredStudents.map(...)` row rendering into `StudentAccountsTable`.

- [ ] **Step 3: Extract overview panel**

Move overview cards, detail rows, total balance, and print button into `FinancialOverviewPanel`.

- [ ] **Step 4: Verify line counts**

Run: `Get-ChildItem src\components\student-accounts -File | ForEach-Object { "$($_.Name): $((Get-Content $_.FullName).Count)" }`

Expected: every new file is under 400 lines and `StudentAccounts.tsx` is under 400 lines.

- [ ] **Step 5: Verify app**

Run: `npm run typecheck`

Expected: PASS.

## Task 6: Final Production Pass

**Files:**
- Modify: extracted files as needed

- [ ] **Step 1: Run formatter**

Run: `npx prettier --write src/components/StudentAccounts.tsx src/components/StatementPrintView.tsx src/components/student-accounts`

Expected: files format cleanly.

- [ ] **Step 2: Run build**

Run: `npx vite build`

Expected: renderer, main, and preload bundles build successfully.

- [ ] **Step 3: Start the app**

Run: `npx vite`

Expected: Vite serves at `http://localhost:5173/` and no JSX transform errors appear.

## Self-Review

- Spec coverage: fixes the immediate syntax problem, defines the under-400-line component target, separates logic from JSX, and keeps printing behavior in scope.
- Placeholder scan: no implementation step depends on an undefined path or unspecified module.
- Type consistency: shared types are introduced before hooks, overview logic, and components consume them.
