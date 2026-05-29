import { getBasePrintStyles } from './base-styles';
import type { ClassListData } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildClassListTitle(gradeLabel: string, sectionLabel?: string | null): string {
  return sectionLabel ? `${gradeLabel} - ${sectionLabel}` : `${gradeLabel} - All Learners`;
}

export function generateClassListHtml(data: ClassListData): string {
  const studentRows = data.students
    .map(
      (student, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="student-number">${escapeHtml(student.studentNumber || '')}</td>
          <td class="student-name">${escapeHtml(student.fullName)}</td>
          <td class="student-gender">${escapeHtml(student.gender || '-')}</td>
        </tr>
      `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${getBasePrintStyles()}
  <style>
    .class-list-container { padding: 20mm; font-family: Arial, Helvetica, sans-serif; min-height: 100vh; }
    .header { text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 24px; }
    .header .logo { margin-bottom: 12px; }
    .header .logo img { max-height: 60px; max-width: 150px; object-fit: contain; }
    .header h2 { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #1f2937; }
    .header .report-type { font-size: 16px; font-weight: 600; color: #f97316; margin-bottom: 8px; text-transform: uppercase; }
    .header .meta { font-size: 12px; color: #6b7280; }
    .header .meta span { margin: 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
    th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #374151; font-weight: 600; font-size: 12px; color: #374151; background-color: #f9fafb; text-transform: uppercase; }
    td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background-color: #f9fafb; }
    .student-number { font-family: monospace; }
    .student-name { font-weight: 600; }
    .student-gender { text-transform: capitalize; }
    .count { text-align: right; margin-top: 20px; font-weight: 700; font-size: 14px; color: #1f2937; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 2px dashed #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
    .footer .branding { font-weight: 600; color: #f97316; }
    @page { size: A4; margin: 10mm; }
  </style>
</head>
<body>
  <div class="class-list-container">
    <div class="header">
      ${data.schoolLogo ? `<div class="logo"><img src="${data.schoolLogo}" alt="School Logo" /></div>` : ''}
      <h2>${escapeHtml(data.schoolName)}</h2>
      <div class="report-type">Class List: ${escapeHtml(data.title)}</div>
      <div class="meta">
        <span>Academic Year: ${escapeHtml(data.academicYear)}</span>
        <span>Generated: ${escapeHtml(data.generatedAt)}</span>
        ${data.schoolContact ? `<span>${escapeHtml(data.schoolContact)}</span>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 10%">#</th>
          <th style="width: 25%">Learner Number</th>
          <th style="width: 50%">Name</th>
          <th style="width: 15%">Gender</th>
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
    </table>

    <div class="count">Total Learners: ${data.students.length}</div>

    <div class="footer">
      <div>This class list was generated using <span class="branding">SchoolFoundry</span></div>
    </div>
  </div>
</body>
</html>
`;
}
