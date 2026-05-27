import { getBasePrintStyles } from './base-styles';
import type { StudentStatementData } from './types';

/*
 * IMPORTANT DEVELOPMENT NOTE FOR AI MODELS AND DEVELOPERS:
 * ==========================================================
 * The UI preview (what users see on screen) MUST always match exactly what gets printed.
 * This is critical because the UI is showing the user exactly what will be printed.
 *
 * When making changes to receipt or statement functionality:
 * 1. Always update BOTH the print template AND the UI preview component
 * 2. Test by printing and comparing side-by-side with the UI preview
 * 3. Any data filtering in the print function MUST be replicated in the UI preview
 * 4. This applies to: generateReceiptHtml, generateStudentStatementHtml, and any other print functions
 */

export function generateStudentStatementHtml(data: StudentStatementData): string {
  const {
    schoolName,
    schoolLogo,
    schoolContact,
    currentTerm,
    generatedAt,
    currencySymbol = '$',
    studentName,
    grade,
    studentId,
    guardianName,
    guardianContact,
    isOwing,
    totalInvoiced,
    totalPaid,
    balance,
    fees,
    payments,
  } = data;

  const transactions = [
    ...fees.map(f => ({
      date: f.date ? f.date.split('T')[0] : '',
      type: 'Debit',
      details: `${f.termLabel}: School Fees`,
      amount: f.amount,
      isCredit: false,
    })),
    ...payments.map(p => ({
      date: p.date ? p.date.split('T')[0] : '',
      type: 'Payment',
      details: `Receipt Number: ${p.ref}`,
      amount: p.amount,
      isCredit: true,
    })),
  ].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const transactionRows = transactions
    .map(
      t => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 8px;">${t.date}</td>
      <td style="padding: 10px 8px;"><span style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background-color: ${t.isCredit ? '#D1FAE5' : '#FEE2E2'}; color: ${t.isCredit ? '#065F46' : '#991B1B'};">${t.type}</span></td>
      <td style="padding: 10px 8px;">${t.details}</td>
      <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: ${t.isCredit ? '#059669' : '#dc2626'};">${t.isCredit ? '-' : '+'}${currencySymbol}${t.amount}</td>
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
    .statement-container { padding: 20mm; font-family: Arial, Helvetica, sans-serif; min-height: 100vh; }
    .header { text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 24px; }
    .header .logo { margin-bottom: 12px; }
    .header .logo img { max-height: 60px; max-width: 150px; }
    .header h2 { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #1f2937; }
    .header .report-type { font-size: 16px; font-weight: 600; color: #f97316; margin-bottom: 8px; }
    .header .meta { font-size: 12px; color: #6b7280; }
    .header .meta span { margin: 0 8px; }
    .learner-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; background: #f9fafb; padding: 16px; border-radius: 8px; }
    .learner-info h3 { font-size: 18px; font-weight: 800; margin: 0 0 8px 0; color: #1f2937; }
    .learner-info .details { font-size: 12px; color: #6b7280; }
    .learner-info .details span { margin-right: 16px; }
    .status { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status.owing { background-color: #FEE2E2; color: #991B1B; }
    .status.paid { background-color: #D1FAE5; color: #065F46; }
    .section-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #374151; font-weight: 600; font-size: 12px; color: #374151; background-color: #f9fafb; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 2px dashed #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
    .footer .branding { font-weight: 600; color: #f97316; }
    .footer .company { color: #374151; }
    .footer .contact { margin-top: 4px; font-style: italic; }
    .balance-row { margin-top: 20px; padding: 16px; border: 2px solid #374151; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; background-color: #f9fafb; }
    .balance-row .balance-label { font-size: 14px; font-weight: 600; color: #374151; }
    .balance-row .balance-value { font-size: 24px; font-weight: 700; color: #dc2626; }
    .statement-container { page-break-after: always; }
    .statement-container:last-child { page-break-after: avoid; }
    @page { size: A4; margin: 10mm; }
  </style>
</head>
<body>
  <div class="statement-container">
    <div class="header">
      ${schoolLogo ? `<div class="logo"><img src="${schoolLogo}" alt="School Logo" /></div>` : ''}
      <h2>${schoolName}</h2>
      <div class="report-type">Statement of Account</div>
      <div class="meta">
        ${currentTerm ? `<span>${currentTerm}</span>` : ''}
        <span>Generated: ${generatedAt}</span>
        ${schoolContact ? `<span>${schoolContact}</span>` : ''}
      </div>
    </div>
    
    <div class="learner-info">
      <div>
        <h3>${studentName}</h3>
        <div class="details">
          <span>${grade}</span>
          <span>ID: ${studentId}</span>
        </div>
        <div class="details">
          Guardian: ${guardianName} | ${guardianContact}
        </div>
      </div>
      <div class="status ${isOwing ? 'owing' : 'paid'}">${isOwing ? 'Owing' : 'Paid'}</div>
    </div>
    
    <div class="section-title">Transaction Details</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Details</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${transactionRows}
      </tbody>
    </table>
    
    <div class="balance-row">
      <span class="balance-label">Account Balance</span>
      <span class="balance-value">${currencySymbol}${balance}</span>
    </div>
    
    <div class="footer">
      <div>This statement was generated using <span class="branding">SchoolFoundry</span> - a product of <span class="company">Jiggabyte Technology Limited</span></div>
      <div class="contact">For support, contact your school administrator or visit www.jiggabyte.co.zm</div>
    </div>
  </div>
</body>
</html>
`;
}
