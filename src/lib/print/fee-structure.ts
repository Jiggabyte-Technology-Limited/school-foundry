import { getBasePrintStyles } from './base-styles';
import type { FeeStructureData } from './types';

export function generateFeeStructureHtml(data: FeeStructureData): string {
  const {
    schoolName,
    schoolLogo,
    schoolContact,
    academicYear,
    generatedAt,
    currencySymbol = '$',
    rows,
    gradeTotals,
    feesTerms,
  } = data;

  const logoHtml = schoolLogo
    ? `<div class="logo"><img src="${schoolLogo}" alt="School Logo" /></div>`
    : '';

  // Group rows by grade to create a matrix-like table
  const grades = [...new Set(rows.map(r => r.gradeLabel))];
  const terms = [...new Set(rows.map(r => r.termLabel))];

  // Create a map for quick lookup
  const amountMap: Record<string, string> = {};
  rows.forEach(r => {
    amountMap[`${r.gradeLabel}-${r.termLabel}`] = r.amount;
  });

  // Build matrix table rows - matching paper statement style
  const matrixRows = grades
    .map((grade, idx) => {
      const cells = terms
        .map(term => {
          const amount = amountMap[`${grade}-${term}`] || '0.00';
          return `<td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${currencySymbol}${amount}</td>`;
        })
        .join('');

      const gradeTotal = gradeTotals[grade] || '0.00';

      return `
      <tr style="${idx % 2 === 1 ? 'background-color: #fafafa;' : ''}">
        <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${grade}</td>
        ${cells}
        <td style="padding: 10px 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 700; background-color: #ecfdf5;">${currencySymbol}${gradeTotal}</td>
      </tr>
    `;
    })
    .join('');

  // Header cells for terms - matching paper statement style
  const termHeaders = terms
    .map(
      t =>
        `<th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #374151; background-color: #f9fafb; font-weight: 600; font-size: 12px; color: #374151;">${t}</th>`
    )
    .join('');

  // Terms and conditions section
  const termsHtml = feesTerms
    ? `
    <div class="terms-section">
      <div class="section-title">Terms and Conditions</div>
      <div class="terms-content">${feesTerms.replace(/\n/g, '<br/>')}</div>
    </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${getBasePrintStyles()}
  <style>
    .fee-structure-container { padding: 20mm; font-family: Arial, Helvetica, sans-serif; min-height: 100vh; }
    .header { text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 24px; }
    .header .logo { margin-bottom: 12px; }
    .header .logo img { max-height: 60px; max-width: 150px; }
    .header h2 { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #1f2937; }
    .header .report-type { font-size: 16px; font-weight: 600; color: #f97316; margin-bottom: 8px; }
    .header .meta { font-size: 12px; color: #6b7280; }
    .header .meta span { margin: 0 8px; }
    .section-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { padding: 12px 8px; text-align: center; border-bottom: 2px solid #374151; background-color: #f9fafb; font-weight: 600; font-size: 12px; color: #374151; }
    th:first-child { text-align: left; }
    th:last-child { text-align: right; }
    .terms-section { margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
    .terms-section .section-title { margin-bottom: 8px; }
    .terms-content { font-size: 12px; color: #4b5563; line-height: 1.6; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 2px dashed #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
    .footer .branding { font-weight: 600; color: #f97316; }
    .footer .company { color: #374151; }
    .footer .contact { margin-top: 4px; font-style: italic; }
    @media print {
      body { margin: 0; }
      .fee-structure-container { padding: 15mm; }
    }
  </style>
</head>
<body>
  <div class="fee-structure-container">
    <div class="header">
      ${logoHtml}
      <h2>${schoolName}</h2>
      ${schoolContact ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${schoolContact}</div>` : ''}
      <div class="report-type">School Fees Structure</div>
      <div class="meta">
        <span>Academic Year: <strong>${academicYear}</strong></span>
        <span>|</span>
        <span>Generated: ${generatedAt}</span>
      </div>
    </div>

    <div class="section-title">Fee Structure by Grade and Term</div>
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Grade / Form</th>
          ${termHeaders}
          <th style="text-align: right;">Year Total</th>
        </tr>
      </thead>
      <tbody>
        ${matrixRows}
      </tbody>
    </table>

    ${termsHtml}

    <div class="footer">
      <div>This report was generated using <span class="branding">SchoolFoundry</span> - a product of <span class="company">Jiggabyte Technology Limited</span></div>
      <div class="contact">For support, contact your school administrator or visit www.jiggabyte.co.zm</div>
    </div>
  </div>
</body>
</html>
`;
}
