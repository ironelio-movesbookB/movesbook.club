'use client';

import { Suspense, useState } from 'react';
import { StatisticsSelect } from '@/components/admin/statistics/StatisticsPageShell';
import {
  StatisticsPieBlock,
  StatisticsVersionsBars,
} from '@/components/admin/statistics/StatisticsCharts';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import ExpenseMonthBars from '@/components/club/expenseStatistics/ExpenseMonthBars';
import ExpenseStatisticsShell, {
  ExpensePrevNext,
  categoryOptions,
  categoryStep,
  monthOptions,
} from '@/components/club/expenseStatistics/ExpenseStatisticsShell';
import ExpenseTrendChart from '@/components/club/expenseStatistics/ExpenseTrendChart';
import { useExpenseStatistics } from '@/components/club/expenseStatistics/useExpenseStatistics';
import type { StatsSlice } from '@/lib/admin/buildStatistics';
import type { StatsVersionBucket } from '@/lib/admin/statisticsKinds';
import {
  EXPENSE_TOP_N,
  EXPENSE_TREND_YEARS,
  MONTH_LABELS,
  MONTH_SHORT_LABELS,
  formatExpenseEuro,
  type ExpenseCell,
  type ExpenseStatisticsPayload,
  type ExpenseStatsView,
} from '@/lib/club/expenseStatisticsShared';

function cellSubtitle(cell: ExpenseCell | { amount: number; count: number }): string {
  return `${formatExpenseEuro(cell.amount)} · ${cell.count} record${cell.count === 1 ? '' : 's'}`;
}

function EmptyNotice({ children }: { children: string }) {
  const theme = useStatisticsGraphTheme();
  return (
    <div
      className="border p-8 text-center"
      style={{ ...theme.panelStyle, color: theme.background.muted }}
    >
      {children}
    </div>
  );
}

function PieBarSwitch({
  mode,
  onChange,
}: {
  mode: 'pie' | 'bars';
  onChange: (mode: 'pie' | 'bars') => void;
}) {
  const theme = useStatisticsGraphTheme();
  const btn = (id: 'pie' | 'bars', label: string) => {
    const active = mode === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={active}
        onClick={() => onChange(id)}
        className="min-w-[5.5rem] border px-3 py-1.5 text-sm font-semibold transition"
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
    <div className="inline-flex items-center gap-2" role="group" aria-label="Graph type">
      {btn('pie', 'Pie')}
      {btn('bars', 'Vertical graph')}
    </div>
  );
}

function ViewA({ data }: { data: ExpenseStatisticsPayload }) {
  const [mode, setMode] = useState<'pie' | 'bars'>('pie');
  const block = data.a;
  const selected = data.selectedCategory;
  if (!block || !selected) {
    return <EmptyNotice>No types of expense yet.</EmptyNotice>;
  }
  const title = `${selected.label} — ${data.year}`;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex justify-end">
        <PieBarSwitch mode={mode} onChange={setMode} />
      </div>
      {mode === 'pie' ? (
        <StatisticsPieBlock
          title={title}
          subtitle={`Months · ${cellSubtitle(block.total)}`}
          slices={block.slices}
          height={360}
        />
      ) : (
        <div>
          <h3 className="mb-1 text-lg font-bold">{title}</h3>
          <p className="mb-2 text-base opacity-70">Months · {cellSubtitle(block.total)}</p>
          <StatisticsVersionsBars
            // Reuses the Versions bar graph: the "version" axis is the month here.
            rows={block.slices.map((s, i) => ({
              version: MONTH_SHORT_LABELS[i] as StatsVersionBucket,
              count: s.count,
              income: s.income,
            }))}
            height={360}
            fillColor="#058592"
          />
        </div>
      )}
    </div>
  );
}

function PieOrBars({
  title,
  subtitle,
  slices,
  height,
  mode,
  /** Months axis (A/B) vs expense-label axis (C/D). */
  barAxis = 'labels',
}: {
  title: string;
  subtitle: string;
  slices: StatsSlice[];
  height: number;
  mode: 'pie' | 'bars';
  barAxis?: 'months' | 'labels';
}) {
  if (mode === 'pie') {
    return (
      <StatisticsPieBlock title={title} subtitle={subtitle} slices={slices} height={height} />
    );
  }
  return (
    <div>
      <h3 className="mb-1 text-lg font-bold">{title}</h3>
      <p className="mb-2 text-base opacity-70">{subtitle}</p>
      <StatisticsVersionsBars
        rows={slices.map((s, i) => ({
          version: (barAxis === 'months'
            ? MONTH_SHORT_LABELS[i] ?? s.label.slice(0, 3)
            : s.label.slice(0, 18) || `Item ${i + 1}`) as StatsVersionBucket,
          count: s.count,
          income: s.income,
        }))}
        height={height}
        fillColor="#058592"
      />
    </div>
  );
}

function ViewB({ data }: { data: ExpenseStatisticsPayload }) {
  const [mode, setMode] = useState<'pie' | 'bars'>('pie');
  const block = data.b;
  if (!block || block.pies.length === 0) {
    return <EmptyNotice>{`No expenses in ${data.year}.`}</EmptyNotice>;
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <PieBarSwitch mode={mode} onChange={setMode} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {block.pies.map((pie) => (
          <PieOrBars
            key={pie.key}
            title={pie.label}
            subtitle={cellSubtitle({ amount: pie.total, count: pie.count })}
            slices={pie.slices}
            height={240}
            mode={mode}
            barAxis="months"
          />
        ))}
      </div>
      {block.rest ? (
        <PieOrBars
          title={block.rest.label}
          subtitle={cellSubtitle({ amount: block.rest.total, count: block.rest.count })}
          slices={block.rest.slices}
          height={260}
          mode={mode}
          barAxis="months"
        />
      ) : null}
    </div>
  );
}

function ViewC({ data }: { data: ExpenseStatisticsPayload }) {
  const [mode, setMode] = useState<'pie' | 'bars'>('pie');
  const block = data.c;
  if (!block) return <EmptyNotice>No expenses.</EmptyNotice>;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex justify-end">
        <PieBarSwitch mode={mode} onChange={setMode} />
      </div>
      <PieOrBars
        title={`${block.monthLabel} ${data.year} — top ${EXPENSE_TOP_N} types of expense + rest`}
        subtitle={cellSubtitle(block.total)}
        slices={block.slices}
        height={360}
        mode={mode}
      />
    </div>
  );
}

function ViewD({ data }: { data: ExpenseStatisticsPayload }) {
  const [mode, setMode] = useState<'pie' | 'bars'>('pie');
  const block = data.d;
  if (!block) return <EmptyNotice>No expenses.</EmptyNotice>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <PieBarSwitch mode={mode} onChange={setMode} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {block.months.map((m) => (
          <PieOrBars
            key={m.key}
            title={`${m.label} ${data.year}`}
            subtitle={cellSubtitle({ amount: m.total, count: m.count })}
            slices={m.slices}
            height={230}
            mode={mode}
          />
        ))}
      </div>
    </div>
  );
}

function ViewF({ data }: { data: ExpenseStatisticsPayload }) {
  const block = data.f;
  const selected = data.selectedCategory;
  if (!block || !selected) return <EmptyNotice>No types of expense yet.</EmptyNotice>;
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-lg font-bold">{selected.label}</h3>
        <p className="text-base opacity-70">
          Last {EXPENSE_TREND_YEARS} years up to {data.year} + average of the previous ones ·{' '}
          {cellSubtitle(block.total)} overall
        </p>
      </div>
      <ExpenseTrendChart points={block.points} />
    </div>
  );
}

function ExpenseStatisticsViewInner({ view }: { view: ExpenseStatsView }) {
  const state = useExpenseStatistics(view);
  const { data, params, update } = state;

  const categories = data?.categories ?? [];
  const selectedKey = data?.selectedCategory?.key ?? params.type;

  const typeFilter =
    view === 'A' || view === 'F' ? (
      <>
        <StatisticsSelect
          id="expense-stats-type"
          label="Type of expense"
          value={selectedKey}
          onChange={(type) => update({ type })}
          options={
            categories.length > 0
              ? categoryOptions(categories)
              : [{ value: '', label: 'No types of expense' }]
          }
        />
        <ExpensePrevNext
          prevDisabled={categories.length < 2}
          nextDisabled={categories.length < 2}
          onPrev={() => {
            const type = categoryStep(categories, selectedKey, -1);
            if (type) update({ type });
          }}
          onNext={() => {
            const type = categoryStep(categories, selectedKey, 1);
            if (type) update({ type });
          }}
        />
      </>
    ) : null;

  const month = data?.selectedMonth ?? (params.month || new Date().getMonth() + 1);
  const monthFilter =
    view === 'C' ? (
      <>
        <StatisticsSelect
          id="expense-stats-month"
          label="Month"
          value={String(month)}
          onChange={(v) => update({ month: Number(v) })}
          options={monthOptions()}
        />
        <ExpensePrevNext
          onPrev={() => update({ month: month <= 1 ? 12 : month - 1 })}
          onNext={() => update({ month: month >= 12 ? 1 : month + 1 })}
          label={MONTH_LABELS[month - 1]}
        />
      </>
    ) : null;

  return (
    <ExpenseStatisticsShell
      view={view}
      state={state}
      yearLabel={view === 'F' ? 'Last year of the trend' : 'Year'}
      filters={
        <>
          {typeFilter}
          {monthFilter}
        </>
      }
    >
      {(payload) => {
        switch (view) {
          case 'A':
            return <ViewA data={payload} />;
          case 'B':
            return <ViewB data={payload} />;
          case 'C':
            return <ViewC data={payload} />;
          case 'D':
            return <ViewD data={payload} />;
          case 'E':
            return <ExpenseMonthBars rows={payload.e?.rows ?? []} />;
          case 'F':
            return <ViewF data={payload} />;
        }
      }}
    </ExpenseStatisticsShell>
  );
}

export default function ExpenseStatisticsView({ view }: { view: ExpenseStatsView }) {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <ExpenseStatisticsViewInner view={view} />
    </Suspense>
  );
}