import { redirect } from 'next/navigation';
import { EXPENSE_STATS_VIEW_META } from '@/lib/club/expenseStatisticsShared';

/** Landing → first graph (A), mirroring Super Admin General graphs entry. */
export default function ExpenseStatisticsIndexPage() {
  redirect(EXPENSE_STATS_VIEW_META.A.href);
}
