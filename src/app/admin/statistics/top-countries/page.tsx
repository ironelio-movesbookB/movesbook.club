'use client';

import { useMemo, useState } from 'react';
import StatisticsPageShell from '@/components/admin/statistics/StatisticsPageShell';
import { StatisticsPieBlock } from '@/components/admin/statistics/StatisticsCharts';
import { useStatisticsGraphTheme } from '@/components/admin/statistics/StatisticsGraphTheme';
import VersionDistributionDrilldown from '@/components/admin/statistics/VersionDistributionDrilldown';
import { useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import { aggregateVersionsForScope } from '@/lib/admin/statisticsDrilldown';
import {
  STATS_KIND_LABELS,
  type StatsUserKind,
} from '@/lib/admin/statisticsKinds';
import type { StatsSlice } from '@/lib/admin/buildStatistics';

function EmptyCountriesNotice() {
  const theme = useStatisticsGraphTheme();
  return (
    <div
      className="border p-8 text-center"
      style={{ ...theme.panelStyle, color: theme.background.muted }}
    >
      No country registrations yet.
    </div>
  );
}

type Selection = {
  country: string;
  countryLabel: string;
  kind: StatsUserKind;
  countriesOut?: string[];
};

export default function TopCountriesDistributionPage() {
  const { authChecked, loading, error, data } = useAdminStatistics({
    topCountriesN: 8,
    enableCountry: false,
  });
  const [selection, setSelection] = useState<Selection | null>(null);

  const topCountryNames = useMemo(
    () => (data?.topCountries ?? []).map((r) => r.country),
    [data?.topCountries],
  );

  const drilldown = useMemo(() => {
    if (!data?.usersLite || !selection) return null;
    return aggregateVersionsForScope(data.usersLite, {
      kind: selection.kind,
      country:
        selection.country === '__rest_of_world__' ? null : selection.country,
      countriesOut: selection.countriesOut ?? null,
    });
  }, [data?.usersLite, selection]);

  if (!authChecked) return null;

  const rest = data?.restOfWorld ?? null;

  const makeKindHandler =
    (country: string, countryLabel: string, countriesOut?: string[]) =>
    (slice: StatsSlice | null) => {
      const key = slice?.key;
      if (key && (['single', 'coaches', 'teams', 'clubs', 'groups'] as string[]).includes(key)) {
        setSelection({
          country,
          countryLabel,
          kind: key as StatsUserKind,
          countriesOut,
        });
      } else {
        setSelection(null);
      }
    };

  return (
    <StatisticsPageShell
      title="Pie of distribution in the 8 Countries with higher registrations"
      description="Two pies per row for the top 8 countries. Below, Rest of the world. Click a user type to see version distribution for that country and type."
      totalUsers={data?.totalUsers ?? 0}
      incomeEuro={data?.incomeEuro ?? 0}
      loading={loading}
      error={error}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(data?.topCountries ?? []).map((row) => (
            <StatisticsPieBlock
              key={row.country}
              title={row.country}
              subtitle={`${row.total} registrations`}
              slices={row.distribution.slices}
              kindColors
              height={240}
              onSelect={makeKindHandler(row.country, row.country)}
            />
          ))}
        </div>

        {!loading && (data?.topCountries?.length ?? 0) === 0 ? (
          <EmptyCountriesNotice />
        ) : null}

        {rest ? (
          <div className="pt-1">
            <StatisticsPieBlock
              title="Rest of the world"
              subtitle={`${rest.total} registrations across ${rest.countryCount} other countr${
                rest.countryCount === 1 ? 'y' : 'ies'
              }`}
              slices={rest.distribution.slices}
              kindColors
              height={260}
              onSelect={makeKindHandler(
                '__rest_of_world__',
                'Rest of the world',
                topCountryNames,
              )}
            />
          </div>
        ) : null}

        {selection && drilldown ? (
          <VersionDistributionDrilldown
            title={`${STATS_KIND_LABELS[selection.kind]} — ${selection.countryLabel}`}
            subtitle="Distribution of the versions"
            total={drilldown.total}
            totalIncome={drilldown.totalIncome}
            bars={drilldown.bars}
            slices={drilldown.slices}
            userKind={selection.kind}
            onClear={() => setSelection(null)}
          />
        ) : null}
      </div>
    </StatisticsPageShell>
  );
}
