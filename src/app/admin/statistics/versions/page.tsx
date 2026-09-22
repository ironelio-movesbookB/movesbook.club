'use client';

import { useMemo, useState } from 'react';
import StatisticsPageShell, {
  StatisticsSelect,
  countryFilterOptions,
  userTypeFilterOptions,
} from '@/components/admin/statistics/StatisticsPageShell';
import { StatisticsVersionsBars } from '@/components/admin/statistics/StatisticsCharts';
import UserTypeDistributionDrilldown from '@/components/admin/statistics/UserTypeDistributionDrilldown';
import StatisticsBarUsersSection from '@/components/admin/statistics/StatisticsBarUsersSection';
import { useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import { aggregateKindsForVersion } from '@/lib/admin/statisticsDrilldown';
import type { StatsBarScope } from '@/components/admin/AdminRegisteredUsersList';
import type { StatsUserKind, StatsVersionBucket } from '@/lib/admin/statisticsKinds';

export default function VersionsByCountryPage() {
  const { authChecked, loading, error, data, filters, setFilters } = useAdminStatistics({
    enableCountry: true,
    enableUserType: true,
  });
  const [selectedVersion, setSelectedVersion] = useState<StatsVersionBucket | null>(null);
  const [barScope, setBarScope] = useState<StatsBarScope | null>(null);

  const drilldown = useMemo(() => {
    if (!data?.usersLite || !selectedVersion) return null;
    return aggregateKindsForVersion(data.usersLite, {
      version: selectedVersion,
      country: filters.country || null,
      kind:
        filters.userType === 'all' || filters.userType === 'except_groups'
          ? filters.userType === 'except_groups'
            ? 'except_groups'
            : 'all'
          : filters.userType,
    });
  }, [data?.usersLite, selectedVersion, filters.country, filters.userType]);

  if (!authChecked) return null;

  const scopeLabel = filters.country ? filters.country : 'World';
  const typeLabel =
    filters.userType === 'all'
      ? 'all types'
      : filters.userType === 'except_groups'
        ? 'all except Groups'
        : filters.userType;

  return (
    <StatisticsPageShell
      title="Bargraph versions for country"
      description="Bars for subscription versions (Trial, Base, Premium, Professional). Counts under each bar are absolute user totals — Base includes Base PFU, Premium includes Premium PFU, Professional includes Professional PFU. Filter by country and/or type of user. Click a version to see its distribution among user types, and the matching users list below."
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
              setSelectedVersion(null);
              setBarScope(null);
              setFilters((f) => ({ ...f, country }));
            }}
            options={countryFilterOptions(data?.countries ?? [])}
          />
          <StatisticsSelect
            id="userType"
            label="Type of user"
            value={filters.userType}
            onChange={(userType) => {
              setSelectedVersion(null);
              setBarScope(null);
              setFilters((f) => ({
                ...f,
                userType: userType as StatsUserKind | 'all',
              }));
            }}
            options={userTypeFilterOptions(true)}
          />
        </>
      }
    >
      <StatisticsVersionsBars
        rows={data?.versions ?? []}
        onVersionSelect={(version) => {
          setSelectedVersion(version);
          if (!version) setBarScope(null);
        }}
        onOpenBarList={(version: StatsVersionBucket) => {
          setBarScope({
            country: filters.country || null,
            kind: filters.userType,
            version,
          });
        }}
      />
      {selectedVersion && drilldown ? (
        <UserTypeDistributionDrilldown
          title={`Distribution — ${scopeLabel}`}
          subtitle={`${selectedVersion} · ${typeLabel}`}
          total={drilldown.total}
          totalIncome={drilldown.totalIncome}
          slices={drilldown.slices}
          onClear={() => {
            setSelectedVersion(null);
            setBarScope(null);
          }}
        />
      ) : null}
      {barScope ? (
        <StatisticsBarUsersSection
          scope={barScope}
          onClear={() => setBarScope(null)}
        />
      ) : null}
    </StatisticsPageShell>
  );
}
