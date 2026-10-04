'use client';

import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { SubscriptionDetailRow } from '@/lib/admin/buildStatistics';
import {
  STATS_DETAIL_KIND_COLORS,
  STATS_DETAIL_KIND_LABELS,
  STATS_DETAIL_KINDS,
  STATS_EXCLUDABLE_KINDS,
  type StatsDetailKind,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import {
  useStatisticsMetric,
  type StatsChartMetric,
} from '@/components/admin/statistics/StatisticsMetricToggle';
import { formatCount, formatEuro } from '@/components/admin/statistics/useAdminStatistics';

type Details = Record<StatsDetailKind, SubscriptionDetailRow>;
type Phase = 'new' | 'renew' | 'total';

type Props = {
  details: Details;
  excluded: StatsDetailKind[];
  onToggleExclude: (kind: StatsDetailKind) => void;
};

/** Table blocks, as laid out in the specification (two rows of three). */
const TABLE_BLOCKS: Array<{ kind: StatsDetailKind; title: string; text: string }[]> = [
  [
    { kind: 'clubAccounts', title: 'Club Members accounts', text: '#ffe600' },
    { kind: 'clubs', title: 'Clubs', text: '#ffffff' },
    { kind: 'teams', title: 'Teams', text: '#ffffff' },
  ],
  [
    { kind: 'coaches', title: 'Coaches', text: '#1f1f1f' },
    { kind: 'single', title: 'Athletes', text: '#ffffff' },
    { kind: 'groups', title: 'Groups', text: '#ffffff' },
  ],
];

const PHASES: Array<{ id: Phase; title: string; background: string }> = [
  { id: 'new', title: 'New subscriptions', background: '#dcf7fb' },
  { id: 'renew', title: 'Renewals', background: '#d9f5d6' },
  { id: 'total', title: 'Totals', background: '#fde1bf' },
];

const METRIC_BOX: Record<StatsChartMetric, { label: string; background: string }> = {
  users: { label: 'Users', background: '#fff3cd' },
  income: { label: 'Income', background: '#dcedd5' },
};

const ROW_H = 'h-10';
const HEAD_H = 'h-7';

function percent(part: number, whole: number): string {
  if (whole <= 0) return '0';
  const p = Math.round((part / whole) * 1000) / 10;
  return String(p);
}

function phaseValue(row: SubscriptionDetailRow, phase: Phase, metric: StatsChartMetric): number {
  const isIncome = metric === 'income';
  const n = isIncome ? row.newIncome : row.newCount;
  const r = isIncome ? row.renewIncome : row.renewCount;
  return phase === 'new' ? n : phase === 'renew' ? r : n + r;
}

function useKindColor() {
  const theme = useStatisticsGraphTheme();
  return (kind: StatsDetailKind) =>
    theme.palette.kinds[kind as StatsUserKind] ?? STATS_DETAIL_KIND_COLORS[kind];
}

function MetricBox({
  metric,
  className = '',
  highlighted,
}: {
  metric: StatsChartMetric;
  className?: string;
  highlighted?: boolean;
}) {
  const { setMetric } = useStatisticsMetric();
  const box = METRIC_BOX[metric];
  return (
    <button
      type="button"
      onClick={() => setMetric(metric)}
      title={`Show ${box.label.toLowerCase()} in the legends`}
      className={`flex w-full items-center justify-center border text-base text-gray-800 ${className}`}
      style={{
        background: box.background,
        borderColor: highlighted ? '#ff3b1f' : '#9ca3af',
        borderWidth: highlighted ? 3 : 1,
      }}
    >
      {box.label}
    </button>
  );
}

function KindTable({
  kind,
  title,
  text,
  row,
  grandUsers,
  grandIncome,
  excluded,
}: {
  kind: StatsDetailKind;
  title: string;
  text: string;
  row: SubscriptionDetailRow;
  grandUsers: number;
  grandIncome: number;
  excluded: boolean;
}) {
  const color = useKindColor()(kind);
  const usersTotal = row.newCount + row.renewCount;
  const incomeTotal = row.newIncome + row.renewIncome;
  const shaded = 'bg-[#efefef] text-[#a61c00]';
  const grey = 'bg-[#cccccc]';
  const cell = `border border-gray-300 px-1 text-center ${ROW_H}`;
  /** Empty cell when there is nothing to share (as in the specification), not "0". */
  const share = (part: number, whole: number) => (whole > 0 ? percent(part, whole) : '');
  const gen = (part: number, whole: number) => (excluded ? '—' : share(part, whole));

  const bodyRows: ReactNode[] = [
    <tr key="u%">
      <td className={cell}>%</td>
      <td className={`${cell} ${shaded}`}>{share(row.newCount, usersTotal)}</td>
      <td className={`${cell} ${shaded}`}>{share(row.renewCount, usersTotal)}</td>
      <td className={`${cell} ${grey}`} />
      <td className={`${cell} font-bold text-[#e01b00]`} title={excluded ? 'Excluded' : undefined}>
        {gen(usersTotal, grandUsers)}
      </td>
    </tr>,
    <tr key="uv">
      <td className={cell}>Val</td>
      <td className={cell}>{formatCount(row.newCount)}</td>
      <td className={cell}>{formatCount(row.renewCount)}</td>
      <td className={`${cell} font-bold`}>{formatCount(usersTotal)}</td>
      <td className={`${cell} ${grey}`} />
    </tr>,
    <tr key="i%">
      <td className={cell}>%</td>
      <td className={`${cell} ${shaded}`}>{share(row.newIncome, incomeTotal)}</td>
      <td className={`${cell} ${shaded}`}>{share(row.renewIncome, incomeTotal)}</td>
      <td className={`${cell} ${grey}`} />
      <td className={`${cell} font-bold text-[#e01b00]`} title={excluded ? 'Excluded' : undefined}>
        {gen(incomeTotal, grandIncome)}
      </td>
    </tr>,
    <tr key="iv">
      <td className={cell}>Val</td>
      <td className={cell}>{formatEuro(row.newIncome)}</td>
      <td className={cell}>{formatEuro(row.renewIncome)}</td>
      <td className={`${cell} font-bold`}>{formatEuro(incomeTotal)}</td>
      <td className={`${cell} ${grey}`} />
    </tr>,
  ];

  return (
    <table
      className={`w-full table-fixed border-collapse bg-white text-sm text-gray-900 ${excluded ? 'opacity-60' : ''}`}
    >
      <thead>
        <tr>
          <th
            colSpan={5}
            className={`${HEAD_H} border border-gray-300 px-1 text-center text-sm font-bold`}
            style={{ background: color, color: text }}
          >
            {title}
          </th>
        </tr>
        <tr className="text-xs font-semibold">
          <th className={`${HEAD_H} w-[16%] border border-gray-300`}>Gen</th>
          <th className="border border-gray-300">New</th>
          <th className="border border-gray-300">Renew</th>
          <th className="border border-gray-300">Total</th>
          <th className="border border-gray-300">% Gen</th>
        </tr>
      </thead>
      <tbody>{bodyRows}</tbody>
    </table>
  );
}

function DetailsTable({ details, excluded }: { details: Details; excluded: StatsDetailKind[] }) {
  const included = STATS_DETAIL_KINDS.filter((k) => !excluded.includes(k));
  const grandUsers = included.reduce((s, k) => s + details[k].newCount + details[k].renewCount, 0);
  const grandIncome = included.reduce(
    (s, k) => s + details[k].newIncome + details[k].renewIncome,
    0,
  );

  return (
    <div className="overflow-x-auto border-2 border-gray-900 bg-white p-3">
      <div className="min-w-[860px] space-y-2">
        {TABLE_BLOCKS.map((blocks, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex w-28 shrink-0 flex-col">
              <div className={HEAD_H} />
              <div className={HEAD_H} />
              <MetricBox metric="users" className="h-20" />
              <MetricBox metric="income" className="h-20" />
            </div>
            {blocks.map((b) => (
              <div key={b.kind} className="min-w-0 flex-1">
                <KindTable
                  kind={b.kind}
                  title={b.title}
                  text={b.text}
                  row={details[b.kind]}
                  grandUsers={grandUsers}
                  grandIncome={grandIncome}
                  excluded={excluded.includes(b.kind)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailPie({
  details,
  excluded,
  phase,
  metric,
}: {
  details: Details;
  excluded: StatsDetailKind[];
  phase: Phase;
  metric: StatsChartMetric;
}) {
  const kindColor = useKindColor();
  const data = STATS_DETAIL_KINDS.filter((k) => !excluded.includes(k))
    .map((k) => ({ key: k, label: STATS_DETAIL_KIND_LABELS[k], value: phaseValue(details[k], phase, metric) }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = metric === 'income' ? formatEuro : formatCount;

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-gray-500">No data</div>
    );
  }
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius="92%"
            innerRadius="50%"
            paddingAngle={1}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={kindColor(d.key)} stroke="#fff" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${fmt(Number(value))} (${percent(Number(value), total)}%)`,
              String(name),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetailLegend({
  details,
  excluded,
  phase,
  metric,
  onToggleExclude,
}: {
  details: Details;
  excluded: StatsDetailKind[];
  phase: Phase;
  metric: StatsChartMetric;
  onToggleExclude: (kind: StatsDetailKind) => void;
}) {
  const kindColor = useKindColor();
  const fmt = metric === 'income' ? formatEuro : formatCount;
  const total = STATS_DETAIL_KINDS.filter((k) => !excluded.includes(k)).reduce(
    (s, k) => s + phaseValue(details[k], phase, metric),
    0,
  );
  return (
    <ul className="space-y-1 bg-[#f4f4f4] p-2 text-sm text-gray-900">
      {STATS_DETAIL_KINDS.map((k) => {
        const value = phaseValue(details[k], phase, metric);
        const isExcluded = excluded.includes(k);
        return (
          <li key={k} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: kindColor(k), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }}
              aria-hidden
            />
            <span className={`min-w-0 truncate ${isExcluded ? 'opacity-50' : ''}`}>
              {isExcluded
                ? STATS_DETAIL_KIND_LABELS[k]
                : `${STATS_DETAIL_KIND_LABELS[k]} (${percent(value, total)}%)`}{' '}
              <b>{fmt(value)}</b>
            </span>
            {STATS_EXCLUDABLE_KINDS.includes(k) ? (
              <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 text-xs">
                <input type="checkbox" checked={isExcluded} onChange={() => onToggleExclude(k)} />
                exclude
              </label>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DetailsPies({ details, excluded, onToggleExclude }: Props) {
  const { metric } = useStatisticsMetric();
  return (
    <div className="overflow-x-auto border border-gray-400 bg-[#eceeee] p-3">
      <div className="grid min-w-[860px] grid-cols-[7rem_repeat(3,minmax(0,1fr))] items-center gap-x-4 gap-y-3">
        <div />
        {PHASES.map((p) => (
          <div
            key={p.id}
            className="border border-gray-700 py-1.5 text-center text-base text-gray-900"
            style={{ background: p.background }}
          >
            {p.title}
          </div>
        ))}

        <MetricBox metric="users" className="h-12" highlighted={metric === 'users'} />
        {PHASES.map((p) => (
          <DetailPie key={p.id} details={details} excluded={excluded} phase={p.id} metric="users" />
        ))}

        <MetricBox metric="income" className="h-12" highlighted={metric === 'income'} />
        {PHASES.map((p) => (
          <DetailPie key={p.id} details={details} excluded={excluded} phase={p.id} metric="income" />
        ))}

        <MetricBox metric={metric} className="h-12 self-start" highlighted />
        {PHASES.map((p) => (
          <DetailLegend
            key={p.id}
            details={details}
            excluded={excluded}
            phase={p.id}
            metric={metric}
            onToggleExclude={onToggleExclude}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * “Display details” of the distribution pie: for each type of user, new subscriptions
 * (first subscription) and renewals (previous subscriptions), in % and value, for Users and Income.
 */
export default function SubscriptionDetailsPanel({
  details,
  excluded,
  onToggleExclude,
  view = 'all',
}: Props & { view?: 'all' | 'table' | 'pies' }) {
  return (
    <div className="mb-4 space-y-4">
      {view !== 'pies' ? <DetailsTable details={details} excluded={excluded} /> : null}
      {view !== 'table' ? (
        <DetailsPies details={details} excluded={excluded} onToggleExclude={onToggleExclude} />
      ) : null}
    </div>
  );
}
