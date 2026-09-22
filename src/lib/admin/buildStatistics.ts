import { UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readNetworkSubscriptionHistory, isActiveMembershipPeriod, hasActiveLastSubscription, pickLatestSubscriptionByExpiry } from '@/lib/admin/networkSubscriptionHistory';
import {
  ALL_STATS_USER_TYPES,
  STATS_KIND_LABELS,
  STATS_KIND_TYPES,
  STATS_USER_KINDS,
  STATS_VERSION_BUCKETS,
  classifyVersionBucket,
  defaultVersionForKind,
  kindFromUserType,
  typeKindLabel,
  typeKindMatches,
  type StatsTypeKindFilter,
  type StatsUserKind,
  type StatsVersionBucket,
} from '@/lib/admin/statisticsKinds';

export type StatsSlice = {
  key: string;
  label: string;
  count: number;
  /** Estimated subscription income (€) for this slice. */
  income: number;
  percent: number;
};

export type KindDistribution = {
  total: number;
  totalIncome: number;
  slices: StatsSlice[];
  byKind: Record<StatsUserKind, number>;
  byKindIncome: Record<StatsUserKind, number>;
};

export type CountryKindRow = {
  country: string;
  total: number;
  totalIncome: number;
  byKind: Record<StatsUserKind, number>;
  byKindIncome: Record<StatsUserKind, number>;
};

export type VersionBar = {
  version: StatsVersionBucket;
  count: number;
  income: number;
};

/** Compact rows for client-side drill-downs (version ↔ user type ↔ country). */
export type StatsUserLite = {
  country: string;
  kind: StatsUserKind;
  version: StatsVersionBucket;
  income: number;
};

export type StatisticsPayload = {
  totalUsers: number;
  incomeEuro: number;
  countries: string[];
  worldDistribution: KindDistribution;
  topCountries: Array<{
    country: string;
    total: number;
    distribution: KindDistribution;
  }>;
  /** Aggregate user-type distribution for all countries outside the top N. */
  restOfWorld: {
    total: number;
    countryCount: number;
    distribution: KindDistribution;
  } | null;
  typeByCountry: {
    kind: StatsTypeKindFilter;
    label: string;
    total: number;
    totalIncome: number;
    countries: StatsSlice[];
  };
  allTypesByCountry: Array<{
    kind: StatsUserKind;
    label: string;
    total: number;
    totalIncome: number;
    countries: StatsSlice[];
  }>;
  countriesBars: CountryKindRow[];
  versions: VersionBar[];
  /** Unfiltered user matrix for interactive drill-downs. */
  usersLite: StatsUserLite[];
  filters: {
    country: string | null;
    userType: StatsUserKind | 'all' | 'except_groups';
    topCountriesN: number;
    typeCountriesN: number;
  };
};

type RawUser = {
  id: string;
  email: string;
  userType: UserType;
  country: string | null;
  adminSettings: string | null;
  resolvedVersion: string | null;
};

function emptyByKind(): Record<StatsUserKind, number> {
  return { single: 0, coaches: 0, teams: 0, clubs: 0, groups: 0 };
}

function roundEuro(value: number): number {
  return Math.round(value * 100) / 100;
}

function toSlices(
  byKind: Record<StatsUserKind, number>,
  byKindIncome: Record<StatsUserKind, number>,
  total: number,
): StatsSlice[] {
  return STATS_USER_KINDS.map((kind) => {
    const count = byKind[kind] ?? 0;
    return {
      key: kind,
      label: STATS_KIND_LABELS[kind],
      count,
      income: roundEuro(byKindIncome[kind] ?? 0),
      percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  }).filter((s) => s.count > 0 || total === 0);
}

function buildKindDistribution(
  byKind: Record<StatsUserKind, number>,
  byKindIncome: Record<StatsUserKind, number> = emptyByKind(),
): KindDistribution {
  const total = STATS_USER_KINDS.reduce((sum, k) => sum + (byKind[k] ?? 0), 0);
  const totalIncome = roundEuro(
    STATS_USER_KINDS.reduce((sum, k) => sum + (byKindIncome[k] ?? 0), 0),
  );
  return {
    total,
    totalIncome,
    slices: toSlices(byKind, byKindIncome, total),
    byKind,
    byKindIncome,
  };
}

function resolveCurrentVersion(
  adminSettings: string | null,
  kind: StatsUserKind,
  fallbackVersion?: string | null,
): string {
  const periods = readNetworkSubscriptionHistory(adminSettings);
  // Only the last subscription (highest expiry) counts.
  const last = pickLatestSubscriptionByExpiry(periods);
  if (last && isActiveMembershipPeriod(last.dateEnd, last.status) && last.version?.trim()) {
    return last.version.trim();
  }
  if (fallbackVersion?.trim()) return fallbackVersion.trim();
  return defaultVersionForKind(kind);
}

/** Resolve versions from promocode applies + legacy subscription_setting_id for older registrations. */
async function loadExternalVersionByEmail(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Prefer current legacy subscription_setting_id (source of truth after quick register).
  try {
    const { getLegacyUsersTable, getSubscriptionSettingsTable } = await import(
      '@/lib/promocodes/legacyDb'
    );
    const usersTable = await getLegacyUsersTable();
    const subTable = await getSubscriptionSettingsTable();
    if (usersTable && subTable) {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ email: string | null; id: number | bigint; subscription_name: string | null }>
      >(
        `SELECT LOWER(u.email) AS email, u.id, s.subscription_name
         FROM \`${usersTable}\` u
         INNER JOIN \`${subTable}\` s ON s.id = u.subscription_setting_id
         WHERE u.subscription_setting_id IS NOT NULL
           AND s.subscription_name IS NOT NULL
           AND s.subscription_name != ''`
      );
      for (const row of rows) {
        const version = String(row.subscription_name ?? '').trim();
        if (!version) continue;
        const email = String(row.email ?? '').trim().toLowerCase();
        if (email) map.set(email, version);
        map.set(`legacy_${Number(row.id)}`, version);
      }
    }
  } catch {
    /* legacy optional */
  }

  // Fill gaps from promocode apply receiver_version.
  try {
    const applies = await prisma.promocodeApply.findMany({
      where: {
        receiverVersion: { not: null },
      },
      select: { receiverEmail: true, receiverVersion: true, receiverId: true, id: true },
      orderBy: { id: 'desc' },
    });
    for (const row of applies) {
      const version = row.receiverVersion?.trim();
      if (!version) continue;
      const email = row.receiverEmail?.trim().toLowerCase();
      if (email && !map.has(email)) map.set(email, version);
      if (row.receiverId && row.receiverId > 0) {
        const legacyKey = `legacy_${row.receiverId}`;
        if (!map.has(legacyKey)) map.set(legacyKey, version);
      }
    }
  } catch {
    /* optional */
  }

  return map;
}

/** Map subscription_settings rows to rough € prices by version bucket + kind. */
async function loadPriceTable(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const rows = await prisma.subscriptionSetting.findMany({
      where: { OR: [{ deleteStatus: null }, { deleteStatus: { not: 1 } }] },
      select: { subscriptionName: true, shortName: true, price: true, roleId: true },
    });
    for (const row of rows) {
      const price = row.price != null ? Number(row.price) : 0;
      if (!Number.isFinite(price) || price <= 0) continue;
      const name = `${row.subscriptionName ?? ''} ${row.shortName ?? ''}`.toLowerCase();
      const bucket = classifyVersionBucket(name);
      let kindHint = '';
      if (name.includes('club') || row.roleId === 8) kindHint = 'clubs';
      else if (name.includes('coach')) kindHint = 'coaches';
      else if (name.includes('team')) kindHint = 'teams';
      else if (name.includes('group')) kindHint = 'groups';
      else if (name.includes('single') || name.includes('user') || row.roleId === 5) kindHint = 'single';
      if (kindHint) map.set(`${kindHint}:${bucket}`, price);
      map.set(`*:${bucket}`, map.get(`*:${bucket}`) ?? price);
    }
  } catch {
    // table may be empty / missing columns
  }

  // Fallback defaults (€) when settings missing
  const defaults: Array<[string, number]> = [
    ['single:Trial', 0],
    ['single:Base', 100],
    ['single:Premium', 123],
    ['single:Professional', 150],
    ['coaches:Trial', 0],
    ['coaches:Base', 120],
    ['coaches:Premium', 180],
    ['coaches:Professional', 220],
    ['teams:Trial', 0],
    ['teams:Base', 150],
    ['teams:Premium', 200],
    ['teams:Professional', 250],
    ['clubs:Trial', 0],
    ['clubs:Base', 10],
    ['clubs:Premium', 10],
    ['clubs:Professional', 20],
    ['groups:Trial', 0],
    ['groups:Base', 50],
    ['groups:Premium', 80],
    ['groups:Professional', 100],
  ];
  for (const [key, value] of defaults) {
    if (!map.has(key)) map.set(key, value);
  }
  return map;
}

function priceFor(map: Map<string, number>, kind: StatsUserKind, version: string): number {
  const bucket = classifyVersionBucket(version);
  return map.get(`${kind}:${bucket}`) ?? map.get(`*:${bucket}`) ?? 0;
}

async function loadRawUsers(): Promise<RawUser[]> {
  const [users, externalVersions] = await Promise.all([
    prisma.user.findMany({
      where: {
        userType: { in: ALL_STATS_USER_TYPES },
        superAdminId: null,
      },
      select: {
        id: true,
        email: true,
        userType: true,
        country: true,
        settings: { select: { adminSettings: true } },
      },
    }),
    loadExternalVersionByEmail(),
  ]);

  return users.map((u) => {
    const emailKey = u.email.trim().toLowerCase();
    const fallback =
      externalVersions.get(emailKey) ??
      externalVersions.get(u.id) ??
      null;
    return {
      id: u.id,
      email: u.email,
      userType: u.userType,
      country: u.country?.trim() || null,
      adminSettings: u.settings?.adminSettings ?? null,
      resolvedVersion: fallback,
    };
  });
}

export type BuildStatisticsOptions = {
  country?: string | null;
  userType?: StatsUserKind | 'all' | 'except_groups';
  topCountriesN?: number;
  typeCountriesN?: number;
  typeKind?: StatsTypeKindFilter;
};

export async function buildStatisticsPayload(
  options: BuildStatisticsOptions = {},
): Promise<StatisticsPayload> {
  const countryFilter = options.country?.trim() || null;
  const userTypeFilter: StatsUserKind | 'all' | 'except_groups' =
    options.userType === 'except_groups'
      ? 'except_groups'
      : options.userType && options.userType !== 'all'
        ? options.userType
        : 'all';
  const topCountriesN = Math.min(Math.max(options.topCountriesN ?? 8, 1), 50);
  const typeCountriesN = Math.min(Math.max(options.typeCountriesN ?? 15, 1), 50);
  const typeKind: StatsTypeKindFilter =
    options.typeKind === 'all' || options.typeKind === 'except_groups'
      ? options.typeKind
      : options.typeKind && STATS_USER_KINDS.includes(options.typeKind)
        ? options.typeKind
        : 'single';

  const [rawUsers, priceMap] = await Promise.all([loadRawUsers(), loadPriceTable()]);

  const countrySet = new Set<string>();
  for (const u of rawUsers) {
    if (u.country) countrySet.add(u.country);
  }
  const countries = [...countrySet].sort((a, b) => a.localeCompare(b));

  const matchesCountry = (u: RawUser) =>
    !countryFilter || (u.country ?? '').toLowerCase() === countryFilter.toLowerCase();

  const matchesKindFilter = (kind: StatsUserKind) => typeKindMatches(kind, userTypeFilter);

  // World / filtered distribution
  const worldByKind = emptyByKind();
  const worldByKindIncome = emptyByKind();
  let incomeEuro = 0;

  const allKindsPerCountry = new Map<
    string,
    { byKind: Record<StatsUserKind, number>; byKindIncome: Record<StatsUserKind, number> }
  >();
  const versionRecount: Record<StatsVersionBucket, number> = {
    Trial: 0,
    Base: 0,
    Premium: 0,
    Professional: 0,
    Other: 0,
  };
  const versionIncome: Record<StatsVersionBucket, number> = {
    Trial: 0,
    Base: 0,
    Premium: 0,
    Professional: 0,
    Other: 0,
  };
  const usersLite: StatsUserLite[] = [];

  for (const u of rawUsers) {
    const kind = kindFromUserType(u.userType);
    if (!kind) continue;
    // Current users / graphs: only users whose last subscription is not expired.
    if (!hasActiveLastSubscription(u.adminSettings)) continue;

    const country = u.country || 'Unknown';
    const versionName = resolveCurrentVersion(u.adminSettings, kind, u.resolvedVersion);
    const versionBucket = classifyVersionBucket(versionName);
    const userIncome = priceFor(priceMap, kind, versionName);
    usersLite.push({ country, kind, version: versionBucket, income: userIncome });

    // Always accumulate full country×kind matrix (for top-country pies)
    if (!countryFilter || (u.country ?? '').toLowerCase() === countryFilter.toLowerCase()) {
      const existing = allKindsPerCountry.get(country) ?? {
        byKind: emptyByKind(),
        byKindIncome: emptyByKind(),
      };
      existing.byKind[kind] += 1;
      existing.byKindIncome[kind] += userIncome;
      allKindsPerCountry.set(country, existing);
    }

    if (!matchesCountry(u)) continue;
    if (!matchesKindFilter(kind)) continue;

    worldByKind[kind] += 1;
    worldByKindIncome[kind] += userIncome;

    incomeEuro += userIncome;
    versionRecount[versionBucket] += 1;
    versionIncome[versionBucket] += userIncome;
  }

  const rankedCountries = [...allKindsPerCountry.entries()]
    .map(([country, row]) => {
      const total = STATS_USER_KINDS.reduce((s, k) => s + row.byKind[k], 0);
      const totalIncome = roundEuro(
        STATS_USER_KINDS.reduce((s, k) => s + row.byKindIncome[k], 0),
      );
      return {
        country,
        byKind: row.byKind,
        byKindIncome: row.byKindIncome,
        total,
        totalIncome,
      };
    })
    .sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));

  const topCountries = rankedCountries.slice(0, topCountriesN).map((row) => ({
    country: row.country,
    total: row.total,
    distribution: buildKindDistribution(row.byKind, row.byKindIncome),
  }));

  const restCountryRows = rankedCountries.slice(topCountriesN);
  const restByKind = emptyByKind();
  const restByKindIncome = emptyByKind();
  for (const row of restCountryRows) {
    for (const k of STATS_USER_KINDS) {
      restByKind[k] += row.byKind[k];
      restByKindIncome[k] += row.byKindIncome[k];
    }
  }
  const restDistribution = buildKindDistribution(restByKind, restByKindIncome);
  const restOfWorld =
    restDistribution.total > 0
      ? {
          total: restDistribution.total,
          countryCount: restCountryRows.length,
          distribution: restDistribution,
        }
      : null;

  // Type → top N countries + remainder slice ("Others" / "Rest of the world")
  function typeCountrySlices(
    kindFilter: StatsTypeKindFilter,
    n: number,
    restLabel: string = 'Others',
  ) {
    const counts = new Map<string, number>();
    const incomes = new Map<string, number>();
    let total = 0;
    let totalIncome = 0;
    for (const u of rawUsers) {
      const k = kindFromUserType(u.userType);
      if (!k || !typeKindMatches(k, kindFilter)) continue;
      if (!hasActiveLastSubscription(u.adminSettings)) continue;
      if (countryFilter && (u.country ?? '').toLowerCase() !== countryFilter.toLowerCase()) continue;
      const c = u.country || 'Unknown';
      const versionName = resolveCurrentVersion(u.adminSettings, k, u.resolvedVersion);
      const userIncome = priceFor(priceMap, k, versionName);
      counts.set(c, (counts.get(c) ?? 0) + 1);
      incomes.set(c, (incomes.get(c) ?? 0) + userIncome);
      total += 1;
      totalIncome += userIncome;
    }
    const rankedAll = [...counts.entries()]
      .map(([country, count]) => ({
        country,
        count,
        income: roundEuro(incomes.get(country) ?? 0),
      }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
    const top = rankedAll.slice(0, n);
    const restCountries = rankedAll.slice(n);
    const othersCount = restCountries.reduce((s, r) => s + r.count, 0);
    const othersIncome = roundEuro(restCountries.reduce((s, r) => s + r.income, 0));

    const countriesSlices: StatsSlice[] = top.map((r) => ({
      key: r.country,
      label: r.country,
      count: r.count,
      income: r.income,
      percent: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0,
    }));

    // Always include remainder voice when there is anything outside the top N
    // (or when there are more country names than n, even if somehow empty).
    if (othersCount > 0 || restCountries.length > 0) {
      countriesSlices.push({
        key: '__rest_of_world__',
        label: restLabel,
        count: othersCount,
        income: othersIncome,
        percent: total > 0 ? Math.round((othersCount / total) * 1000) / 10 : 0,
      });
    } else if (total > 0 && rankedAll.length > 0) {
      // Still show the voice on each pie when all countries fit in top N (0 remainder).
      countriesSlices.push({
        key: '__rest_of_world__',
        label: restLabel,
        count: 0,
        income: 0,
        percent: 0,
      });
    }

    return {
      kind: kindFilter,
      label: typeKindLabel(kindFilter),
      total,
      totalIncome: roundEuro(totalIncome),
      countries: countriesSlices,
    };
  }

  const typeByCountry = typeCountrySlices(typeKind, typeCountriesN, 'Others');
  const allTypesByCountry = STATS_USER_KINDS.map((k) => {
    const block = typeCountrySlices(k, typeCountriesN, 'Rest of the world');
    return {
      kind: k,
      label: block.label,
      total: block.total,
      totalIncome: block.totalIncome,
      countries: block.countries,
    };
  });

  // Vertical bars: countries with 5 kind bars
  let countriesBars: CountryKindRow[] = rankedCountries.map((row) => {
    const byKind = emptyByKind();
    const byKindIncome = emptyByKind();
    for (const k of STATS_USER_KINDS) {
      byKind[k] = matchesKindFilter(k) ? row.byKind[k] : 0;
      byKindIncome[k] = matchesKindFilter(k) ? row.byKindIncome[k] : 0;
    }
    const total = STATS_USER_KINDS.reduce((s, k) => s + byKind[k], 0);
    const totalIncome = roundEuro(STATS_USER_KINDS.reduce((s, k) => s + byKindIncome[k], 0));
    return { country: row.country, total, totalIncome, byKind, byKindIncome };
  });
  if (userTypeFilter !== 'all') {
    countriesBars = countriesBars
      .filter((r) => STATS_USER_KINDS.some((k) => matchesKindFilter(k) && r.byKind[k] > 0))
      .sort((a, b) => {
        const sumA = STATS_USER_KINDS.reduce(
          (s, k) => s + (matchesKindFilter(k) ? a.byKind[k] : 0),
          0,
        );
        const sumB = STATS_USER_KINDS.reduce(
          (s, k) => s + (matchesKindFilter(k) ? b.byKind[k] : 0),
          0,
        );
        return sumB - sumA;
      });
  }
  if (countryFilter) {
    countriesBars = countriesBars.filter(
      (r) => r.country.toLowerCase() === countryFilter.toLowerCase(),
    );
  } else {
    countriesBars = countriesBars.slice(0, 40);
  }

  const worldDistribution = buildKindDistribution(worldByKind, worldByKindIncome);

  return {
    totalUsers: worldDistribution.total,
    incomeEuro: Math.round(incomeEuro * 100) / 100,
    countries,
    worldDistribution,
    topCountries,
    restOfWorld,
    typeByCountry,
    allTypesByCountry,
    countriesBars,
    versions: STATS_VERSION_BUCKETS.map((version) => ({
      version,
      count: versionRecount[version],
      income: roundEuro(versionIncome[version]),
    })),
    usersLite,
    filters: {
      country: countryFilter,
      userType: userTypeFilter,
      topCountriesN,
      typeCountriesN,
    },
  };
}

/**
 * User ids that contribute to a statistics bar — same rules as buildStatisticsPayload
 * (active last subscription + country/kind/version classification).
 */
export async function resolveStatsBarUserIds(options: {
  country?: string | null;
  kind?: StatsTypeKindFilter | null;
  version?: StatsVersionBucket | null;
}): Promise<string[]> {
  const countryFilter = options.country?.trim() || null;
  const kindFilter: StatsTypeKindFilter = options.kind ?? 'all';
  const versionFilter = options.version ?? null;
  const rawUsers = await loadRawUsers();
  const ids: string[] = [];

  for (const u of rawUsers) {
    const kind = kindFromUserType(u.userType);
    if (!kind) continue;
    if (!hasActiveLastSubscription(u.adminSettings)) continue;
    if (!typeKindMatches(kind, kindFilter)) continue;

    const country = u.country || 'Unknown';
    if (countryFilter && country !== countryFilter) continue;

    if (versionFilter) {
      const versionName = resolveCurrentVersion(u.adminSettings, kind, u.resolvedVersion);
      if (classifyVersionBucket(versionName) !== versionFilter) continue;
    }

    ids.push(u.id);
  }

  return ids;
}

/** Helper for pages that need only types belonging to a kind filter. */
export function typesForKindFilter(userType: StatsUserKind | 'all'): UserType[] {
  if (userType === 'all') return ALL_STATS_USER_TYPES;
  return STATS_KIND_TYPES[userType];
}
