'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import { formatCount, formatEuro } from '@/components/admin/statistics/useAdminStatistics';
import type { StatsSlice } from '@/lib/admin/buildStatistics';

export type StatsChartMetric = 'users' | 'income';

type StatisticsMetricContextValue = {
  metric: StatsChartMetric;
  setMetric: (metric: StatsChartMetric) => void;
  isIncome: boolean;
  metricLabel: string;
  formatMetricValue: (value: number) => string;
  sliceValue: (slice: Pick<StatsSlice, 'count' | 'income'>) => number;
};

const StatisticsMetricContext = createContext<StatisticsMetricContextValue | null>(null);

export function StatisticsMetricProvider({
  children,
  initialMetric = 'users',
  incomeLabel = 'Income',
  formatIncome = formatEuro,
}: {
  children: ReactNode;
  /** Defaults to 'users'. Club expense statistics start on 'income' (the € amount). */
  initialMetric?: StatsChartMetric;
  /** Label shown in tooltips for the 'income' metric. */
  incomeLabel?: string;
  /** Formatter for the 'income' metric. */
  formatIncome?: (value: number) => string;
}) {
  const [metric, setMetric] = useState<StatsChartMetric>(initialMetric);

  const formatMetricValue = useCallback(
    (value: number) => (metric === 'income' ? formatIncome(value) : formatCount(value)),
    [metric, formatIncome],
  );

  const sliceValue = useCallback(
    (slice: Pick<StatsSlice, 'count' | 'income'>) =>
      metric === 'income' ? Number(slice.income ?? 0) : Number(slice.count ?? 0),
    [metric],
  );

  const value = useMemo<StatisticsMetricContextValue>(
    () => ({
      metric,
      setMetric,
      isIncome: metric === 'income',
      metricLabel: metric === 'income' ? incomeLabel : 'Users',
      formatMetricValue,
      sliceValue,
    }),
    [formatMetricValue, incomeLabel, metric, sliceValue],
  );

  return (
    <StatisticsMetricContext.Provider value={value}>{children}</StatisticsMetricContext.Provider>
  );
}

export function useStatisticsMetric(): StatisticsMetricContextValue {
  const ctx = useContext(StatisticsMetricContext);
  if (!ctx) {
    // Safe default when used outside provider (shouldn't happen on stats pages).
    return {
      metric: 'users',
      setMetric: () => {},
      isIncome: false,
      metricLabel: 'Users',
      formatMetricValue: formatCount,
      sliceValue: (slice) => Number(slice.count ?? 0),
    };
  }
  return ctx;
}

/** Outline Users / Income switch — place on the right of every graph filter row. */
export function StatisticsMetricToggle({ className }: { className?: string }) {
  const theme = useStatisticsGraphTheme();
  const { metric, setMetric } = useStatisticsMetric();

  const btn = (id: StatsChartMetric, label: string) => {
    const active = metric === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setMetric(id)}
        aria-pressed={active}
        className="min-w-[5.5rem] border px-4 py-1.5 text-sm font-semibold transition"
        style={{
          borderColor: theme.background.border,
          background: active
            ? theme.background.isDark
              ? 'rgba(255,255,255,0.12)'
              : '#e8e8e8'
            : theme.background.panel,
          color: theme.background.text,
          boxShadow: active ? `inset 0 0 0 1px ${theme.background.accent}` : undefined,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={`inline-flex items-center gap-2 ${className ?? ''}`}
      role="group"
      aria-label="Switch chart metric"
    >
      {btn('users', 'Users')}
      {btn('income', 'Income')}
    </div>
  );
}

/** Remap slices so pie/legend show users or income with matching percents. */
export function slicesForMetric(
  slices: StatsSlice[],
  metric: StatsChartMetric,
): Array<StatsSlice & { value: number }> {
  const withValue = slices.map((s) => ({
    ...s,
    income: Number(s.income ?? 0),
    value: metric === 'income' ? Number(s.income ?? 0) : Number(s.count ?? 0),
  }));
  const total = withValue.reduce((sum, s) => sum + s.value, 0);
  return withValue.map((s) => ({
    ...s,
    percent: total > 0 ? Math.round((s.value / total) * 1000) / 10 : 0,
  }));
}
