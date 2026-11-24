'use client';

import { notFound, useParams } from 'next/navigation';
import ExpenseStatisticsView from '@/components/club/expenseStatistics/ExpenseStatisticsView';
import {
  EXPENSE_STATS_VIEWS,
  type ExpenseStatsView,
} from '@/lib/club/expenseStatisticsShared';

function parseView(raw: string | undefined): ExpenseStatsView | null {
  const key = String(raw || '')
    .trim()
    .toUpperCase() as ExpenseStatsView;
  return EXPENSE_STATS_VIEWS.includes(key) ? key : null;
}

export default function ExpenseStatisticsViewPage() {
  const params = useParams();
  const view = parseView(
    typeof params?.view === 'string'
      ? params.view
      : Array.isArray(params?.view)
        ? params.view[0]
        : undefined,
  );
  if (!view) notFound();
  return <ExpenseStatisticsView view={view} />;
}
