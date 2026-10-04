'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Search, X } from 'lucide-react';
import StatisticsPageShell, {
  StatisticsSelect,
  usersByCountryFilterOptions,
} from '@/components/admin/statistics/StatisticsPageShell';
import { StatisticsVerticalCountryBars } from '@/components/admin/statistics/StatisticsCharts';
import VersionDistributionDrilldown from '@/components/admin/statistics/VersionDistributionDrilldown';
import StatisticsBarUsersSection from '@/components/admin/statistics/StatisticsBarUsersSection';
import SubscriptionDetailsPanel from '@/components/admin/statistics/SubscriptionDetailsPanel';
import { useAdminStatistics } from '@/components/admin/statistics/useAdminStatistics';
import {
  aggregateVersionsForScope,
  kindRowsByGroup,
  subscriptionDetailsForUsers,
} from '@/lib/admin/statisticsDrilldown';
import { countryGeo } from '@/lib/countries/countryGeo';
import { countryFlagSrc } from '@/lib/countries/countryFlag';
import type { StatsBarScope } from '@/components/admin/AdminRegisteredUsersList';
import type { StatsUserLite } from '@/lib/admin/buildStatistics';
import {
  STATS_KIND_LABELS,
  STATS_USER_KINDS,
  type StatsDetailKind,
  type StatsUserKind,
  type StatsVersionBucket,
} from '@/lib/admin/statisticsKinds';

type Area = 'countries' | 'continents';
type SubscriptionFilter = 'all' | 'new' | 'renew';
type VersionFilter = 'all' | 'Base' | 'Premium' | 'Professional';
type DetailView = { label: string; view: 'table' | 'pies' };

const AREA_OPTIONS = [
  { value: 'countries', label: 'Countries' },
  { value: 'continents', label: 'Continents' },
];
const SUBSCRIPTION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'renew', label: 'Renewals' },
];
const VERSION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Base', label: 'Base' },
  { value: 'Premium', label: 'Premium' },
  { value: 'Professional', label: 'Professional' },
];

export default function UsersByCountryBarsPage() {
  const { authChecked, loading, error, data, filters, setFilters } = useAdminStatistics({
    enableUserType: true,
    enableCountry: false,
    initial: { userType: 'all' },
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [barScope, setBarScope] = useState<StatsBarScope | null>(null);
  const [area, setArea] = useState<Area>('countries');
  const [subscription, setSubscription] = useState<SubscriptionFilter>('all');
  const [version, setVersion] = useState<VersionFilter>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [excluded, setExcluded] = useState<StatsDetailKind[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const onlyKind = filters.userType === 'except_groups' ? 'all' : filters.userType;
  const isSingleType = onlyKind !== 'all' && STATS_USER_KINDS.includes(onlyKind as StatsUserKind);
  const isCountries = area === 'countries';

  const groupOf = useMemo(
    () =>
      isCountries
        ? (u: StatsUserLite) => u.country
        : (u: StatsUserLite) => countryGeo(u.country === 'Unknown' ? null : u.country).continent,
    [isCountries],
  );

  /** Users of the selected type of subscription and version. */
  const scopedUsers = useMemo(
    () =>
      (data?.usersLite ?? []).filter(
        (u) =>
          (subscription === 'all' || (subscription === 'renew') === Boolean(u.renewal)) &&
          (version === 'all' || u.version === version),
      ),
    [data?.usersLite, subscription, version],
  );

  const allRows = useMemo(
    () =>
      kindRowsByGroup(
        isSingleType ? scopedUsers.filter((u) => u.kind === onlyKind) : scopedUsers,
        groupOf,
      ),
    [scopedUsers, isSingleType, onlyKind, groupOf],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !isCountries || !q ? allRows : allRows.filter((r) => r.country.toLowerCase().includes(q));
  }, [allRows, isCountries, search]);

  const totals = useMemo(
    () =>
      allRows.reduce(
        (acc, r) => ({ users: acc.users + r.total, income: acc.income + r.totalIncome }),
        { users: 0, income: 0 },
      ),
    [allRows],
  );

  const drilldown = useMemo(() => {
    if (!isCountries || !selectedCountry || !isSingleType) return null;
    return aggregateVersionsForScope(scopedUsers, {
      country: selectedCountry,
      kind: onlyKind as StatsUserKind,
    });
  }, [scopedUsers, isCountries, selectedCountry, isSingleType, onlyKind]);

  const details = useMemo(
    () =>
      detail ? subscriptionDetailsForUsers(scopedUsers.filter((u) => groupOf(u) === detail.label)) : null,
    [detail, scopedUsers, groupOf],
  );

  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [detail]);

  const resetSelection = () => {
    setSelectedCountry(null);
    setBarScope(null);
    setDetail(null);
  };

  if (!authChecked) return null;

  const versionScope = version === 'all' ? null : (version as StatsVersionBucket);

  return (
    <StatisticsPageShell
      title="Vertical Bargraph of users for countries"
      description="Start with “Each type of users” (5 bars per country). Click a bar (or legend) to filter to that type only. Click the name of a country once for the details of new subscriptions and renewals, twice for their graphs. AVE = Income : Users."
      totalUsers={totals.users}
      incomeEuro={totals.income}
      loading={loading}
      error={error}
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <StatisticsSelect
            id="userType"
            label="Type of user"
            value={onlyKind}
            onChange={(userType) => {
              resetSelection();
              setFilters((f) => ({ ...f, userType: userType as StatsUserKind | 'all' }));
            }}
            options={usersByCountryFilterOptions()}
          />
          <StatisticsSelect
            id="area"
            label="Geographical area"
            value={area}
            onChange={(v) => {
              resetSelection();
              setSearch('');
              setArea(v as Area);
            }}
            options={AREA_OPTIONS}
          />
          <StatisticsSelect
            id="subscription"
            label="Type of subscription"
            value={subscription}
            onChange={(v) => {
              resetSelection();
              setSubscription(v as SubscriptionFilter);
            }}
            options={SUBSCRIPTION_OPTIONS}
          />
          <StatisticsSelect
            id="version"
            label="Type of version"
            value={version}
            onChange={(v) => {
              resetSelection();
              setVersion(v as VersionFilter);
            }}
            options={VERSION_OPTIONS}
          />
          {isCountries ? (
            <div className="flex items-stretch">
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Country…"
                aria-label="Search a country"
                className="w-40 border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              />
              <button
                type="button"
                onClick={() => searchRef.current?.focus()}
                className="flex items-center gap-1.5 border border-l-0 border-gray-300 bg-gray-100 px-3 text-sm font-semibold text-gray-800 hover:bg-gray-200"
              >
                <Search className="h-4 w-4" aria-hidden />
                Search
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <StatisticsVerticalCountryBars
        rows={rows}
        onlyKind={onlyKind}
        showAverage
        selectedLabel={detail?.label ?? null}
        renderLabelIcon={(label) => {
          if (!isCountries) return <Globe2 className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />;
          const iso2 = countryGeo(label).iso2;
          return iso2 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={countryFlagSrc(iso2)}
              alt=""
              width={18}
              height={13}
              className="h-[13px] w-[18px] shrink-0 border border-black/10 object-cover"
            />
          ) : (
            <span className="h-[13px] w-[18px] shrink-0 border border-dashed border-gray-300" aria-hidden />
          );
        }}
        onLabelClick={(label) => setDetail({ label, view: 'table' })}
        onLabelDoubleClick={(label) => setDetail({ label, view: 'pies' })}
        onKindSelect={(kind) => {
          resetSelection();
          setFilters((f) => ({ ...f, userType: kind }));
        }}
        onCountrySelect={(country) => {
          setSelectedCountry(country);
          if (!country) setBarScope(null);
        }}
        onOpenBarList={
          isCountries
            ? (country, kind) => setBarScope({ country, kind, version: versionScope })
            : undefined
        }
      />
      {detail && details ? (
        <div ref={detailRef} className="mt-4 scroll-mt-4">
          <div className="mb-2 flex items-center gap-3 border-b border-gray-300 pb-1.5">
            <h2 className="text-base font-bold text-gray-900">
              {detail.label} —{' '}
              {detail.view === 'table'
                ? 'details of new subscriptions and renewals'
                : 'graphs of new subscriptions and renewals'}
            </h2>
            <button
              type="button"
              onClick={() => setDetail((d) => (d ? { ...d, view: d.view === 'table' ? 'pies' : 'table' } : d))}
              className="text-xs font-semibold text-[#1e88e5] hover:underline"
            >
              {detail.view === 'table' ? 'Show graphs' : 'Show details'}
            </button>
            <button
              type="button"
              onClick={() => setDetail(null)}
              aria-label="Close"
              className="ml-auto rounded p-1 text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SubscriptionDetailsPanel
            details={details}
            excluded={excluded}
            onToggleExclude={(kind) =>
              setExcluded((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]))
            }
            view={detail.view}
          />
        </div>
      ) : null}
      {isSingleType && selectedCountry && drilldown ? (
        <VersionDistributionDrilldown
          title={`${STATS_KIND_LABELS[onlyKind as StatsUserKind]} — ${selectedCountry}`}
          subtitle="Distribution of the versions — click a version bar to refresh the users list"
          total={drilldown.total}
          totalIncome={drilldown.totalIncome}
          bars={drilldown.bars}
          slices={drilldown.slices}
          userKind={onlyKind as StatsUserKind}
          onClear={() => {
            setSelectedCountry(null);
            setBarScope(null);
          }}
          onOpenUsersList={() => {
            setBarScope({
              country: selectedCountry,
              kind: onlyKind as StatsUserKind,
              version: versionScope,
            });
          }}
          onOpenBarList={(v: StatsVersionBucket) => {
            setBarScope({
              country: selectedCountry,
              kind: onlyKind as StatsUserKind,
              version: v,
            });
          }}
        />
      ) : null}
      {barScope ? <StatisticsBarUsersSection scope={barScope} onClear={() => setBarScope(null)} /> : null}
    </StatisticsPageShell>
  );
}
