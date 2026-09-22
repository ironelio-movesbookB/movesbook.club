'use client';

import type { ReactNode } from 'react';
import {
  STATS_KIND_LABELS,
  STATS_TYPE_KIND_FILTER_LABELS,
  STATS_USER_KINDS,
  type StatsTypeKindFilter,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';
import { formatCount, formatEuro } from '@/components/admin/statistics/useAdminStatistics';
import {
  StatisticsGraphThemeProvider,
  useStatisticsGraphTheme,
} from '@/components/admin/statistics/StatisticsGraphTheme';
import {
  StatisticsMetricProvider,
  StatisticsMetricToggle,
} from '@/components/admin/statistics/StatisticsMetricToggle';

type StatisticsPageShellProps = {
  title: string;
  description?: string;
  totalUsers: number;
  incomeEuro: number;
  loading?: boolean;
  error?: string | null;
  filters?: ReactNode;
  children: ReactNode;
};

function StatisticsPageShellInner({
  title,
  description,
  totalUsers,
  incomeEuro,
  loading,
  error,
  filters,
  children,
}: StatisticsPageShellProps) {
  const theme = useStatisticsGraphTheme();
  const { background, palette, cyclePalette, cycleBackground, rootStyle, panelStyle } = theme;

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3 md:p-4" style={rootStyle}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: background.accent }}
          >
            General graphs
          </p>
          <h1 className="mt-0.5 text-xl font-bold" style={{ color: background.text }}>
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-sm" style={{ color: background.muted }}>
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-stretch justify-end gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cyclePalette}
              className="flex min-w-[8.5rem] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md"
              style={panelStyle}
              title="Cycle chart color palette"
            >
              Change colors
              <span className="text-xs font-medium" style={{ color: background.muted }}>
                {palette.label}
              </span>
            </button>
            <button
              type="button"
              onClick={cycleBackground}
              className="flex min-w-[8.5rem] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-md"
              style={panelStyle}
              title="Cycle page background"
            >
              Change background
              <span className="text-xs font-medium" style={{ color: background.muted }}>
                {background.label}
              </span>
            </button>
          </div>

          <div
            className="min-w-[7.5rem] border px-3 py-2"
            style={panelStyle}
          >
            <div className="text-[10px] uppercase tracking-wide" style={{ color: background.muted }}>
              Users
            </div>
            <div className="mt-0.5 text-xl font-bold" style={{ color: background.accent }}>
              {loading ? '…' : formatCount(totalUsers)}
            </div>
          </div>
          <div
            className="min-w-[7.5rem] border px-3 py-2"
            style={panelStyle}
          >
            <div className="text-[10px] uppercase tracking-wide" style={{ color: background.muted }}>
              Income (€)
            </div>
            <div className="mt-0.5 text-xl font-bold" style={{ color: background.accentAlt }}>
              {loading ? '…' : formatEuro(incomeEuro)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="mb-3 flex flex-wrap items-end justify-between gap-3 border p-2.5"
        style={panelStyle}
      >
        <div className="flex flex-wrap items-end gap-3">{filters}</div>
        <StatisticsMetricToggle className="ml-auto" />
      </div>

      {error ? (
        <div className="mb-3 border border-[#e0a0a0] bg-[#fde8e8] px-4 py-2.5 text-sm text-[#8a1f1f]">
          {error}
        </div>
      ) : null}

      {loading && !error ? (
        <div className="border p-8 text-center" style={{ ...panelStyle, color: background.muted }}>
          Loading statistics…
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default function StatisticsPageShell(props: StatisticsPageShellProps) {
  return (
    <StatisticsGraphThemeProvider>
      <StatisticsMetricProvider>
        <StatisticsPageShellInner {...props} />
      </StatisticsMetricProvider>
    </StatisticsGraphThemeProvider>
  );
}

type SelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

export function StatisticsSelect({ id, label, value, onChange, options }: SelectProps) {
  const theme = useStatisticsGraphTheme();
  return (
    <label htmlFor={id} className="flex min-w-[180px] flex-col gap-1 text-sm">
      <span className="font-semibold" style={{ color: theme.background.text }}>
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border px-2 py-1.5 text-sm"
        style={{
          background: theme.background.panel,
          borderColor: theme.background.border,
          color: theme.background.text,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function countryFilterOptions(countries: string[]) {
  return [
    { value: '', label: 'All countries (world)' },
    ...countries.map((c) => ({ value: c, label: c })),
  ];
}

export function userTypeFilterOptions(includeAll = true) {
  const kinds = STATS_USER_KINDS.map((k) => ({
    value: k,
    label: STATS_KIND_LABELS[k],
  }));
  return includeAll ? [{ value: 'all', label: 'All types' }, ...kinds] : kinds;
}

/** Dropdown for users-by-country bars (Each type = 5 colored bars). */
export function usersByCountryFilterOptions() {
  return [
    { value: 'all', label: 'Each type of users' },
    ...STATS_USER_KINDS.map((k) => ({
      value: k,
      label:
        k === 'single'
          ? 'Athletes'
          : k === 'clubs'
            ? 'Clubs'
            : STATS_KIND_LABELS[k],
    })),
  ];
}

/** Options for type-by-country pie (includes ALL Users / except Groups). */
export function typeKindFilterOptions() {
  const extras: StatsTypeKindFilter[] = ['all', 'except_groups'];
  return [
    ...extras.map((k) => ({ value: k, label: STATS_TYPE_KIND_FILTER_LABELS[k] })),
    ...STATS_USER_KINDS.map((k) => ({
      value: k,
      label: STATS_KIND_LABELS[k],
    })),
  ];
}

export function kindLabel(kind: StatsUserKind): string {
  return STATS_KIND_LABELS[kind];
}
