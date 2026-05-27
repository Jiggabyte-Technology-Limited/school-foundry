import { getBasePrintStyles } from './base-styles';
import type { OverviewData } from './types';

export function generateOverviewHtml(data: OverviewData): string {
  const {
    schoolName,
    schoolLogo,
    schoolContact,
    reportTitle,
    currentTerm,
    generatedAt,
    currencySymbol = '$',
    totalInvoiced,
    totalPaid,
    balance,
    rows,
  } = data;

  const hasStudentIds = rows.some(r => r.studentId);

  const rowHtml = rows
    .map(
      r => `
    <tr>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">${r.name}</td>
      ${hasStudentIds ? `<td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${r.studentId || '-'}</td>` : ''}
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${currencySymbol}${r.balance}</td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background-color: ${r.status === 'Paid' ? '#D1FAE5' : '#FEE2E2'}; color: ${r.status === 'Paid' ? '#065F46' : '#991B1B'};">${r.status}</span>
      </td>
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
    .overview-container { padding: 20mm; font-family: Arial, Helvetica, sans-serif; }
    .header { text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 24px; }
    .header .logo { margin-bottom: 12px; }
    .header .logo img { max-height: 60px; max-width: 150px; }
    .header h2 { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #1f2937; }
    .header .report-type { font-size: 16px; font-weight: 600; color: #f97316; margin-bottom: 8px; }
    .header .meta { font-size: 12px; color: #6b7280; }
    .header .meta span { margin: 0 8px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
    .summary-item { border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-item .label { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
    .summary-item .value { font-size: 22px; font-weight: 700; }
    .summary-item.invoiced .value { color: #374151; }
    .summary-item.collected .value { color: #059669; }
    .summary-item.balance .value { color: #dc2626; }
    .section-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #374151; font-weight: 600; font-size: 12px; color: #374151; background-color: #f9fafb; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 2px dashed #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
    .footer .branding { font-weight: 600; color: #f97316; }
    .footer .company { color: #374151; }
    .footer .contact { margin-top: 4px; font-style: italic; }
    .balance-row { margin-top: 20px; padding: 16px; border: 2px solid #374151; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background-color: #f9fafb; }
    .balance-row .balance-label { font-size: 14px; font-weight: 600; color: #374151; }
    .balance-row .balance-value { font-size: 24px; font-weight: 700; color: #dc2626; }
    .overview-container { page-break-after: always; }
    .overview-container:last-child { page-break-after: avoid; }
    @page { size: A4; margin: 10mm; }
  </style>
</head>
<body>
  <div class="overview-container">
    <div class="header">
      ${schoolLogo ? `<div class="logo"><img src="${schoolLogo}" alt="School Logo" /></div>` : ''}
      <h2>${schoolName}</h2>
      <div class="report-type">${reportTitle}</div>
      <div class="meta">
        ${currentTerm ? `<span>Term: ${currentTerm}</span>` : ''}
        <span>Generated: ${generatedAt}</span>
        ${schoolContact ? `<span>Contact: ${schoolContact}</span>` : ''}
      </div>
    </div>
    
    <div class="summary">
      <div class="summary-item invoiced">
        <div class="label">Total Fees Charged</div>
        <div class="value">${currencySymbol}${totalInvoiced}</div>
      </div>
      <div class="summary-item collected">
        <div class="label">Total Paid</div>
        <div class="value">${currencySymbol}${totalPaid}</div>
      </div>
      <div class="summary-item balance">
        <div class="label">Amount Outstanding</div>
        <div class="value">${currencySymbol}${balance}</div>
      </div>
    </div>
    
    <div class="section-title">${hasStudentIds ? 'Learner' : 'Grade'} Details</div>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          ${hasStudentIds ? '<th>ID</th>' : ''}
          <th style="text-align: right;">Amount Owing</th>
          <th style="text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml}
      </tbody>
    </table>
    
    <div class="balance-row">
      <span class="balance-label">Total Outstanding Balance</span>
      <span class="balance-value">${currencySymbol}${balance}</span>
    </div>
    
    <div class="footer">
      <div>This report was generated using <span class="branding">SchoolFoundry</span> - a product of <span class="company">Jiggabyte Technology Limited</span></div>
      <div class="contact">For support, contact your school administrator or visit www.jiggabyte.co.zm</div>
    </div>
  </div>
</body>
</html>
`;
}
