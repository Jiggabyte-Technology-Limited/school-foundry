import { getBasePrintStyles } from './base-styles';
import type { ReceiptData } from './types';

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
 *
 * For receipts specifically:
 * - Payment history should only show payments up to and including the current receipt
 * - Account balance should reflect the balance at the time of that receipt
 * - This ensures the receipt matches the original document given to the student
 */

export function generateReceiptHtml(data: ReceiptData): string {
  const {
    schoolName,
    receiptNumber,
    date,
    time,
    studentName,
    period,
    amount,
    currencySymbol = '$',
    paymentMethod,
    isVoided,
    voidReason,
    runningTotal,
    currentAmountDue,
    paymentHistory,
    recordedBy,
    currentReceiptNumber,
  } = data;

  const historyRows =
    paymentHistory
      ?.map(p => {
        const isCurrentReceipt = p.receiptNumber === currentReceiptNumber;
        const rowStyle = isCurrentReceipt
          ? 'border-top: 2px dotted #000; border-bottom: 2px dotted #000;'
          : p.isVoided
            ? 'opacity: 0.5;'
            : '';
        const textStyle = p.isVoided ? 'text-decoration: line-through;' : '';
        const highlightStar = isCurrentReceipt ? ' ★' : '';
        return `
    <tr style="${rowStyle}">
      <td style="padding: 4px 0; ${textStyle}${isCurrentReceipt ? 'font-weight: 700;' : ''}">${p.date}</td>
      <td style="padding: 4px 0; text-align: center; ${textStyle}${isCurrentReceipt ? 'font-weight: 700;' : ''}">${p.receiptNumber}${p.isVoided ? ' (VOID)' : ''}${highlightStar}</td>
      <td style="padding: 4px 0; text-align: center; ${textStyle}${isCurrentReceipt ? 'font-weight: 700;' : ''}">${p.termLabel || '-'}</td>
      <td style="padding: 4px 0; text-align: right; ${textStyle}${isCurrentReceipt ? 'font-weight: 700;' : ''}">+${currencySymbol}${p.amount}</td>
    </tr>
  `;
      })
      .join('') || '';

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
      <div class="powered">Powered by SchoolFoundry</div>
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
      <div class="details-row">
        <span>Recorded by:</span>
        <span>${recordedBy || 'System'}</span>
      </div>
    </div>
    
    <div class="amount-box">
      <div class="label">${isVoided ? 'ORIGINAL AMOUNT (VOIDED)' : 'AMOUNT PAID'}</div>
      <div class="value">+${currencySymbol}${amount}</div>
      ${isVoided && voidReason ? `<div class="void-reason">Reason: ${voidReason}</div>` : ''}
    </div>
    
    ${
      paymentHistory && paymentHistory.length > 0
        ? `
    <div class="history">
      <div class="history-title">PAYMENT HISTORY - ${period.split(',').pop()?.trim() || ''}</div>
      <table>
        <tbody>
          ${historyRows}
        </tbody>
      </table>
      ${
        currentAmountDue !== undefined
          ? `
      <div class="running-total" style="background-color: #f5f5f5;">
        <span class="label">ACCOUNT BALANCE</span>
        <span class="value" style="color: ${parseFloat(currentAmountDue) > 0 ? '#dc2626' : '#16a34a'};">
          ${parseFloat(currentAmountDue) > 0 ? '-' + currencySymbol + currentAmountDue : parseFloat(currentAmountDue) < 0 ? '+' + currencySymbol + Math.abs(parseFloat(currentAmountDue)).toFixed(2) : currencySymbol + '0.00'}
        </span>
      </div>
      `
          : ''
      }
    </div>
    `
        : ''
    }
    
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
      <p>Powered by <strong>SchoolFoundry</strong> - A product of <strong>Jiggabyte Technology Limited</strong></p>
      <p class="website">www.jiggabyte.co.zm</p>
    </div>
  </div>
</body>
</html>
`;
}
