export * from './print';

export { getBasePrintStyles } from './print/base-styles';
export { generateReceiptHtml } from './print/receipt';
export { generatePaymentStatementHtml } from './print/payment-statement';
export { generateStudentStatementHtml } from './print/student-statement';
export { buildClassListTitle, generateClassListHtml } from './print/class-list';
export { generateOverviewHtml } from './print/overview';
export { generateFeeStructureHtml } from './print/fee-structure';
export { generatePaymentsOverviewHtml } from './print/payments-overview';
export { printDocument } from './print/print-document';

export type {
  PrintDocumentOptions,
  ReceiptData,
  PaymentStatementData,
  StudentStatementData,
  OverviewData,
  FeeStructureData,
  FeeStructureRow,
  PaymentsOverviewData,
} from './print/types';
