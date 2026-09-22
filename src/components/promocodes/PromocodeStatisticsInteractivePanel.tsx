'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PromocodeStatsChartPanel from '@/components/promocodes/PromocodeStatsChartPanel';
import { promocodesFetch } from '@/components/promocodes/usePromocodesAdminAuth';
import type { PromocodeStatisticsResult } from '@/lib/promocodes/promocodeMonthlyStatsService';
import {
  countryDisplayName,
  countryMonthlySlices,
  monthMetricSlices,
  PROMOCODE_MONTH_LABELS,
  topCountriesForMonth,
  type MonthMetricKey,
} from '@/lib/promocodes/promocodeStatsCharts';

type ChartView =
  | { kind: 'month-metric'; metric: MonthMetricKey }
  | { kind: 'country'; countryKey: string }
  | { kind: 'month-countries'; month: number };

const METRIC_LABELS: Record<MonthMetricKey, string> = {
  invitesSent: 'Invites',
  registrations: 'Registrations',
  successRate: 'Success %',
};

const HEADER_DOT: Record<MonthMetricKey, string> = {
  invitesSent: 'border-blue-500 hover:bg-blue-50',
  registrations: 'border-amber-400 hover:bg-amber-50',
  successRate: 'border-green-800 hover:bg-green-50',
};

type Props = {
  /** Optional heading above the year selector. */
  title?: string;
  /** When false, hide the monthly bar overview (tables + pie/bar only). */
  showMonthlyBars?: boolean;
  className?: string;
};

/**
 * Monthly + country matrix with pie/bar drill-downs (column circles, country name, month header).
 * Wired on /promocodes/statistics for Super Admin.
 */
export default function PromocodeStatisticsInteractivePanel({
  title = 'Promocode invite statistics',
  showMonthlyBars = true,
  className = '',
}: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<PromocodeStatisticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<ChartView | null>(null);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= currentYear - 8; y--) list.push(y);
    return list;
  }, [currentYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await promocodesFetch(`/api/admin/promocodes/statistics?year=${year}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      setData(await res.json());
      setChartView(null);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartPayload = useMemo(() => {
    if (!data || !chartView) return null;

    if (chartView.kind === 'month-metric') {
      const slices = monthMetricSlices(data.months, chartView.metric);
      return {
        title: `${METRIC_LABELS[chartView.metric]} by month — ${year}`,
        subtitle: 'Pie slices use the specified month colors (Jan–Dec).',
        slices,
        showBar: false,
        valueSuffix: chartView.metric === 'successRate' ? '%' : undefined,
      };
    }

    if (chartView.kind === 'country') {
      const row = data.countryMatrix.find(
        (r) => `${r.countryId}:${r.countryCode}` === chartView.countryKey,
      );
      if (!row) return null;
      const name = countryDisplayName(row.countryCode, row.countryId);
      const slices = countryMonthlySlices(row, 'registrations');
      const regTotal = slices.reduce((s, x) => s + x.value, 0);
      const useInvites = regTotal === 0;
      const finalSlices = useInvites
        ? countryMonthlySlices(row, 'invitesSent')
        : slices;
      return {
        title: `${name} — monthly ${useInvites ? 'invites' : 'registrations'}`,
        subtitle: `${year} · pie + bar (month colors)`,
        slices: finalSlices,
        showBar: true,
        valueSuffix: undefined as string | undefined,
      };
    }

    const month = chartView.month;
    const slices = topCountriesForMonth(data.countryMatrix, month, 'registrations', 15);
    return {
      title: `Registrations by country — ${PROMOCODE_MONTH_LABELS[month - 1]} ${year}`,
      subtitle: 'Top 15 countries + Rest of the world (ID 0 excluded).',
      slices,
      showBar: true,
      valueSuffix: undefined as string | undefined,
    };
  }, [chartView, data, year]);

  const maxBar = Math.max(
    1,
    ...(data?.months.map((m) => Math.max(m.invitesSent, m.registrations)) ?? [1]),
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        {title ? <h3 className="text-lg font-semibold text-gray-900">{title}</h3> : null}
        <label className="text-sm font-semibold">
          Year{' '}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="ml-2 px-3 py-2 border text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {data && (
          <div className="text-sm ml-auto flex flex-wrap gap-4">
            <span>
              Invites: <strong>{data.totals.invitesSent}</strong>
            </span>
            <span>
              Registrations: <strong>{data.totals.registrations}</strong>
            </span>
            <span>
              Success: <strong>{data.totals.successRate.toFixed(1)}%</strong>
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <>
          {showMonthlyBars ? (
            <div className="mt-6 overflow-x-auto border border-gray-300 bg-white p-4">
              <div className="mb-3 font-semibold">Monthly invites / registrations</div>
              <div className="flex min-h-[180px] items-end gap-3">
                {(data?.months ?? []).map((m) => (
                  <div key={m.month} className="flex w-14 flex-col items-center gap-1">
                    <div className="flex h-36 items-end gap-1">
                      <div
                        title={`Invites ${m.invitesSent}`}
                        className="w-4 bg-[#7b0a26]"
                        style={{
                          height: `${(m.invitesSent / maxBar) * 100}%`,
                          minHeight: m.invitesSent ? 4 : 0,
                        }}
                      />
                      <div
                        title={`Registrations ${m.registrations}`}
                        className="w-4 bg-[#3d7a3d]"
                        style={{
                          height: `${(m.registrations / maxBar) * 100}%`,
                          minHeight: m.registrations ? 4 : 0,
                        }}
                      />
                    </div>
                    <div className="text-xs">{PROMOCODE_MONTH_LABELS[m.month - 1]}</div>
                    <div className="text-[10px] text-gray-600">{m.successRate.toFixed(0)}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-600">
                <span>
                  <span className="mr-1 inline-block h-3 w-3 align-middle bg-[#7b0a26]" /> Invites
                </span>
                <span>
                  <span className="mr-1 inline-block h-3 w-3 align-middle bg-[#3d7a3d]" />{' '}
                  Registrations
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto border border-gray-300 bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#3d3d3d] text-left text-white">
                  <th className="p-2">Month</th>
                  {(
                    [
                      ['invitesSent', 'Invites'],
                      ['registrations', 'Registrations'],
                      ['successRate', 'Success %'],
                    ] as const
                  ).map(([metric, label]) => (
                    <th key={metric} className="p-2">
                      <span className="inline-flex items-center gap-2">
                        {label}
                        <button
                          type="button"
                          title={`Show pie chart for ${label}`}
                          aria-label={`Pie chart — ${label}`}
                          onClick={() => setChartView({ kind: 'month-metric', metric })}
                          className={`inline-block h-4 w-4 shrink-0 rounded-full border-2 bg-white ${HEADER_DOT[metric]}`}
                        />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.months ?? []).map((m) => (
                  <tr key={m.month} className="border-t">
                    <td className="p-2">{PROMOCODE_MONTH_LABELS[m.month - 1]}</td>
                    <td className="p-2">{m.invitesSent}</td>
                    <td className="p-2">{m.registrations}</td>
                    <td className="p-2">{m.successRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 overflow-x-auto border border-gray-300 bg-white">
            <div className="border-b p-3 font-semibold">Country × month matrix</div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">Country</th>
                  {PROMOCODE_MONTH_LABELS.map((label, i) => (
                    <th key={label} className="p-2 text-center">
                      <button
                        type="button"
                        title={`Registrations by country — ${label}`}
                        onClick={() =>
                          setChartView({ kind: 'month-countries', month: i + 1 })
                        }
                        className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                      >
                        {label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.countryMatrix ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-gray-500">
                      No country stats yet.
                    </td>
                  </tr>
                ) : (
                  (data?.countryMatrix ?? []).map((row) => {
                    const key = `${row.countryId}:${row.countryCode}`;
                    const isIdZero = Number(row.countryId) === 0;
                    const label = isIdZero
                      ? 'ID 0'
                      : countryDisplayName(row.countryCode, row.countryId);
                    return (
                      <tr key={key} className="border-t">
                        <td className="p-2">
                          {isIdZero ? (
                            <span className="text-gray-500">{label}</span>
                          ) : (
                            <button
                              type="button"
                              title={`Charts for ${label}`}
                              onClick={() =>
                                setChartView({ kind: 'country', countryKey: key })
                              }
                              className="text-left font-medium text-teal-800 underline-offset-2 hover:underline"
                            >
                              {label}
                            </button>
                          )}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const cell = row.months[i + 1];
                          return (
                            <td key={i} className="p-2 text-center text-xs">
                              {cell
                                ? `${cell.invitesSent}/${cell.registrations}`
                                : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {chartPayload ? (
            <PromocodeStatsChartPanel
              title={chartPayload.title}
              subtitle={chartPayload.subtitle}
              slices={chartPayload.slices}
              showBar={chartPayload.showBar}
              valueSuffix={chartPayload.valueSuffix}
              onClose={() => setChartView(null)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
