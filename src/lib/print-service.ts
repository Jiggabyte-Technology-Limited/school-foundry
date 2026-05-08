import { PrintToPdfOptions } from './db-client';

export interface PrintDocumentOptions {
  html: string;
  filename: string;
  title: string;
}

export async function printDocument(options: PrintDocumentOptions): Promise<string | null> {
  try {
    const result = await window.api.printToPdf({
      html: options.html,
      filename: options.filename,
      title: options.title,
    });

    if (result.success && result.filePath) {
      await window.api.openFileForPrint(result.filePath);
      return result.filePath;
    } else {
      console.error('PDF generation failed:', result.error);
      return null;
    }
  } catch (err) {
    console.error('Print error:', err);
    return null;
  }
}

export function getBasePrintStyles(): string {
  return `
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #000;
        background: #fff;
      }
      @page {
        size: A4;
        margin: 10mm;
      }
    </style>
  `;
}

export function generateReceiptHtml(data: {
  schoolName: string;
  receiptNumber: string;
  date: string;
  time: string;
  studentName: string;
  period: string;
  amount: string;
  paymentMethod?: string;
  isVoided?: boolean;
  voidReason?: string;
  runningTotal?: string;
  currentAmountDue?: string;
  paymentHistory?: Array<{
    date: string;
    receiptNumber: string;
    termLabel: string;
    amount: string;
    isVoided: boolean;
  }>;
}): string {
  const { schoolName, receiptNumber, date, time, studentName, period, amount, paymentMethod, isVoided, voidReason, runningTotal, currentAmountDue, paymentHistory } = data;
  
  const historyRows = paymentHistory?.map(p => `
    <tr style="opacity: ${p.isVoided ? 0.5 : 1}">
      <td style="padding: 4px 0;">${p.date}</td>
      <td style="padding: 4px 0; text-align: center;">${p.receiptNumber}${p.isVoided ? ' (VOID)' : ''}</td>
      <td style="padding: 4px 0; text-align: center;">${p.termLabel}</td>
      <td style="padding: 4px 0; text-align: right;">$${p.amount}</td>
    </tr>
  `).join('') || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${getBasePrintStyles()}
  <style>
    .receipt-container { padding: 20px; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 16px; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; font-weight: 600; }
    .header .powered { font-size: 10px; margin-top: 4px; }
    .details { border-top: 1px dashed #333; border-bottom: 1px dashed #333; padding: 12px 0; margin-bottom: 16px; }
    .details-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
    .details-row:last-child { margin-bottom: 0; }
    .amount-box { text-align: center; margin-bottom: 16px; padding: 12px; border: 1px solid #333; }
    .amount-box .label { font-size: 11px; margin-bottom: 4px; }
    .amount-box .value { font-size: 28px; font-weight: 700; ${isVoided ? 'text-decoration: line-through;' : ''} }
    .amount-box .void-reason { font-size: 11px; margin-top: 4px; }
    .history { margin-bottom: 16px; }
    .history-title { font-size: 11px; font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 4px; }
    .history table { width: 100%; font-size: 10px; border-collapse: collapse; }
    .running-total { margin-top: 8px; padding: 8px; border: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
    .running-total .label { font-size: 11px; font-weight: 600; }
    .running-total .value { font-size: 14px; font-weight: 700; }
    .amount-due { margin-top: 8px; padding: 8px; border: 1px solid #333; display: flex; justify-content: space-between; align-items: center; background-color: #f5f5f5; }
    .amount-due .label { font-size: 11px; font-weight: 600; }
    .amount-due .value { font-size: 14px; font-weight: 700; color: #dc2626; }
    .footer { font-size: 10px; text-align: center; padding-top: 12px; border-top: 1px dashed #333; }
    .footer p { margin: 4px 0; }
    .footer .valid { font-weight: 600; }
    .terms { font-size: 9px; text-align: left; padding-top: 12px; margin-top: 8px; border-top: 1px dashed #333; }
    .terms-title { font-weight: 600; margin-bottom: 4px; }
    .terms ul { margin: 0; padding-left: 12px; line-height: 1.4; }
    .branding { font-size: 9px; text-align: center; padding-top: 12px; margin-top: 12px; border-top: 1px dashed #333; }
    .branding p { margin: 2px 0; }
    .branding .website { font-style: italic; }
    .voided-stamp { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 64px; font-weight: 800; color: #ccc; text-transform: uppercase; letter-spacing: 4px; pointer-events: none; white-space: nowrap; }
  </style>
</head>
<body>
  ${isVoided ? '<div class="voided-stamp">VOIDED</div>' : ''}
  <div class="receipt-container">
    <div class="header">
      <h1>OFFICIAL SCHOOL RECEIPT</h1>
      <div class="subtitle">${schoolName}</div>
      <div class="powered">Powered by FeesFoundry</div>
    </div>
    
    <div class="details">
      <div class="details-row">
        <span>Receipt No:</span>
        <span style="font-weight: 600;">${receiptNumber}</span>
      </div>
      <div class="details-row">
        <span>Date:</span>
        <span>${date} ${time}</span>
      </div>
      <div class="details-row">
        <span>Student:</span>
        <span style="font-weight: 600; text-align: right; max-width: 60%;">${studentName}</span>
      </div>
      <div class="details-row">
        <span>Period:</span>
        <span>${period}</span>
      </div>
      ${paymentMethod ? `
      <div class="details-row">
        <span>Payment Method:</span>
        <span>${paymentMethod}</span>
      </div>
      ` : ''}
    </div>
    
    <div class="amount-box">
      <div class="label">${isVoided ? 'ORIGINAL AMOUNT (VOIDED)' : 'AMOUNT PAID'}</div>
      <div class="value">$${amount}</div>
      ${isVoided && voidReason ? `<div class="void-reason">Reason: ${voidReason}</div>` : ''}
    </div>
    
    ${paymentHistory && paymentHistory.length > 0 ? `
    <div class="history">
      <div class="history-title">PAYMENT HISTORY</div>
      <table>
        <tbody>
          ${historyRows}
        </tbody>
      </table>
      ${runningTotal ? `
      <div class="running-total">
        <span class="label">RUNNING TOTAL</span>
        <span class="value">$${runningTotal}</span>
      </div>
      ` : ''}
      ${currentAmountDue && parseFloat(currentAmountDue) > 0 ? `
      <div class="amount-due">
        <span class="label">CURRENT AMOUNT DUE</span>
        <span class="value">$${currentAmountDue}</span>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="footer">
      <p class="valid">${isVoided ? '*** THIS PAYMENT HAS BEEN VOIDED ***' : '*** VALID PROOF OF PAYMENT ***'}</p>
      <p>Please retain this receipt for your records.</p>
    </div>
    
    <div class="terms">
      <div class="terms-title">TERMS & CONDITIONS:</div>
      <ul>
        <li>This receipt is valid proof of payment and must be retained for record purposes.</li>
        <li>All payments are non-refundable unless explicitly approved by school administration.</li>
        <li>Payment of school fees does not guarantee enrollment or continued enrollment.</li>
        <li>Outstanding fees may result in suspension of classes or exclusion from examinations.</li>
        <li>For any queries regarding this receipt, contact the school finance office.</li>
      </ul>
    </div>
    
    <div class="branding">
      <p>For assistance, contact: ${schoolName} Finance Office</p>
      <p>Powered by <strong>FeesFoundry</strong> - A product of <strong>Jiggabyte Technology Limited</strong></p>
      <p class="website">www.jiggabyte.co.zm</p>
    </div>
  </div>
</body>
</html>
`;
}

export function generatePaymentStatementHtml(data: {
  schoolName: string;
  period: string;
  payments: Array<{
    date: string;
    receiptNumber: string;
    studentName: string;
    period: string;
    recordedBy: string;
    amount: string;
  }>;
  total: string;
}): string {
  const { schoolName, period, payments, total } = data;
  
  const paymentRows = payments.map(p => `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px dashed #ccc;">${p.date}</td>
      <td style="padding: 6px 8px; border-bottom: 1px dashed #ccc;">${p.receiptNumber}</td>
      <td style="padding: 6px 8px; border-bottom: 1px dashed #ccc;">${p.studentName}</td>
      <td style="padding: 6px 8px; border-bottom: 1px dashed #ccc;">${p.period}</td>
      <td style="padding: 6px 8px; border-bottom: 1px dashed #ccc;">${p.recordedBy}</td>
      <td style="padding: 6px 8px; border-bottom: 1px dashed #ccc; text-align: right;">$${p.amount}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${getBasePrintStyles()}
  <style>
    .statement-container { padding: 40px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .header .school { font-size: 14px; margin-top: 4px; }
    .header .period { font-size: 11px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { padding: 8px; text-align: left; border-bottom: 1px solid #333; font-weight: 600; }
    .total-row { background-color: #f9f9f9; font-weight: 600; border-top: 2px solid #333; }
    .total-row td { padding: 12px; }
    .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #666; border-top: 1px dashed #333; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="statement-container">
    <div class="header">
      <h1>PAYMENT STATEMENT</h1>
      <div class="school">${schoolName}</div>
      <div class="period">${period}</div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Receipt No.</th>
          <th>Student</th>
          <th>Period</th>
          <th>Recorded By</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
        <tr class="total-row">
          <td colspan="5" style="text-align: right;">TOTAL:</td>
          <td style="text-align: right;">$${total}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="footer">
      Generated by FeesFoundry - Jiggabyte Technology Limited
    </div>
  </div>
</body>
</html>
`;
}

export function generateStudentStatementHtml(data: {
  schoolName: string;
  schoolLogo?: string;
  generatedAt: string;
  studentName: string;
  grade: string;
  studentId: string;
  guardianName: string;
  guardianContact: string;
  isOwing: boolean;
  totalInvoiced: string;
  totalPaid: string;
  balance: string;
  fees: Array<{
    termLabel: string;
    description: string;
    amount: string;
  }>;
  payments: Array<{
    date: string;
    ref: string;
    amount: string;
  }>;
}): string {
  const { schoolName, schoolLogo, generatedAt, studentName, grade, studentId, guardianName, guardianContact, isOwing, totalInvoiced, totalPaid, balance, fees, payments } = data;
  
  const feeRows = fees.map(f => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px;">${f.termLabel}: ${f.description}</td>
      <td style="padding: 8px; text-align: right;">$${f.amount}</td>
    </tr>
  `).join('');

  const paymentRows = payments.map(p => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 8px;">Payment - ${p.date} (Ref: ${p.ref})</td>
      <td style="padding: 8px; text-align: right;">-$${p.amount}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${getBasePrintStyles()}
  <style>
    .statement-container { padding: 20mm; }
    .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 24px; margin-bottom: 24px; }
    .header .logo { margin-bottom: 16px; }
    .header .logo img { max-height: 60px; max-width: 150px; }
    .header h2 { font-size: 22px; font-weight: 800; margin: 0 0 4px 0; }
    .header .meta { font-size: 12px; opacity: 0.6; }
    .student-info { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .student-info h3 { font-size: 18px; font-weight: 800; margin: 0 0 8px 0; }
    .student-info .details { font-size: 12px; }
    .student-info .details span { margin-right: 16px; }
    .status { padding: 4px 10px; border: 1px solid #000; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-item { border: 1px solid #eee; padding: 12px; text-align: center; }
    .summary-item .label { font-size: 10px; text-transform: uppercase; }
    .summary-item .value { font-size: 18px; font-weight: 700; }
    .summary-item.balance { border: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px; border-bottom: 1px solid #000; }
    .footer { position: absolute; bottom: 15mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="statement-container">
    <div class="header">
      ${schoolLogo ? `<div class="logo"><img src="${schoolLogo}" alt="School Logo" /></div>` : ''}
      <h2>${schoolName}</h2>
      <div class="meta">Statement of Account • ${generatedAt}</div>
    </div>
    
    <div class="student-info">
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
      <div class="status">${isOwing ? 'Owing' : 'Paid'}</div>
    </div>
    
    <div class="summary">
      <div class="summary-item">
        <div class="label">Invoiced</div>
        <div class="value">$${totalInvoiced}</div>
      </div>
      <div class="summary-item">
        <div class="label">Paid</div>
        <div class="value">$${totalPaid}</div>
      </div>
      <div class="summary-item balance">
        <div class="label">Balance</div>
        <div class="value">$${balance}</div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Detail</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${feeRows}
        ${paymentRows}
      </tbody>
    </table>
  </div>
</body>
</html>
`;
}

export function generateOverviewHtml(data: {
  schoolName: string;
  schoolLogo?: string;
  schoolContact?: string;
  reportTitle: string;
  currentTerm?: string;
  generatedAt: string;
  totalInvoiced: string;
  totalPaid: string;
  balance: string;
  rows: Array<{
    name: string;
    studentId?: string;
    balance: string;
    status: string;
  }>;
}): string {
  const { schoolName, schoolLogo, schoolContact, reportTitle, currentTerm, generatedAt, totalInvoiced, totalPaid, balance, rows } = data;
  
  const hasStudentIds = rows.some(r => r.studentId);
  
  const rowHtml = rows.map(r => `
    <tr>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb;">${r.name}</td>
      ${hasStudentIds ? `<td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${r.studentId || '-'}</td>` : ''}
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">$${r.balance}</td>
      <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background-color: ${r.status === 'Paid' ? '#D1FAE5' : '#FEE2E2'}; color: ${r.status === 'Paid' ? '#065F46' : '#991B1B'};">${r.status}</span>
      </td>
    </tr>
  `).join('');

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
        <div class="value">$${totalInvoiced}</div>
      </div>
      <div class="summary-item collected">
        <div class="label">Total Paid</div>
        <div class="value">$${totalPaid}</div>
      </div>
      <div class="summary-item balance">
        <div class="label">Amount Outstanding</div>
        <div class="value">$${balance}</div>
      </div>
    </div>
    
    <div class="section-title">${hasStudentIds ? 'Student' : 'Grade'} Details</div>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          ${hasStudentIds ? '<th>ID</th>' : ''}
          <th style="text-align: right;">Amount Owing</th>
          <th style="text-align: center;">Status</th>
        </tr>
      </tbody>
    </table>
    
    <div class="footer">
      <div>This report was generated using <span class="branding">FeesFoundry</span> - a product of <span class="company">Jiggabyte Technology Limited</span></div>
      <div class="contact">For support, contact your school administrator or visit www.jiggabyte.co.zm</div>
    </div>
  </div>
</body>
</html>
`;
}
