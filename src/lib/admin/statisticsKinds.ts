import { UserType } from '@prisma/client';

/** Statistics user kinds shown in Super Admin charts. */
export type StatsUserKind = 'single' | 'coaches' | 'teams' | 'clubs' | 'groups';

/** Type-of-user selector on type-by-country (includes aggregate modes). */
export type StatsTypeKindFilter = StatsUserKind | 'all' | 'except_groups';

export const STATS_USER_KINDS: StatsUserKind[] = [
  'single',
  'coaches',
  'teams',
  'clubs',
  'groups',
];

export const STATS_KIND_LABELS: Record<StatsUserKind, string> = {
  single: 'Single users',
  coaches: 'Coaches',
  teams: 'Teams',
  clubs: 'Clubs',
  groups: 'Groups',
};

export const STATS_TYPE_KIND_FILTER_LABELS: Record<StatsTypeKindFilter, string> = {
  all: 'ALL Users',
  except_groups: 'All users except Groups',
  ...STATS_KIND_LABELS,
};

export function isStatsTypeKindFilter(value: string | null | undefined): value is StatsTypeKindFilter {
  if (!value) return false;
  return value === 'all' || value === 'except_groups' || STATS_USER_KINDS.includes(value as StatsUserKind);
}

export function typeKindMatches(kind: StatsUserKind, filter: StatsTypeKindFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'except_groups') return kind !== 'groups';
  return kind === filter;
}

export function typeKindLabel(filter: StatsTypeKindFilter): string {
  return STATS_TYPE_KIND_FILTER_LABELS[filter];
}

export const STATS_KIND_TYPES: Record<StatsUserKind, UserType[]> = {
  single: [UserType.ATHLETE],
  coaches: [UserType.COACH],
  teams: [UserType.TEAM, UserType.TEAM_MANAGER],
  clubs: [UserType.CLUB, UserType.CLUB_TRAINER],
  groups: [UserType.GROUP, UserType.GROUP_ADMIN],
};

/** Official colors of the types of users. */
export const STATS_KIND_COLORS: Record<StatsUserKind, string> = {
  single: '#00875a', // Single users (Athletes) — green
  coaches: '#ffee33', // Coaches — yellow
  teams: '#1e88e5', // Teams — blue
  clubs: '#ff2a00', // Clubs — red
  groups: '#8b3dff', // Groups — purple
};

/**
 * Types of users in the subscription details: the five kinds plus Club accounts
 * (accounts purchased by a club admin for his members).
 */
export type StatsDetailKind = StatsUserKind | 'clubAccounts';

/** Legend order of the details (as in the distribution pie). */
export const STATS_DETAIL_KINDS: StatsDetailKind[] = [
  'single',
  'teams',
  'coaches',
  'clubs',
  'clubAccounts',
  'groups',
];

/** Types of users that can be left out of the % and of the Total. */
export const STATS_EXCLUDABLE_KINDS: StatsDetailKind[] = ['clubAccounts', 'groups'];

export const STATS_DETAIL_KIND_LABELS: Record<StatsDetailKind, string> = {
  ...STATS_KIND_LABELS,
  clubAccounts: 'Club accounts',
};

export const STATS_CLUB_ACCOUNTS_COLOR = '#000000';

export const STATS_DETAIL_KIND_COLORS: Record<StatsDetailKind, string> = {
  ...STATS_KIND_COLORS,
  clubAccounts: STATS_CLUB_ACCOUNTS_COLOR,
};

export const ALL_STATS_USER_TYPES: UserType[] = STATS_USER_KINDS.flatMap(
  (k) => STATS_KIND_TYPES[k],
);

export function kindFromUserType(userType: UserType | string): StatsUserKind | null {
  for (const kind of STATS_USER_KINDS) {
    if ((STATS_KIND_TYPES[kind] as string[]).includes(userType)) return kind;
  }
  return null;
}

export function defaultVersionForKind(kind: StatsUserKind): string {
  switch (kind) {
    case 'single':
      return 'User — base version';
    case 'coaches':
      return 'Coach — base';
    case 'teams':
      return 'Team account';
    case 'clubs':
      return 'Club Base';
    case 'groups':
      return 'Group Standard Version';
  }
}

/** Canonical version buckets for the versions bar chart. */
export const STATS_VERSION_BUCKETS = [
  'Trial',
  'Base',
  'Premium',
  'Professional',
  'Other',
] as const;

export type StatsVersionBucket = (typeof STATS_VERSION_BUCKETS)[number];

/**
 * Map a subscription version name to a chart bucket.
 *
 * PFU variants are rolled into the same bucket as the parent tier:
 * - Base = Base + Base PFU (+ “pay for users”, etc.)
 * - Premium = Premium + Premium PFU
 * - Professional = Professional / Professionale + Professional PFU
 */
export function classifyVersionBucket(version: string | null | undefined): StatsVersionBucket {
  const v = (version ?? '').toLowerCase().trim();
  if (!v) return 'Base';

  if (v.includes('trial')) return 'Trial';

  // Explicit PFU rolls (must run before generic keyword checks).
  const isPfu = /\bpfu\b/.test(v) || v.includes('pay for user');
  if (isPfu) {
    if (
      v.includes('professional') ||
      v.includes('professionale') ||
      /(^|[^a-z])pro([^a-z]|$)/.test(v)
    ) {
      return 'Professional';
    }
    if (v.includes('premium')) return 'Premium';
    if (v.includes('base') || v.includes('standard')) return 'Base';
  }

  // Check Professional before Premium/Base (names often contain multiple keywords).
  if (
    v.includes('professional') ||
    v.includes('professionale') ||
    /(^|[^a-z])pro([^a-z]|$)/.test(v) ||
    v.endsWith(' pro')
  ) {
    return 'Professional';
  }
  if (v.includes('premium')) return 'Premium';
  if (v.includes('base') || v.includes('standard') || v.includes('account')) return 'Base';
  return 'Other';
}

export const STATS_VERSION_COLORS: Record<StatsVersionBucket, string> = {
  Trial: '#8a8a8a',
  Base: '#058592',
  Premium: '#ff8d00',
  Professional: '#941751',
  Other: '#4a5d8c',
};
