export interface Student {
  id: number;
  full_name: string;
  grade_label: string;
  grade_id: number;
  balance: number;
  invoiced: number;
  paid: number;
  guardian_name: string;
  guardian_contact: string;
  guardian_name_2: string;
  guardian_contact_2: string;
  guardian_email: string;
  school_logo?: string;
  is_active: number;
  deactivated_at?: string | null;
  subsidy_name?: string;
  subsidy_cents?: number;
  is_protected?: boolean;
  is_vulnerable_child?: number;
  ovc_category?: string;
}

export interface Grade {
  id: number;
  label: string;
}

export interface AcademicYear {
  id: number;
  label: string;
}

export interface Term {
  id: number;
  label: string;
}

export interface OverviewRow {
  name: string;
  studentId?: string;
  balance: number;
  status: 'Paid' | 'Owing';
}

export interface OverviewData {
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  isGrade: boolean;
  rows: OverviewRow[];
}
