'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type ChartSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  title: string;
  subtitle?: string;
  slices: ChartSlice[];
  /** Show bar chart beside the pie (country / month drill-downs). */
  showBar?: boolean;
  valueSuffix?: string;
  onClose: () => void;
};

function formatValue(value: number, suffix?: string): string {
  const n = Number.isFinite(value) ? value : 0;
  const body =
    suffix === '%'
      ? `${n.toFixed(1)}%`
      : Number.isInteger(n)
        ? String(n)
        : n.toFixed(1);
  return suffix && suffix !== '%' ? `${body}${suffix}` : body;
}

export default function PromocodeStatsChartPanel({
  title,
  subtitle,
  slices,
  showBar = false,
  valueSuffix,
  onClose,
}: Props) {
  const chartData = slices.filter((s) => s.value > 0);
  const empty = chartData.length === 0;

  return (
    <div className="mt-4 border border-gray-300 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Close chart
        </button>
      </div>

      {empty ? (
        <p className="py-10 text-center text-sm text-gray-500">No data for this selection.</p>
      ) : (
        <div
          className={`grid gap-4 ${showBar ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  innerRadius="38%"
                  paddingAngle={1}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} stroke="#fff" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    formatValue(Number(value ?? 0), valueSuffix),
                    '',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {showBar ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={56}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [
                      formatValue(Number(value ?? 0), valueSuffix),
                      '',
                    ]}
                  />
                  <Bar dataKey="value" maxBarSize={36}>
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <ul
            className={`grid gap-1.5 text-sm text-gray-800 sm:grid-cols-2 ${
              showBar ? 'lg:col-span-2' : ''
            }`}
          >
            {chartData.map((entry) => (
              <li key={entry.key} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
                <span className="truncate">
                  {entry.label}{' '}
                  <strong>{formatValue(entry.value, valueSuffix)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
