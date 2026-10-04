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
import SubscriptionDetailsPanel from '@/components/admin/statistics/SubscriptionDetailsPanel';
import VersionDistributionDrilldown from '@/components/admin/statistics/VersionDistributionDrilldown';
import { formatEuro, useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import { aggregateVersionsForScope } from '@/lib/admin/statisticsDrilldown';
import {
  STATS_DETAIL_KIND_LABELS,
  STATS_DETAIL_KINDS,
  STATS_EXCLUDABLE_KINDS,
  STATS_KIND_LABELS,
  type StatsDetailKind,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';
import type { StatsSlice } from '@/lib/admin/buildStatistics';

const SHOW_DETAILS_KEY = 'adminStats.usersDistribution.showDetails';

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
  const [showDetails, setShowDetails] = useState(false);
  const [excluded, setExcluded] = useState<StatsDetailKind[]>([]);

  useEffect(() => {
    setShowDetails(localStorage.getItem(SHOW_DETAILS_KEY) === '1');
  }, []);

  useEffect(() => {
    setSelectedKind(null);
  }, [filters.country]);

  const drilldown = useMemo(() => {
    if (!data?.usersLite || !selectedKind) return null;
    // Club accounts have their own slice on this page, so they are not part of the member's type.
    return aggregateVersionsForScope(data.usersLite.filter((u) => !u.clubAccount), {
      kind: selectedKind,
      country: filters.country || null,
    });
  }, [data?.usersLite, selectedKind, filters.country]);

  /** Distribution by type of user, Club accounts included (same figures as the details). */
  const slices = useMemo<StatsSlice[]>(() => {
    const details = data?.subscriptionDetails;
    if (!details) return data?.worldDistribution.slices ?? [];
    return STATS_DETAIL_KINDS.map((k) => ({
      key: k,
      label: STATS_DETAIL_KIND_LABELS[k],
      count: details[k].newCount + details[k].renewCount,
      income: Math.round((details[k].newIncome + details[k].renewIncome) * 100) / 100,
      percent: 0,
    })).filter((s) => s.count > 0 || s.income > 0 || STATS_EXCLUDABLE_KINDS.includes(s.key as StatsDetailKind));
  }, [data?.subscriptionDetails, data?.worldDistribution.slices]);

  const includedSlices = slices.filter((s) => !excluded.includes(s.key as StatsDetailKind));
  const includedTotal = includedSlices.reduce((s, x) => s + x.count, 0);
  const includedIncome = Math.round(includedSlices.reduce((s, x) => s + x.income, 0) * 100) / 100;

  if (!authChecked) return null;

  const handleSelect = (slice: StatsSlice | null) => {
    const key = slice?.key;
    if (key && (['single', 'coaches', 'teams', 'clubs', 'groups'] as string[]).includes(key)) {
      setSelectedKind(key as StatsUserKind);
    } else {
      setSelectedKind(null);
    }
  };

  const toggleExclude = (key: string) => {
    setExcluded((prev) =>
      prev.includes(key as StatsDetailKind)
        ? prev.filter((k) => k !== key)
        : [...prev, key as StatsDetailKind],
    );
  };

  const toggleDetails = () => {
    setShowDetails((prev) => {
      localStorage.setItem(SHOW_DETAILS_KEY, prev ? '0' : '1');
      return !prev;
    });
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
        <>
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
          <button
            type="button"
            onClick={toggleDetails}
            aria-expanded={showDetails}
            className="mb-1.5 text-base font-medium underline underline-offset-2"
          >
            {showDetails ? 'Hide details' : 'Display details'}{' '}
            <span className="text-xs font-normal no-underline">(hide-show)</span>
          </button>
        </>
      }
    >
      {showDetails && data?.subscriptionDetails ? (
        <SubscriptionDetailsPanel
          details={data.subscriptionDetails}
          excluded={excluded}
          onToggleExclude={toggleExclude}
        />
      ) : null}
      <div className="max-w-2xl mx-auto">
        <StatisticsPieBlock
          key={filters.country || '__world__'}
          title={filters.country ? `Distribution — ${filters.country}` : 'Distribution — World'}
          subtitle={
            data ? `Total ${includedTotal} users · ${formatEuro(includedIncome)}` : undefined
          }
          slices={slices}
          kindColors
          height={340}
          onSelect={handleSelect}
          excludableKeys={STATS_EXCLUDABLE_KINDS}
          excludedKeys={excluded}
          onToggleExclude={toggleExclude}
        />
      </div>
      {data && includedTotal > 0 ? (
        <WorldDistributionSummary
          total={includedTotal}
          totalIncome={includedIncome}
          slices={includedSlices}
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
