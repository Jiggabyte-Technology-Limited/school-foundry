# School Fees PDF Print Plan

## Overview
Create an A4 PDF document that displays the school's fee structure in a professional format, similar to student statements.

## Document Layout

### Page Specifications
- **Size**: A4 (210mm x 297mm)
- **Orientation**: Portrait
- **Margins**: 20mm all sides

### Header Section
- **School Logo**: Left-aligned, 60x60px max
- **School Name**: Bold, 24px, below logo
- **School Contact**: Phone/email if configured
- **Document Title**: "School Fees Structure" - centered, 18px, bold
- **Academic Year**: Below title, e.g., "Academic Year: 2026"

### Table Section
- **Columns**:
  1. Grade/Form (left-aligned)
  2. Payment Period (left-aligned)
  3. Amount (right-aligned)
  4. Total (right-aligned) - optional per grade

- **Styling**:
  - Header row: Light gray background (#f5f5f5), bold text
  - Alternating row colors: White / very light gray (#fafafa)
  - Borders: 1px solid #e0e0e0
  - Cell padding: 8px 12px

### Summary Section (Optional)
- Grand total per grade
- Payment period breakdown

### Footer
- Generated date: "Generated on: [date]"
- Page number if multi-page

## Implementation Steps

### 1. Create Print Service Function
- Add `generateFeeStructureHtml()` to `src/lib/print-service.ts`
- Accept parameters: schoolName, schoolLogo, schoolContact, year, grades, terms, matrix

### 2. Add Print Button Handler
- In `FeeStructureManager.tsx`, update the print button to:
  1. Gather current fee data (grades, terms, amounts)
  2. Call `generateFeeStructureHtml()`
  3. Use `printDocument()` to open print dialog

### 3. HTML Template Structure
```html
<div class="fee-structure-print">
  <header>
    <img src="logo" />
    <h1>School Name</h1>
    <p>Contact Info</p>
  </header>
  <h2>School Fees Structure - Year: 2026</h2>
  <table>
    <thead>
      <tr>
        <th>Grade/Form</th>
        <th>Payment Period</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <!-- Rows for each grade/term combination -->
    </tbody>
  </table>
  <footer>Generated on: [date]</footer>
</div>
```

### 4. CSS for Print
- Use `@media print` or print-specific styles
- Hide interactive elements
- Ensure page breaks work correctly

## Reuse Existing Code
- Use the same `printDocument()` function from `print-service.ts`
- Follow similar patterns to `generateStudentStatementHtml()`
- Reuse school settings (name, logo, contact) already available in component
