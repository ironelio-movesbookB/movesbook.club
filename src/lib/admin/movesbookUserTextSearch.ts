import { Prisma, UserType } from '@prisma/client';
import { typeBadgeLabel } from '@/lib/admin/userPcuPanel';

/** Case-insensitive match; spaces ignored so "Fitclub2" matches "Fitclub 2". */
export function normalizeTextSearchValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

export function textMatchesSearch(
  haystack: string | null | undefined,
  needle: string,
): boolean {
  const normalizedNeedle = normalizeTextSearchValue(needle);
  if (!normalizedNeedle) return true;
  return normalizeTextSearchValue(haystack || '').includes(normalizedNeedle);
}

export type SearchableMembershipListRow = {
  displayName: string;
  username: string;
  accountUsername?: string;
  companyName?: string;
  email?: string;
  location?: string | null;
  userType?: string | null;
  country?: string | null;
};

export type TextSearchOptions = {
  /** Also match the "Type of User" label (e.g. "Athlete") and the country (admin payment/subscription lists). */
  matchUserTypeAndCountry?: boolean;
};

/** User types whose list label ("Athlete", "Team manager", …) contains the search text. */
export function userTypesMatchingSearch(q: string): UserType[] {
  const needle = normalizeTextSearchValue(q);
  if (!needle) return [];
  return Object.values(UserType).filter((type) =>
    normalizeTextSearchValue(typeBadgeLabel(type)).includes(needle),
  );
}

export function rowMatchesTextSearch(
  row: SearchableMembershipListRow,
  q: string,
  opts?: TextSearchOptions,
): boolean {
  const needle = q.trim();
  if (!needle) return true;
  return (
    textMatchesSearch(row.displayName, needle) ||
    textMatchesSearch(row.username, needle) ||
    textMatchesSearch(row.accountUsername, needle) ||
    textMatchesSearch(row.companyName, needle) ||
    textMatchesSearch(row.email, needle) ||
    textMatchesSearch(row.location, needle) ||
    Boolean(
      opts?.matchUserTypeAndCountry &&
        ((row.userType && textMatchesSearch(typeBadgeLabel(row.userType as UserType), needle)) ||
          textMatchesSearch(row.country, needle)),
    )
  );
}

export function filterListRowsByTextSearch<T extends SearchableMembershipListRow>(
  rows: T[],
  q: string,
  opts?: TextSearchOptions,
): T[] {
  const needle = q.trim();
  if (!needle) return rows;
  return rows.filter((row) => rowMatchesTextSearch(row, needle, opts));
}

/**
 * Text search on User rows. When `matchOwnedClubs` is true, also matches club official name,
 * location, and form metadata in `clubs_new.description` (club username, etc.).
 *
 * Note: for multi-company admins (clubs/teams/groups), the API also applies
 * {@link filterListRowsByTextSearch} so only matching membership rows are returned.
 */
export function buildMovesbookUserTextSearchOr(
  q: string,
  opts?: { matchOwnedClubs?: boolean } & TextSearchOptions,
): Prisma.UserWhereInput {
  const or: Prisma.UserWhereInput[] = [
    { username: { contains: q } },
    { email: { contains: q } },
    { name: { contains: q } },
    { firstName: { contains: q } },
    { surname: { contains: q } },
  ];

  if (opts?.matchUserTypeAndCountry) {
    or.push({ country: { contains: q } });
    const types = userTypesMatchingSearch(q);
    if (types.length > 0) or.push({ userType: { in: types } });
  }

  if (opts?.matchOwnedClubs) {
    or.push({
      ownedClubs: {
        some: {
          OR: [
            { name: { contains: q } },
            { location: { contains: q } },
            { description: { contains: q } },
          ],
        },
      },
    });
  }

  return { OR: or };
}

export function segmentShouldMatchOwnedClubs(segment: string): boolean {
  return segment === 'clubs' || segment === 'all';
}
