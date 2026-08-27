export interface Payment {
  id: number;
  student_id: number;
  year_id: number;
  term_id: number;
  receipt_number: string;
  amount_paid_cents: number;
  payment_date: string;
  received_by: number | null;
  recorded_by_name: string;
  student_name: string;
  year_label: string;
  term_label: string;
  guardian_name: string;
  guardian_contact: string;
  is_voided?: number;
  void_reason?: string;
  payment_method?: string;
}

export interface PaymentStats {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  yearTotal: number;
  todayCount: number;
  weekCount: number;
  expectedTermTotal: number;
  paidTermTotal: number;
  expectedYearTotal: number;
  paidYearTotal: number;
  outstandingTerm: number;
  outstandingYear: number;
}
