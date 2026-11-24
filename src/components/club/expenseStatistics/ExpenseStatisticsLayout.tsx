'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, LineChart, PieChart } from 'lucide-react';
import {
  StatisticsGraphThemeProvider,
  useStatisticsGraphTheme,
} from '@/components/admin/statistics/StatisticsGraphTheme';
import { StatisticsMetricProvider } from '@/components/admin/statistics/StatisticsMetricToggle';
import { carryQuery } from '@/components/club/expenseStatistics/useExpenseStatistics';
import {
  EXPENSE_STATISTICS_BASE_PATH,
  EXPENSE_STATS_VIEWS,
  EXPENSE_STATS_VIEW_META,
  formatExpenseEuro,
  type ExpenseStatsView,
} from '@/lib/club/expenseStatisticsShared';

const VIEW_ICONS: Record<ExpenseStatsView, typeof PieChart> = {
  A: PieChart,
  B: PieChart,
  C: PieChart,
  D: PieChart,
  E: BarChart3,
  F: LineChart,
};

function Frame({ children }: { children: ReactNode }) {
  const theme = useStatisticsGraphTheme();
  const { background } = theme;
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const query = carryQuery(searchParams);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full" style={theme.rootStyle}>
      <nav
        aria-label="Expense statistics"
        className="w-64 shrink-0 space-y-1 border-r p-2"
        style={{ borderColor: background.border, background: background.panel }}
      >
        <Link
          href={`${EXPENSE_STATISTICS_BASE_PATH}${query}`}
          className="block px-3 py-2 text-sm font-bold"
          style={{ color: background.accent }}
        >
          Expense graphs
        </Link>
        {EXPENSE_STATS_VIEWS.map((view) => {
          const m = EXPENSE_STATS_VIEW_META[view];
          const Icon = VIEW_ICONS[view];
          const active = pathname === m.href || pathname.startsWith(`${m.href}/`);
          return (
            <Link
              key={view}
              href={`${m.href}${query}`}
              className="flex items-start gap-2 border px-3 py-2 text-sm transition"
              style={{
                borderColor: active ? background.accent : background.border,
                background: active ? background.activeSurface : 'transparent',
                color: background.text,
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: background.accent }} />
              <span>
                <span className="font-bold">{view}.</span> {m.menuLabel}
              </span>
            </Link>
          );
        })}
        <Link
          href="/clubs/archive_expense_list"
          className="mt-3 block px-3 py-2 text-xs underline"
          style={{ color: background.muted }}
        >
          ← Back to Expenses archive
        </Link>
      </nav>
      <main className="min-w-0 flex-1 p-3 md:p-4">{children}</main>
    </div>
  );
}

export default function ExpenseStatisticsLayout({ children }: { children: ReactNode }) {
  return (
    <StatisticsGraphThemeProvider>
      <StatisticsMetricProvider
        initialMetric="income"
        incomeLabel="Expenses"
        formatIncome={formatExpenseEuro}
      >
        <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
          <Frame>{children}</Frame>
        </Suspense>
      </StatisticsMetricProvider>
    </StatisticsGraphThemeProvider>
  );
}
