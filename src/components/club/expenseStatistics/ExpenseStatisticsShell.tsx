'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StatisticsSelect } from '@/components/admin/statistics/StatisticsPageShell';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import { formatCount } from '@/components/admin/statistics/useAdminStatistics';
import {
  EXPENSE_STATS_VIEW_META,
  MONTH_LABELS,
  formatExpenseEuro,
  type ExpenseBranchMode,
  type ExpenseCategory,
  type ExpenseStatisticsPayload,
  type ExpenseStatsView,
} from '@/lib/club/expenseStatisticsShared';
import type { useExpenseStatistics } from '@/components/club/expenseStatistics/useExpenseStatistics';

type StatsState = ReturnType<typeof useExpenseStatistics>;

/** Orange-style round prev / next arrows (chevrons). */
export function ExpensePrevNext({
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  label,
}: {
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  label?: string;
}) {
  const theme = useStatisticsGraphTheme();
  const btn = (dir: 'prev' | 'next') => {
    const disabled = dir === 'prev' ? prevDisabled : nextDisabled;
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={dir === 'prev' ? onPrev : onNext}
        disabled={disabled}
        aria-label={dir === 'prev' ? 'Previous' : 'Next'}
        title={dir === 'prev' ? 'Previous' : 'Next'}
        className="flex h-9 w-9 items-center justify-center rounded-full shadow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: '#ff8d00', color: '#111', border: '2px solid #111' }}
      >
        <Icon className="h-5 w-5 stroke-[2.5]" />
      </button>
    );
  };
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Scroll">
      {btn('prev')}
      {label ? (
        <span
          className="min-w-[8rem] text-center text-sm font-semibold"
          style={{ color: theme.background.text }}
        >
          {label}
        </span>
      ) : null}
      {btn('next')}
    </div>
  );
}

function BranchToggle({
  value,
  onChange,
}: {
  value: ExpenseBranchMode;
  onChange: (mode: ExpenseBranchMode) => void;
}) {
  const theme = useStatisticsGraphTheme();
  const btn = (id: ExpenseBranchMode, overhead: string) => {
    const active = value === id;
    return (
      <div key={id} className="flex flex-col items-center gap-1">
        <span
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color: theme.background.muted }}
        >
          {overhead}
        </span>
        <button
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={active}
          className="min-w-[7.5rem] border px-4 py-1.5 text-sm font-semibold transition"
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
          {overhead}
        </button>
      </div>
    );
  };
  return (
    <div
      className="inline-flex items-end gap-3"
      role="group"
      aria-label="Switch between main branches and sub-branches"
    >
      {btn('main', 'Main Branches')}
      {btn('sub', 'Sub-branches')}
    </div>
  );
}

/** Index helper for Prev/Next over an ordered list of categories. */
export function categoryStep(
  categories: ExpenseCategory[],
  currentKey: string | undefined,
  delta: -1 | 1,
): string | null {
  if (categories.length === 0) return null;
  const idx = categories.findIndex((c) => c.key === currentKey);
  const next = idx < 0 ? 0 : (idx + delta + categories.length) % categories.length;
  return categories[next].key;
}

type ShellProps = {
  view: ExpenseStatsView;
  state: StatsState;
  /** Extra filters rendered after Year (type / month selects, prev-next, pie/bar switch…). */
  filters?: ReactNode;
  /** Label of the Year select (Trend uses it as the last year of the window). */
  yearLabel?: string;
  children: (data: ExpenseStatisticsPayload) => ReactNode;
};

export default function ExpenseStatisticsShell({ view, state, filters, yearLabel, children }: ShellProps) {
  const theme = useStatisticsGraphTheme();
  const { background, palette, cyclePalette, cycleBackground, panelStyle } = theme;
  const meta = EXPENSE_STATS_VIEW_META[view];
  const { loading, error, data, params, update } = state;

  const year = data?.year ?? (params.year || new Date().getFullYear());
  const yearOptions = (data?.years ?? [year]).map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: background.accent }}
          >
            Expense graphs
          </p>
          <h1 className="mt-0.5 text-xl font-bold" style={{ color: background.text }}>
            {meta.title}
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm" style={{ color: background.muted }}>
            {meta.description}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-stretch justify-end gap-2">
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
          <div className="min-w-[7.5rem] border px-3 py-2" style={panelStyle}>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: background.muted }}>
              Records · {year}
            </div>
            <div className="mt-0.5 text-xl font-bold" style={{ color: background.accent }}>
              {loading ? '…' : formatCount(data?.totalCount ?? 0)}
            </div>
          </div>
          <div className="min-w-[7.5rem] border px-3 py-2" style={panelStyle}>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: background.muted }}>
              Expenses (€) · {year}
            </div>
            <div className="mt-0.5 text-xl font-bold" style={{ color: background.accentAlt }}>
              {loading ? '…' : formatExpenseEuro(data?.totalAmount ?? 0)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="mb-3 flex flex-wrap items-end justify-between gap-3 border p-2.5"
        style={panelStyle}
      >
        <div className="flex flex-wrap items-end gap-3">
          <StatisticsSelect
            id="expense-stats-year"
            label={yearLabel ?? 'Year'}
            value={String(year)}
            onChange={(v) => update({ year: Number(v) === new Date().getFullYear() ? 0 : Number(v) })}
            options={yearOptions}
          />
          <StatisticsSelect
            id="expense-stats-amount"
            label="Amount"
            value={params.amountBasis}
            onChange={(v) => update({ amount: v === 'paid' ? 'paid' : 'total' })}
            options={[
              { value: 'total', label: 'Total amount' },
              { value: 'paid', label: 'Paid amount' },
            ]}
          />
          {filters}
        </div>
        <BranchToggle value={params.branchMode} onChange={(branch) => update({ branch })} />
      </div>

      {error ? (
        <div className="mb-3 border border-[#e0a0a0] bg-[#fde8e8] px-4 py-2.5 text-sm text-[#8a1f1f]">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="border p-8 text-center" style={{ ...panelStyle, color: background.muted }}>
          Loading statistics…
        </div>
      ) : data ? (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {children(data)}
        </div>
      ) : null}
    </div>
  );
}

export function monthOptions() {
  return MONTH_LABELS.map((label, i) => ({ value: String(i + 1), label }));
}

export function categoryOptions(categories: ExpenseCategory[]) {
  return categories.map((c) => ({ value: c.key, label: c.label }));
}
