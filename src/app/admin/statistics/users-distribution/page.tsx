'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatisticsPageShell, {
  StatisticsSelect,
  countryFilterOptions,
} from '@/components/admin/statistics/StatisticsPageShell';
import { StatisticsPieBlock } from '@/components/admin/statistics/StatisticsCharts';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import { useStatisticsMetric } from '@/components/admin/statistics/StatisticsMetricToggle';
import VersionDistributionDrilldown from '@/components/admin/statistics/VersionDistributionDrilldown';
import { useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import { aggregateVersionsForScope } from '@/lib/admin/statisticsDrilldown';
import {
  STATS_KIND_LABELS,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';
import type { StatsSlice } from '@/lib/admin/buildStatistics';

function WorldDistributionSummary({
  total,
  totalIncome,
  slices,
}: {
  total: number;
  totalIncome: number;
  slices: StatsSlice[];
}) {
  const theme = useStatisticsGraphTheme();
  const { isIncome, formatMetricValue, metricLabel, sliceValue } = useStatisticsMetric();
  const metricTotal = isIncome ? totalIncome : total;
  const incomeShareTotal = slices.reduce((s, x) => s + sliceValue(x), 0);
  return (
    <div className="mt-4 border p-4 text-base" style={theme.panelStyle}>
      <p className="mb-2 text-base font-semibold" style={{ color: theme.background.text }}>
        Current {metricLabel.toLowerCase()} = {formatMetricValue(metricTotal)}
      </p>
      <ul className="space-y-1.5 text-lg" style={{ color: theme.background.text }}>
        {slices.map((s) => {
          const value = sliceValue(s);
          const percent =
            incomeShareTotal > 0
              ? Math.round((value / incomeShareTotal) * 1000) / 10
              : 0;
          return (
            <li key={s.key}>
              {s.label} {formatMetricValue(value)} ({percent}%)
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function UsersDistributionPage() {
  const router = useRouter();
  const { authChecked, loading, error, data, filters, setFilters } = useAdminStatistics({
    enableCountry: true,
  });
  const [selectedKind, setSelectedKind] = useState<StatsUserKind | null>(null);

  useEffect(() => {
    setSelectedKind(null);
  }, [filters.country]);

  const drilldown = useMemo(() => {
    if (!data?.usersLite || !selectedKind) return null;
    return aggregateVersionsForScope(data.usersLite, {
      kind: selectedKind,
      country: filters.country || null,
    });
  }, [data?.usersLite, selectedKind, filters.country]);

  if (!authChecked) return null;

  const handleSelect = (slice: StatsSlice | null) => {
    const key = slice?.key;
    if (key && (['single', 'coaches', 'teams', 'clubs', 'groups'] as string[]).includes(key)) {
      setSelectedKind(key as StatsUserKind);
    } else {
      setSelectedKind(null);
    }
  };

  return (
    <StatisticsPageShell
      title="Pie of distribution users"
      description="Distribution of users among Athletes (Single users), Coaches, Teams, Clubs and Groups. Filter by country. Click a user type to see version distribution."
      totalUsers={data?.totalUsers ?? 0}
      incomeEuro={data?.incomeEuro ?? 0}
      loading={loading}
      error={error}
      filters={
        <StatisticsSelect
          id="country"
          label="Country"
          value={filters.country}
          onChange={(country) => {
            setSelectedKind(null);
            setFilters((f) => ({ ...f, country }));
            router.replace(
              country
                ? `/admin/statistics/users-distribution?country=${encodeURIComponent(country)}`
                : '/admin/statistics/users-distribution',
            );
          }}
          options={countryFilterOptions(data?.countries ?? [])}
        />
      }
    >
      <div className="max-w-2xl mx-auto">
        <StatisticsPieBlock
          key={filters.country || '__world__'}
          title={filters.country ? `Distribution — ${filters.country}` : 'Distribution — World'}
          subtitle={
            data
              ? `Total ${data.worldDistribution.total} users · ${data.worldDistribution.totalIncome} €`
              : undefined
          }
          slices={data?.worldDistribution.slices ?? []}
          kindColors
          height={340}
          onSelect={handleSelect}
        />
      </div>
      {data && data.worldDistribution.total > 0 ? (
        <WorldDistributionSummary
          total={data.worldDistribution.total}
          totalIncome={data.worldDistribution.totalIncome}
          slices={data.worldDistribution.slices}
        />
      ) : null}
      {selectedKind && drilldown ? (
        <VersionDistributionDrilldown
          key={`${filters.country}-${selectedKind}`}
          title={`${STATS_KIND_LABELS[selectedKind]} — versions`}
          subtitle={filters.country ? filters.country : 'World'}
          total={drilldown.total}
          totalIncome={drilldown.totalIncome}
          bars={drilldown.bars}
          slices={drilldown.slices}
          userKind={selectedKind}
          onClear={() => setSelectedKind(null)}
        />
      ) : null}
    </StatisticsPageShell>
  );
}
