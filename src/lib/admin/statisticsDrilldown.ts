import type { StatsSlice, StatsUserLite, VersionBar } from '@/lib/admin/buildStatistics';
import {
  STATS_KIND_LABELS,
  STATS_USER_KINDS,
  STATS_VERSION_BUCKETS,
  type StatsTypeKindFilter,
  type StatsUserKind,
  type StatsVersionBucket,
  typeKindMatches,
} from '@/lib/admin/statisticsKinds';

export type DrilldownScope = {
  country?: string | null;
  /** Include only these countries (case-insensitive). */
  countriesIn?: string[] | null;
  /** Exclude these countries (case-insensitive). Used for Rest of world / Others. */
  countriesOut?: string[] | null;
  kind?: StatsTypeKindFilter | null;
  version?: StatsVersionBucket | null;
};

function countrySet(list: string[] | null | undefined): Set<string> | null {
  if (!list?.length) return null;
  return new Set(list.map((c) => c.toLowerCase()));
}

function matchesScope(u: StatsUserLite, scope: DrilldownScope): boolean {
  const country = u.country.toLowerCase();
  if (scope.country && scope.country !== '__rest_of_world__' && scope.country !== '__others__') {
    if (country !== scope.country.toLowerCase()) return false;
  }
  const only = countrySet(scope.countriesIn);
  if (only && !only.has(country)) return false;
  const exclude = countrySet(scope.countriesOut);
  if (exclude && exclude.has(country)) return false;
  if (scope.kind && !typeKindMatches(u.kind, scope.kind)) return false;
  if (scope.version && u.version !== scope.version) return false;
  return true;
}

function roundEuro(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Version counts (+ pie slices) for a country / user-type scope. */
export function aggregateVersionsForScope(
  users: StatsUserLite[],
  scope: DrilldownScope,
): { total: number; totalIncome: number; bars: VersionBar[]; slices: StatsSlice[] } {
  const counts: Record<StatsVersionBucket, number> = {
    Trial: 0,
    Base: 0,
    Premium: 0,
    Professional: 0,
    Other: 0,
  };
  const incomes: Record<StatsVersionBucket, number> = {
    Trial: 0,
    Base: 0,
    Premium: 0,
    Professional: 0,
    Other: 0,
  };
  let total = 0;
  let totalIncome = 0;
  for (const u of users) {
    if (!matchesScope(u, scope)) continue;
    counts[u.version] += 1;
    incomes[u.version] += u.income ?? 0;
    total += 1;
    totalIncome += u.income ?? 0;
  }
  totalIncome = roundEuro(totalIncome);
  const bars: VersionBar[] = STATS_VERSION_BUCKETS.map((version) => ({
    version,
    count: counts[version],
    income: roundEuro(incomes[version]),
  }));
  const slices: StatsSlice[] = STATS_VERSION_BUCKETS.map((version) => ({
    key: version,
    label: version,
    count: counts[version],
    income: roundEuro(incomes[version]),
    percent: total > 0 ? Math.round((counts[version] / total) * 1000) / 10 : 0,
  })).filter((s) => s.count > 0);
  return { total, totalIncome, bars, slices };
}

/** User-type distribution for a selected version (optional country). */
export function aggregateKindsForVersion(
  users: StatsUserLite[],
  scope: DrilldownScope & { version: StatsVersionBucket },
): { total: number; totalIncome: number; slices: StatsSlice[] } {
  const byKind: Record<StatsUserKind, number> = {
    single: 0,
    coaches: 0,
    teams: 0,
    clubs: 0,
    groups: 0,
  };
  const byKindIncome: Record<StatsUserKind, number> = {
    single: 0,
    coaches: 0,
    teams: 0,
    clubs: 0,
    groups: 0,
  };
  let total = 0;
  let totalIncome = 0;
  for (const u of users) {
    if (!matchesScope(u, scope)) continue;
    byKind[u.kind] += 1;
    byKindIncome[u.kind] += u.income ?? 0;
    total += 1;
    totalIncome += u.income ?? 0;
  }
  totalIncome = roundEuro(totalIncome);
  const slices: StatsSlice[] = STATS_USER_KINDS.map((kind) => ({
    key: kind,
    label: STATS_KIND_LABELS[kind],
    count: byKind[kind],
    income: roundEuro(byKindIncome[kind]),
    percent: total > 0 ? Math.round((byKind[kind] / total) * 1000) / 10 : 0,
  })).filter((s) => s.count > 0);
  return { total, totalIncome, slices };
}
