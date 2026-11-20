import ExpenseStatisticsLayout from '@/components/club/expenseStatistics/ExpenseStatisticsLayout';

export default function ExpenseStatisticsRootLayout({ children }: { children: React.ReactNode }) {
  return <ExpenseStatisticsLayout>{children}</ExpenseStatisticsLayout>;
}
