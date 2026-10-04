'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type CostRecoveryChartRow = {
  key: string;
  label: string;
  /** Planned bar color (color of the type of user). */
  plannedColor: string;
  /** Slice color in the distribution pies. */
  pieColor: string;
  planN: number;
  planEur: number;
  realN: number;
  realEur: number;
};

type Metric = 'users' | 'income';

const REAL_RED = '#e8261c';
const REAL_LIGHT_GREEN = '#7ee05a';
const ROW_HEIGHT = 64;

function formatValue(value: number, metric: Metric): string {
  const n = value.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false });
  return metric === 'income' ? `${n} €` : n;
}

function percent(part: number, whole: number): string {
  return whole > 0 ? String(Math.round((part / whole) * 1000) / 10) : '0';
}

function DistributionPie({
  title,
  titleBackground,
  background,
  rows,
  metric,
  pick,
}: {
  title: string;
  titleBackground: string;
  background: string;
  rows: CostRecoveryChartRow[];
  metric: Metric;
  pick: (row: CostRecoveryChartRow) => number;
}) {
  const total = rows.reduce((s, r) => s + pick(r), 0);
  const data = rows.map((r) => ({ key: r.key, label: r.label, value: pick(r), color: r.pieColor }));
  const slices = data.filter((d) => d.value > 0);
  return (
    <div className="flex-1 border border-gray-300 p-3" style={{ background }}>
      <div
        className="mx-auto mb-2 w-48 py-1 text-center text-lg text-white"
        style={{ background: titleBackground }}
      >
        {title}
      </div>
      <div className="h-48">
        {slices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius="90%"
                innerRadius="48%"
                paddingAngle={slices.length > 1 ? 1 : 0}
                isAnimationActive={false}
              >
                {slices.map((d) => (
                  <Cell key={d.key} fill={d.color} stroke="#9ca3af" strokeWidth={0.5} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${formatValue(Number(value), metric)} (${percent(Number(value), total)}%)`,
                  String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 bg-white/70 p-2 text-sm text-gray-900">
        {data.map((d) => (
          <li key={d.key} className="flex min-w-0 items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 shrink-0"
              style={{ background: d.color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)' }}
              aria-hidden
            />
            <span className="truncate">
              {d.label} ({percent(d.value, total)}%) <b>{formatValue(d.value, metric)}</b>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Chart trend: bars Planned vs Real per row + distribution pies of Planned and Real. */
export default function CostRecoveryChartModal({
  title,
  rows,
  visibleRows = 6,
  onClose,
}: {
  title: string;
  rows: CostRecoveryChartRow[];
  visibleRows?: number;
  onClose: () => void;
}) {
  const [metric, setMetric] = useState<Metric>('users');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const plan = (r: CostRecoveryChartRow) => (metric === 'income' ? r.planEur : r.planN);
  const real = (r: CostRecoveryChartRow) => (metric === 'income' ? r.realEur : r.realN);
  const max = Math.max(1, ...rows.flatMap((r) => [plan(r), real(r)]));
  const plannedColors = [...new Set(rows.map((r) => r.plannedColor))];

  const metricButton = (id: Metric, label: string) => (
    <button
      type="button"
      onClick={() => setMetric(id)}
      aria-pressed={metric === id}
      className={`min-w-[5.5rem] border px-4 py-1 text-sm font-semibold ${
        metric === id ? 'border-[#45818e] bg-[#dbeef0] text-gray-900' : 'border-gray-300 bg-white text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto border-2 border-gray-800 bg-white p-4 shadow-2xl"
      >
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <h2 className="mr-auto text-lg font-bold text-gray-900">{title}</h2>
          <span className="flex items-center gap-2 text-sm text-gray-800">
            <span className="flex h-4 w-14 overflow-hidden border border-gray-500">
              {plannedColors.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </span>
            Planned
          </span>
          <span className="flex items-center gap-2 text-sm text-gray-800">
            <span className="h-4 w-14 border border-gray-500" style={{ background: REAL_RED }} />
            Real
          </span>
          <div className="flex gap-2">
            {metricButton('users', 'Users')}
            {metricButton('income', 'Income')}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-600 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-600">
          Real bars are red, light green when higher than Planned.
        </p>

        <div
          className="overflow-y-auto border border-gray-300"
          style={{ maxHeight: ROW_HEIGHT * visibleRows + 2 }}
        >
          {rows.map((r, i) => {
            const p = plan(r);
            const v = real(r);
            return (
              <div
                key={r.key}
                className={`flex items-stretch ${i % 2 ? 'bg-[#f6f6f6]' : 'bg-white'}`}
                style={{ height: ROW_HEIGHT }}
              >
                <div className="flex w-32 shrink-0 items-center justify-center border-r border-gray-300 px-2 text-center text-sm font-semibold text-gray-800">
                  {r.label}
                </div>
                <div className="flex w-24 shrink-0 flex-col justify-center border-r border-gray-300 px-2 text-sm leading-tight">
                  <span className="text-[#555555]">{formatValue(p, metric)}</span>
                  <span className="text-black">{formatValue(v, metric)}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3">
                  <div
                    className={`h-4 ${p > 0 ? 'border border-black/20' : ''}`}
                    style={{ width: `${(p / max) * 100}%`, minWidth: p > 0 ? 2 : 0, background: r.plannedColor }}
                    title={`Planned: ${formatValue(p, metric)}`}
                  />
                  <div
                    className={`h-4 ${v > 0 ? 'border border-black/20' : ''}`}
                    style={{
                      width: `${(v / max) * 100}%`,
                      minWidth: v > 0 ? 2 : 0,
                      background: v > p ? REAL_LIGHT_GREEN : REAL_RED,
                    }}
                    title={`Real: ${formatValue(v, metric)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-4 md:flex-row">
          <DistributionPie
            title="Planned"
            titleBackground="#3c78d8"
            background="#e2efff"
            rows={rows}
            metric={metric}
            pick={plan}
          />
          <DistributionPie
            title="Real"
            titleBackground="#45818e"
            background="#e8fbf8"
            rows={rows}
            metric={metric}
            pick={real}
          />
        </div>
      </div>
    </div>
  );
}
