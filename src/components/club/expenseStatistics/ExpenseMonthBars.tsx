'use client';

import { useMemo, useState } from 'react';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import {
  MONTH_LABELS,
  MONTH_SHORT_LABELS,
  formatExpenseEuro,
  type ExpenseCategoryRow,
} from '@/lib/club/expenseStatisticsShared';

const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

/**
 * Vertical list of types of expense (alphabetical), each with 12 month bars and a
 * side table of the values — same layout idea as the Super Admin "Vertical bars".
 */
export default function ExpenseMonthBars({ rows }: { rows: ExpenseCategoryRow[] }) {
  const theme = useStatisticsGraphTheme();
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const maxValue = useMemo(() => {
    let max = 1;
    for (const row of rows) for (const m of row.months) max = Math.max(max, m.amount);
    return max;
  }, [rows]);

  const barH = 9;
  const barGap = 2;
  const rowH = 12 * barH + 11 * barGap + 16;
  const headerH = 30;

  if (rows.length === 0) {
    return (
      <div
        className="border p-8 text-center"
        style={{ ...theme.panelStyle, color: theme.background.muted }}
      >
        No expenses yet.
      </div>
    );
  }

  const monthColor = (i: number) => theme.seriesColor(i);

  return (
    <div className="overflow-x-auto border p-3" style={theme.panelStyle}>
      <div className="flex min-w-[980px] items-start gap-3">
        <div className="min-w-[360px] flex-1">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-1 text-[11px] font-semibold"
            style={{ minHeight: headerH, borderColor: theme.background.border }}
          >
            {MONTH_SHORT_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                className="inline-flex items-center gap-1 hover:opacity-80"
                onMouseEnter={() => setHoverMonth(i)}
                onMouseLeave={() => setHoverMonth(null)}
                title={MONTH_LABELS[i]}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: monthColor(i) }}
                  aria-hidden
                />
                <span style={{ color: theme.background.text }}>{label}</span>
              </button>
            ))}
          </div>

          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-stretch border-b"
              style={{
                height: rowH,
                borderColor: theme.background.border,
                background:
                  hoverRow === row.key ? theme.background.activeSurface : 'transparent',
              }}
              onMouseEnter={() => setHoverRow(row.key)}
              onMouseLeave={() => setHoverRow(null)}
            >
              <div
                className="flex w-44 shrink-0 items-center px-1.5 text-[11px]"
                style={{ color: theme.background.text }}
                title={row.label}
              >
                <span className="truncate">{row.label}</span>
              </div>
              <div
                className="flex min-w-0 flex-1 flex-col justify-center px-1"
                style={{ gap: barGap }}
              >
                {row.months.map((cell, i) => {
                  const pct = Math.max(0, Math.min(100, (cell.amount / maxValue) * 100));
                  const dimmed = hoverMonth != null && hoverMonth !== i;
                  return (
                    <div
                      key={i}
                      className="rounded-sm"
                      style={{
                        height: barH,
                        background: theme.background.isDark ? 'rgba(255,255,255,0.1)' : '#f1f1f1',
                      }}
                      title={`${row.label} · ${MONTH_LABELS[i]}: ${formatExpenseEuro(cell.amount)} (${cell.count})`}
                      onMouseEnter={() => setHoverMonth(i)}
                      onMouseLeave={() => setHoverMonth(null)}
                    >
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${pct}%`,
                          minWidth: cell.amount > 0 ? 3 : 0,
                          backgroundColor: monthColor(i),
                          opacity: dimmed ? 0.25 : 1,
                          transition: 'opacity 120ms ease',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div
          className="shrink-0 overflow-hidden border"
          style={{ borderColor: theme.background.border }}
        >
          <div
            className="grid border-b text-[10px] font-semibold uppercase"
            style={{
              gridTemplateColumns: 'repeat(12, 3.4rem) 4.6rem',
              height: headerH,
              borderColor: theme.background.border,
              color: theme.background.text,
            }}
          >
            {MONTH_SHORT_LABELS.map((label, i) => (
              <div
                key={label}
                className="flex items-center justify-center border-l first:border-l-0"
                style={{ color: monthColor(i), borderColor: theme.background.border }}
              >
                {label}
              </div>
            ))}
            <div
              className="flex items-center justify-center border-l font-bold"
              style={{ color: '#dc2626', borderColor: theme.background.border }}
            >
              Total
            </div>
          </div>
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid border-b text-[10px] tabular-nums"
              style={{
                gridTemplateColumns: 'repeat(12, 3.4rem) 4.6rem',
                height: rowH,
                borderColor: theme.background.border,
                background:
                  hoverRow === row.key ? theme.background.activeSurface : 'transparent',
                color: theme.background.text,
              }}
              onMouseEnter={() => setHoverRow(row.key)}
              onMouseLeave={() => setHoverRow(null)}
            >
              {row.months.map((cell, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center border-l font-semibold first:border-l-0"
                  style={{
                    borderColor: theme.background.border,
                    color: cell.amount > 0 ? monthColor(i) : theme.background.muted,
                    background:
                      hoverMonth === i ? theme.background.activeSurface : undefined,
                  }}
                  title={`${MONTH_LABELS[i]}: ${formatExpenseEuro(cell.amount)} (${cell.count} records)`}
                  onMouseEnter={() => setHoverMonth(i)}
                  onMouseLeave={() => setHoverMonth(null)}
                >
                  {cell.amount > 0 ? NUMBER.format(cell.amount) : '–'}
                </div>
              ))}
              <div
                className="flex items-center justify-center border-l font-bold"
                style={{ color: '#dc2626', borderColor: theme.background.border }}
                title={`Total: ${formatExpenseEuro(row.total.amount)} (${row.total.count} records)`}
              >
                {NUMBER.format(row.total.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px]" style={{ color: theme.background.muted }}>
        Values in €, rounded. Hover a month to highlight it.
      </p>
    </div>
  );
}
