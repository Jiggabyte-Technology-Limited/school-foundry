import type { Grade, OverviewData, Student } from './types';

interface BuildOverviewDataInput {
  students: Student[];
  grades: Grade[];
  selectedGrade: number | null;
  showPaid: boolean;
  showOwing: boolean;
}

export function buildOverviewData({
  students,
  grades,
  selectedGrade,
  showPaid,
  showOwing,
}: BuildOverviewDataInput): OverviewData {
  const isGrade = !!selectedGrade;
  const dataToUse = isGrade ? students : grades;

  const totalInvoiced = dataToUse.reduce((sum: number, item: any) => {
    if (isGrade) return sum + (item.invoiced || 0);
    const gradeStudents = students.filter(s => s.grade_id === item.id);
    return (
      sum + gradeStudents.reduce((studentSum, student) => studentSum + (student.invoiced || 0), 0)
    );
  }, 0);

  const totalPaid = dataToUse.reduce((sum: number, item: any) => {
    if (isGrade) return sum + (item.paid || 0);
    const gradeStudents = students.filter(s => s.grade_id === item.id);
    return sum + gradeStudents.reduce((studentSum, student) => studentSum + (student.paid || 0), 0);
  }, 0);

  const rows = isGrade
    ? students
        .filter(student => {
          const isPaid = student.balance <= 0;
          const isOwing = student.balance > 0;
          return (showPaid && isPaid) || (showOwing && isOwing);
        })
        .map(student => ({
          name: student.full_name,
          studentId: String(student.id),
          balance: student.balance,
          status: student.balance <= 0 ? ('Paid' as const) : ('Owing' as const),
        }))
    : grades
        .map(grade => {
          const gradeStudents = students.filter(student => student.grade_id === grade.id);
          const gradeBalance = gradeStudents.reduce((sum, student) => sum + student.balance, 0);
          return {
            name: grade.label,
            balance: gradeBalance,
            status: gradeBalance <= 0 ? ('Paid' as const) : ('Owing' as const),
          };
        })
        .filter(grade => {
          const isPaid = grade.balance <= 0;
          const isOwing = grade.balance > 0;
          return (showPaid && isPaid) || (showOwing && isOwing);
        });

  return {
    totalInvoiced,
    totalPaid,
    balance: totalInvoiced - totalPaid,
    isGrade,
    rows,
  };
}
