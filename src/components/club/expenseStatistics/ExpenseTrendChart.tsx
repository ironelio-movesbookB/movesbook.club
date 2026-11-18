'use client';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import {
  formatExpenseEuro,
  type ExpenseTrendPoint,
} from '@/lib/club/expenseStatisticsShared';

/** Bars per year (last 9) + the "Average previous" bar, with a trend line. */
export default function ExpenseTrendChart({
  points,
  height = 380,
}: {
  points: ExpenseTrendPoint[];
  height?: number;
}) {
  const theme = useStatisticsGraphTheme();
  const empty = points.every((p) => p.amount === 0);

  if (empty) {
    return (
      <div
        className="border p-8 text-center"
        style={{ ...theme.panelStyle, color: theme.background.muted }}
      >
        No data
      </div>
    );
  }

  const data = points.map((p) => ({ ...p, name: p.label }));

  return (
    <div className="border p-3" style={theme.panelStyle}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 28, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.background.isDark ? 'rgba(148,163,184,0.25)' : '#e5e5e5'}
            />
            <XAxis
              dataKey="name"
              interval={0}
              tick={{ fill: theme.background.text, fontSize: 12, fontWeight: 600 }}
              stroke={theme.background.border}
            />
            <YAxis
              tick={{ fill: theme.background.muted, fontSize: 12 }}
              stroke={theme.background.border}
              tickFormatter={(v) => formatExpenseEuro(Number(v))}
              width={90}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const count = (item?.payload as ExpenseTrendPoint | undefined)?.count ?? 0;
                return [`${formatExpenseEuro(Number(value))} · ${count} records`, 'Expenses'];
              }}
              contentStyle={{
                background: theme.background.panel,
                borderColor: theme.background.border,
                color: theme.background.text,
              }}
            />
            <Bar dataKey="amount" name="Expenses" maxBarSize={64}>
              <LabelList
                dataKey="amount"
                position="top"
                fill={theme.background.text}
                fontSize={12}
                fontWeight={700}
                formatter={(value) => formatExpenseEuro(Number(value ?? 0))}
              />
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.isAverage ? theme.background.accentAlt : theme.background.accent}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="amount"
              name="Trend"
              stroke={theme.background.accentAlt}
              strokeWidth={2}
              dot={{ r: 3 }}
              legendType="none"
              tooltipType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
