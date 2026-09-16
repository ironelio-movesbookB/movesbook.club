'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PromocodesTabs from '@/components/promocodes/PromocodesTabs';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import type { PromocodeStatisticsResult } from '@/lib/promocodes/promocodeMonthlyStatsService';
import '@/components/promocodes/promocodes.css';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export default function PromocodeStatisticsPage() {
  const ready = usePromocodesAdminAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<PromocodeStatisticsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= currentYear - 8; y--) list.push(y);
    return list;
  }, [currentYear]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await promocodesFetch(`/api/admin/promocodes/statistics?year=${year}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  const maxBar = Math.max(
    1,
    ...(data?.months.map((m) => Math.max(m.invitesSent, m.registrations)) ?? [1])
  );

  return (
    <div className="promocodes-page max-w-[1400px] mx-auto">
      <div className="reddish_row1 mtop10">Promocode Statistics</div>
      <PromocodesTabs active="statistics" />

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
          <div className="mt-6 overflow-x-auto border border-gray-300 bg-white p-4">
            <div className="font-semibold mb-3">Monthly invites / registrations</div>
            <div className="flex items-end gap-3 min-h-[180px]">
              {(data?.months ?? []).map((m) => (
                <div key={m.month} className="flex flex-col items-center gap-1 w-14">
                  <div className="flex items-end gap-1 h-36">
                    <div
                      title={`Invites ${m.invitesSent}`}
                      className="w-4 bg-[#7b0a26]"
                      style={{ height: `${(m.invitesSent / maxBar) * 100}%`, minHeight: m.invitesSent ? 4 : 0 }}
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
                  <div className="text-xs">{MONTH_LABELS[m.month - 1]}</div>
                  <div className="text-[10px] text-gray-600">{m.successRate.toFixed(0)}%</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-600 flex gap-4">
              <span>
                <span className="inline-block w-3 h-3 bg-[#7b0a26] mr-1 align-middle" /> Invites
              </span>
              <span>
                <span className="inline-block w-3 h-3 bg-[#3d7a3d] mr-1 align-middle" /> Registrations
              </span>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto border border-gray-300 bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#3d3d3d] text-white text-left">
                  <th className="p-2">Month</th>
                  <th className="p-2">Invites</th>
                  <th className="p-2">Registrations</th>
                  <th className="p-2">Success %</th>
                </tr>
              </thead>
              <tbody>
                {(data?.months ?? []).map((m) => (
                  <tr key={m.month} className="border-t">
                    <td className="p-2">{MONTH_LABELS[m.month - 1]}</td>
                    <td className="p-2">{m.invitesSent}</td>
                    <td className="p-2">{m.registrations}</td>
                    <td className="p-2">{m.successRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 overflow-x-auto border border-gray-300 bg-white">
            <div className="p-3 font-semibold border-b">Country × month matrix</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">Country</th>
                  {MONTH_LABELS.map((label) => (
                    <th key={label} className="p-2 text-center">
                      {label}
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
                  (data?.countryMatrix ?? []).map((row) => (
                    <tr key={`${row.countryId}-${row.countryCode}`} className="border-t">
                      <td className="p-2">
                        {row.countryName || row.countryCode || `ID ${row.countryId}`}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const cell = row.months[i + 1];
                        return (
                          <td key={i} className="p-2 text-center text-xs" title="invites / registrations">
                            {cell
                              ? `${cell.invitesSent}/${cell.registrations}`
                              : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-600">
              Each cell is <strong>invites sent / registrations</strong> for that country and month.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
