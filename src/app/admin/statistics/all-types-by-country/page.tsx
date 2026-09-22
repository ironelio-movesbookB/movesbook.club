'use client';

import { useMemo, useState } from 'react';
import StatisticsPageShell from '@/components/admin/statistics/StatisticsPageShell';
import { StatisticsPieBlock } from '@/components/admin/statistics/StatisticsCharts';
import VersionDistributionDrilldown from '@/components/admin/statistics/VersionDistributionDrilldown';
import { useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import { aggregateVersionsForScope } from '@/lib/admin/statisticsDrilldown';
import type { StatsUserKind } from '@/lib/admin/statisticsKinds';

import type { StatsSlice } from '@/lib/admin/buildStatistics';

type Selection = {
  kind: StatsUserKind;
  kindLabel: string;
  countryKey: string;
  countryLabel: string;
  countriesOut?: string[];
};

export default function AllTypesByCountryPage() {
  const { authChecked, loading, error, data } = useAdminStatistics({
    typeCountriesN: 15,
    enableCountry: false,
  });
  const [selection, setSelection] = useState<Selection | null>(null);

  const blocks = useMemo(
    () => data?.allTypesByCountry ?? [],
    [data?.allTypesByCountry],
  );

  const namedByKind = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const block of blocks) {
      map[block.kind] = block.countries
        .filter((c) => c.key !== '__rest_of_world__' && c.key !== '__others__')
        .map((c) => c.key);
    }
    return map;
  }, [blocks]);

  const drilldown = useMemo(() => {
    if (!data?.usersLite || !selection) return null;
    const isRest =
      selection.countryKey === '__rest_of_world__' ||
      selection.countryKey === '__others__';
    return aggregateVersionsForScope(data.usersLite, {
      kind: selection.kind,
      country: isRest ? null : selection.countryKey,
      countriesOut: isRest ? selection.countriesOut ?? null : null,
    });
  }, [data?.usersLite, selection]);

  if (!authChecked) return null;

  const makeHandler =
    (kind: StatsUserKind, kindLabel: string) => (slice: StatsSlice | null) => {
      if (!slice) {
        setSelection(null);
        return;
      }
      const isRest =
        slice.key === '__rest_of_world__' || slice.key === '__others__';
      setSelection({
        kind,
        kindLabel,
        countryKey: slice.key,
        countryLabel: slice.label,
        countriesOut: isRest ? namedByKind[kind] : undefined,
      });
    };

  return (
    <StatisticsPageShell
      title="Pie of distribution of all the types of users"
      description="Each pie shows that user type across the top 15 countries, plus Rest of the world. Click a country to see version distribution."
      totalUsers={data?.totalUsers ?? 0}
      incomeEuro={data?.incomeEuro ?? 0}
      loading={loading}
      error={error}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {blocks.map((block) => {
            const hasRest = block.countries.some(
              (c) => c.key === '__rest_of_world__' || c.key === '__others__',
            );
            return (
              <StatisticsPieBlock
                key={block.kind}
                title={block.label}
                subtitle={`${block.total} users — top 15 countries${
                  hasRest ? ' + Rest of the world' : ''
                }`}
                slices={block.countries}
                height={240}
                uniformKind={block.kind}
                onSelect={makeHandler(block.kind, block.label)}
              />
            );
          })}
        </div>

        {selection && drilldown ? (
          <VersionDistributionDrilldown
            title={`${selection.kindLabel} — ${selection.countryLabel}`}
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
