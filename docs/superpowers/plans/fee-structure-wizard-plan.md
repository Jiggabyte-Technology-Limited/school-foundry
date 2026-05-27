# Fee Structure Configuration Wizard Plan

## Problem Statement
The current configuration panel in Fee Structure Manager uses cryptic icons (pencil for edit, × for delete) without labels or descriptions. This is not user-friendly for non-tech-savvy users who need to:
- Add/edit/delete payment periods
- Manage academic years
- Add/edit grades/forms
- Set dates for periods

## Proposed Solution: Multi-Step Configuration Wizard

Replace the current inline configuration panel with a modal-based wizard that guides users through each configuration task step-by-step.

---

### Option A: Tabbed Configuration Modal

A single modal with clear tabs for each configuration area:

1. **Academic Years Tab**
   - List existing years with clear "Edit" and "Delete" buttons (text, not icons)
   - "Add New Year" button opens inline form
   - Each year shows: Label, status (current/past), student count

2. **Grades/Forms Tab**
   - Grid view of all grades with clear action buttons
   - "Add Grade" button with modal form
   - Edit/Delete with confirmation dialogs

3. **Payment Periods Tab** (Primary Focus)
   - Wizard-style: Step 1 → Step 2 → Step 3
   - **Step 1: Choose Period Type**
     - Visual cards: Monthly | Quarterly | Half-Year | Custom
     - Each shows example: "12 periods (Jan-Dec)" | "4 terms" | "2 semesters"
   - **Step 2: Review & Customize Dates**
     - Auto-generated periods shown as cards
     - Each card has editable date pickers
     - Add/remove periods capability
   - **Step 3: Confirm**
     - Summary of what will be created
     - Warning about existing periods being replaced

4. **Quick Actions Panel**
   - "Apply Fees to Students" button with clear description
   - Status indicator showing if fees are applied

---

### Option B: Dedicated Configuration Pages

Separate full-page views for each configuration area:

1. **Academic Years Page**
   - Timeline view of years
   - Click year to see associated terms and students

2. **Payment Periods Page**
   - Calendar-style visualization
   - Drag-and-drop to adjust dates
   - Clear wizard for creating new periods

3. **Grades Setup Page**
   - Card grid for each grade
   - Shows fee configuration status per grade

---

## Recommended: Option A (Tabbed Modal)

**Rationale:**
- Keeps all configuration in one accessible place
- Less navigation required
- Progressive disclosure reduces overwhelm
- Closer to current UX (just improved)

---

## UI/UX Improvements Required

### 1. Replace Icons with Text Buttons
```diff
- <pencil icon>
- ×
+ Edit
+ Delete
```

### 2. Add Descriptive Labels
- "Configure" → "Setup Academic Year & Terms"
- Add tooltips explaining each section

### 3. Confirmation Dialogs
- Delete operations need clear confirmation:
  - "Are you sure you want to delete [Term Name]?"
  - Warning: "This will also delete X associated fee records"

### 4. Progress Indicators
- Show current step in wizard (Step 1 of 3)
- Progress bar for multi-step tasks

### 5. Help Text & Examples
- Placeholder text: "e.g. 2026-2027" not just "e.g. 2026"
- Tooltip: "Payment periods define when fees are charged"

---

## Implementation Priority

1. **High**: Replace edit/delete icons with text buttons + confirmation dialogs
2. **High**: Improve Payment Periods wizard with visual stepper
3. **Medium**: Add descriptive section headers and help text
4. **Medium**: Academic Years management improvement
5. **Low**: Calendar visualization for payment periods

---

## Component Changes

### New Components to Create
- `ConfigWizard.tsx` - Main tabbed modal container
- `AcademicYearTab.tsx` - Year management
- `GradeTab.tsx` - Grade management  
- `PaymentPeriodWizard.tsx` - Multi-step period creation
- `ConfirmDialog.tsx` - Reusable confirmation dialog

### Files to Modify
- `FeeStructureManager.tsx` - Integrate new wizard, remove inline config panel
- Add CSS for wizard steps, progress indicators
