'use client';

import { useMemo, useState } from 'react';
import StatisticsPageShell, {
  StatisticsSelect,
  typeKindFilterOptions,
} from '@/components/admin/statistics/StatisticsPageShell';
import { StatisticsPieBlock } from '@/components/admin/statistics/StatisticsCharts';
import VersionDistributionDrilldown from '@/components/admin/statistics/VersionDistributionDrilldown';
import { useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import { aggregateVersionsForScope } from '@/lib/admin/statisticsDrilldown';
import type {
  StatsTypeKindFilter,
  StatsUserKind,
} from '@/lib/admin/statisticsKinds';
import { STATS_USER_KINDS } from '@/lib/admin/statisticsKinds';
import type { StatsSlice } from '@/lib/admin/buildStatistics';

export default function TypeByCountryPage() {
  const { authChecked, loading, error, data, filters, setFilters } = useAdminStatistics({
    enableTypeKind: true,
    typeCountriesN: 15,
    enableCountry: false,
  });
  const [selectedCountry, setSelectedCountry] = useState<{
    key: string;
    label: string;
  } | null>(null);

  const block = data?.typeByCountry;
  const namedCountries = useMemo(
    () =>
      (block?.countries ?? [])
        .filter((c) => c.key !== '__others__' && c.key !== '__rest_of_world__')
        .map((c) => c.key),
    [block?.countries],
  );

  const singleKind: StatsUserKind | null =
    filters.typeKind && STATS_USER_KINDS.includes(filters.typeKind as StatsUserKind)
      ? (filters.typeKind as StatsUserKind)
      : null;

  const drilldown = useMemo(() => {
    if (!data?.usersLite || !selectedCountry || !filters.typeKind) return null;
    const isOthers =
      selectedCountry.key === '__others__' ||
      selectedCountry.key === '__rest_of_world__';
    return aggregateVersionsForScope(data.usersLite, {
      kind: filters.typeKind,
      country: isOthers ? null : selectedCountry.key,
      countriesOut: isOthers ? namedCountries : null,
    });
  }, [data?.usersLite, selectedCountry, filters.typeKind, namedCountries]);

  if (!authChecked) return null;

  const sliceCount = block?.countries.length ?? 0;
  const hasOthers = Boolean(
    block?.countries.some((c) => c.key === '__others__' || c.key === '__rest_of_world__'),
  );

  const handleSelect = (slice: StatsSlice | null) => {
    if (slice) setSelectedCountry({ key: slice.key, label: slice.label });
    else setSelectedCountry(null);
  };

  return (
    <StatisticsPageShell
      title="Pie of distribution of a type of user"
      description="Select a user type and see its distribution across the top 15 countries (+ Others). Click a country to see version distribution."
      totalUsers={block?.total ?? data?.totalUsers ?? 0}
      incomeEuro={block?.totalIncome ?? data?.incomeEuro ?? 0}
      loading={loading}
      error={error}
      filters={
        <StatisticsSelect
          id="typeKind"
          label="Type of user"
          value={filters.typeKind}
          onChange={(typeKind) => {
            setSelectedCountry(null);
            setFilters((f) => ({ ...f, typeKind: typeKind as StatsTypeKindFilter }));
          }}
          options={typeKindFilterOptions()}
        />
      }
    >
      <div className="max-w-2xl mx-auto">
        <StatisticsPieBlock
          title={`${block?.label ?? 'Type'} — top 15 countries${hasOthers ? ' + Others' : ''}`}
          subtitle={
            block
              ? `${block.total} users · ${sliceCount} slice${sliceCount === 1 ? '' : 's'}`
              : undefined
          }
          slices={block?.countries ?? []}
          height={360}
          titleSwatchKind={singleKind ?? undefined}
          onSelect={handleSelect}
        />
      </div>
      {selectedCountry && drilldown ? (
        <VersionDistributionDrilldown
          title={`${block?.label ?? 'Type'} — ${selectedCountry.label}`}
          subtitle="Distribution of the versions"
          total={drilldown.total}
          totalIncome={drilldown.totalIncome}
          bars={drilldown.bars}
          slices={drilldown.slices}
          userKind={singleKind}
          onClear={() => setSelectedCountry(null)}
        />
      ) : null}
    </StatisticsPageShell>
  );
}
