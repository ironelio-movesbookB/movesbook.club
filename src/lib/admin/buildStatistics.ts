import { UserType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  listStatsSubscriptionPeriods,
  parseAmountPaid,
  resolveStatsSubscription,
  type StatsSubscription,
} from '@/lib/admin/networkSubscriptionHistory';
import {
  COST_RECOVERY_LANGUAGES,
  COST_RECOVERY_VERSIONS,
  emptyTypeRecord,
  type CostRecoveryReal,
  type CostRecoveryType,
  type CostRecoveryVersion,
} from '@/lib/admin/costRecoveryTypes';
import {
  ALL_STATS_USER_TYPES,
  STATS_DETAIL_KINDS,
  STATS_KIND_LABELS,
  STATS_KIND_TYPES,
  STATS_USER_KINDS,
  STATS_VERSION_BUCKETS,
  classifyVersionBucket,
  defaultVersionForKind,
  kindFromUserType,
  typeKindLabel,
  typeKindMatches,
  type StatsDetailKind,
  type StatsTypeKindFilter,
  type StatsUserKind,
  type StatsVersionBucket,
} from '@/lib/admin/statisticsKinds';
import {
  listSpecialOfferRegistrations,
  type SpecialOfferUserRegistration,
} from '@/lib/subscriptions/specialOffers';

export type StatsSlice = {
  key: string;
  label: string;
  count: number;
  /** € recorded as paid for the current subscriptions in this slice (unrecorded = 0). */
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

/** Current users of one type split by first subscription (new) and renewal. */
export type SubscriptionDetailRow = {
  newCount: number;
  renewCount: number;
  newIncome: number;
  renewIncome: number;
};

/** Compact rows for client-side drill-downs (version ↔ user type ↔ country). */
export type StatsUserLite = {
  country: string;
  kind: StatsUserKind;
  version: StatsVersionBucket;
  income: number;
  /** Account purchased by a club admin for his member (Club accounts in the details). */
  clubAccount?: boolean;
  /** The current subscription renews a previous one (otherwise it is a new subscription). */
  renewal?: boolean;
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
  /**
   * Current users (country filter applied) per type of user, split into new subscriptions and
   * renewals. Club accounts are counted here instead of the member's own type.
   */
  subscriptionDetails: Record<StatsDetailKind, SubscriptionDetailRow>;
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
  resolvedVersion: string | null;
  subscription: StatsSubscription;
  adminSettings: string | null;
  /** Language selected by the user (settings), lower-case code. */
  language: string | null;
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

function resolveCurrentVersion(u: RawUser, kind: StatsUserKind): string {
  return (
    u.subscription.version ||
    u.resolvedVersion?.trim() ||
    u.subscription.historyVersion ||
    defaultVersionForKind(kind)
  );
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
        settings: { select: { adminSettings: true, language: true } },
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
      resolvedVersion: fallback,
      subscription: resolveStatsSubscription(u.settings?.adminSettings ?? null),
      adminSettings: u.settings?.adminSettings ?? null,
      language: u.settings?.language?.trim().toLowerCase() || null,
    };
  });
}

const COST_RECOVERY_TYPE_BY_KIND: Partial<Record<StatsUserKind, CostRecoveryType>> = {
  single: 'athletes',
  coaches: 'coaches',
  teams: 'teams',
  clubs: 'clubs',
};

const COST_RECOVERY_VERSION_BY_BUCKET: Partial<Record<StatsVersionBucket, CostRecoveryVersion>> = {
  Base: 'base',
  Premium: 'premium',
  Professional: 'professional',
};

/**
 * Cost recovery plan — Real: every subscription in the archive (history + live window) and the
 * € paid for it, per version, per language selected by the user and per type of user.
 * Accounts purchased by a club for a member go to Club accounts; Groups are not part of the plan.
 */
export async function buildCostRecoveryReal(): Promise<CostRecoveryReal> {
  const real = Object.fromEntries(
    COST_RECOVERY_VERSIONS.map((v) => [
      v.id,
      Object.fromEntries(
        COST_RECOVERY_LANGUAGES.map((l) => [l.code, emptyTypeRecord(() => ({ n: 0, eur: 0 }))]),
      ),
    ]),
  ) as CostRecoveryReal;
  const languageCodes = new Set(COST_RECOVERY_LANGUAGES.map((l) => l.code));

  for (const u of await loadRawUsers()) {
    const kind = kindFromUserType(u.userType);
    const kindType = kind ? COST_RECOVERY_TYPE_BY_KIND[kind] : undefined;
    if (!kind || !kindType) continue;
    const langPrefix = (u.language ?? '').slice(0, 2);
    const language = languageCodes.has(langPrefix) ? langPrefix : 'en';
    const accountVersion = u.resolvedVersion?.trim() || defaultVersionForKind(kind);

    const periods = listStatsSubscriptionPeriods(u.adminSettings);
    // Legacy accounts with no archived period still hold their registration subscription.
    const subscriptions =
      periods.length > 0
        ? periods.map((p) => ({
            version: p.version?.trim() || accountVersion,
            eur: parseAmountPaid(p.amountPaid),
            clubAccount: Boolean(p.purchasedByClubId?.trim()),
          }))
        : [{ version: accountVersion, eur: 0, clubAccount: false }];

    for (const s of subscriptions) {
      const version = COST_RECOVERY_VERSION_BY_BUCKET[classifyVersionBucket(s.version)];
      if (!version) continue;
      const cell = real[version][language]![s.clubAccount ? 'clubAccounts' : kindType];
      cell.n += 1;
      cell.eur = roundEuro(cell.eur + s.eur);
    }
  }
  return real;
}

export type BuildStatisticsOptions = {
  country?: string | null;
  userType?: StatsUserKind | 'all' | 'except_groups';
  topCountriesN?: number;
  typeCountriesN?: number;
  typeKind?: StatsTypeKindFilter;
  /** Only users whose subscription was purchased in "Special offer" mode. */
  specialOffersOnly?: boolean;
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

  const [allRawUsers, offerRegistrations] = await Promise.all([
    loadRawUsers(),
    options.specialOffersOnly
      ? listSpecialOfferRegistrations()
      : Promise.resolve([] as SpecialOfferUserRegistration[]),
  ]);
  // Registrations are newest first: keep each user's latest special-offer purchase.
  const offerByUser = new Map<string, SpecialOfferUserRegistration>();
  for (const reg of offerRegistrations) {
    if (!offerByUser.has(reg.userId)) offerByUser.set(reg.userId, reg);
  }
  const rawUsers = options.specialOffersOnly
    ? allRawUsers.filter((u) => offerByUser.has(u.id))
    : allRawUsers;

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
  const subscriptionDetails = Object.fromEntries(
    STATS_DETAIL_KINDS.map((k) => [k, { newCount: 0, renewCount: 0, newIncome: 0, renewIncome: 0 }]),
  ) as Record<StatsDetailKind, SubscriptionDetailRow>;

  for (const u of rawUsers) {
    const kind = kindFromUserType(u.userType);
    if (!kind) continue;
    // Current users / graphs: only users whose last subscription is not expired.
    if (!u.subscription.active) continue;

    if (matchesCountry(u)) {
      const detail = subscriptionDetails[u.subscription.clubAccount ? 'clubAccounts' : kind];
      if (u.subscription.renewal) {
        detail.renewCount += 1;
        detail.renewIncome += u.subscription.amountPaid;
      } else {
        detail.newCount += 1;
        detail.newIncome += u.subscription.amountPaid;
      }
    }

    const country = u.country || 'Unknown';
    const offerReg = offerByUser.get(u.id);
    const versionBucket = classifyVersionBucket(
      offerReg?.versionName ?? resolveCurrentVersion(u, kind),
    );
    const userIncome = offerReg ? offerReg.costEuro : u.subscription.amountPaid;
    usersLite.push({
      country,
      kind,
      version: versionBucket,
      income: userIncome,
      ...(u.subscription.clubAccount ? { clubAccount: true } : {}),
      ...(u.subscription.renewal ? { renewal: true } : {}),
    });

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
      if (!u.subscription.active) continue;
      if (countryFilter && (u.country ?? '').toLowerCase() !== countryFilter.toLowerCase()) continue;
      const c = u.country || 'Unknown';
      const userIncome = u.subscription.amountPaid;
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
    subscriptionDetails: Object.fromEntries(
      STATS_DETAIL_KINDS.map((k) => {
        const d = subscriptionDetails[k];
        return [k, { ...d, newIncome: roundEuro(d.newIncome), renewIncome: roundEuro(d.renewIncome) }];
      }),
    ) as Record<StatsDetailKind, SubscriptionDetailRow>,
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
    if (!u.subscription.active) continue;
    if (!typeKindMatches(kind, kindFilter)) continue;

    const country = u.country || 'Unknown';
    if (countryFilter && country !== countryFilter) continue;

    if (versionFilter) {
      if (classifyVersionBucket(resolveCurrentVersion(u, kind)) !== versionFilter) continue;
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
