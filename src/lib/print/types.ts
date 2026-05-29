export interface PrintDocumentOptions {
  html: string;
  filename: string;
  title: string;
}

export interface ReceiptData {
  schoolName: string;
  receiptNumber: string;
  date: string;
  time: string;
  studentName: string;
  period: string;
  amount: string;
  currencySymbol?: string;
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
  recordedBy?: string;
  currentReceiptNumber?: string;
}

export interface PaymentStatementData {
  schoolName: string;
  period: string;
  currencySymbol?: string;
  payments: Array<{
    date: string;
    receiptNumber: string;
    studentName: string;
    period: string;
    recordedBy: string;
    amount: string;
  }>;
  total: string;
}

export interface StudentStatementData {
  schoolName: string;
  schoolLogo?: string;
  schoolContact?: string;
  currentTerm?: string;
  generatedAt: string;
  currencySymbol?: string;
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
    date: string;
    termLabel: string;
    description: string;
    amount: string;
  }>;
  payments: Array<{
    date: string;
    ref: string;
    amount: string;
  }>;
}

export interface ClassListData {
  schoolName: string;
  schoolLogo?: string;
  schoolContact?: string;
  title: string;
  academicYear: string;
  generatedAt: string;
  students: Array<{
    studentNumber?: string;
    fullName: string;
    gender?: string;
  }>;
}

export interface OverviewData {
  schoolName: string;
  schoolLogo?: string;
  schoolContact?: string;
  reportTitle: string;
  currentTerm?: string;
  generatedAt: string;
  currencySymbol?: string;
  totalInvoiced: string;
  totalPaid: string;
  balance: string;
  rows: Array<{
    name: string;
    studentId?: string;
    balance: string;
    status: string;
  }>;
}

export interface FeeStructureRow {
  gradeLabel: string;
  termLabel: string;
  amount: string;
}

export interface PaymentsOverviewData {
  schoolName: string;
  schoolLogo?: string;
  currentTerm: string;
  generatedAt: string;
  currencySymbol?: string;
  todayTotal: number;
  todayCount: number;
  weekTotal: number;
  weekCount: number;
  monthTotal: number;
  yearTotal: number;
  expectedTermTotal: number;
  paidTermTotal: number;
  outstandingTerm: number;
  expectedYearTotal: number;
  paidYearTotal: number;
  outstandingYear: number;
}

export interface FeeStructureData {
  schoolName: string;
  schoolLogo?: string;
  schoolContact?: string;
  academicYear: string;
  generatedAt: string;
  currencySymbol?: string;
  rows: FeeStructureRow[];
  gradeTotals: Record<string, string>;
  feesTerms?: string;
}
