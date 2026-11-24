import { Prisma } from '@prisma/client';

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
};

export function rowMatchesTextSearch(
  row: SearchableMembershipListRow,
  q: string,
): boolean {
  const needle = q.trim();
  if (!needle) return true;
  return (
    textMatchesSearch(row.displayName, needle) ||
    textMatchesSearch(row.username, needle) ||
    textMatchesSearch(row.accountUsername, needle) ||
    textMatchesSearch(row.companyName, needle) ||
    textMatchesSearch(row.email, needle) ||
    textMatchesSearch(row.location, needle)
  );
}

export function filterListRowsByTextSearch<T extends SearchableMembershipListRow>(
  rows: T[],
  q: string,
): T[] {
  const needle = q.trim();
  if (!needle) return rows;
  return rows.filter((row) => rowMatchesTextSearch(row, needle));
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
  opts?: { matchOwnedClubs?: boolean },
): Prisma.UserWhereInput {
  const or: Prisma.UserWhereInput[] = [
    { username: { contains: q } },
    { email: { contains: q } },
    { name: { contains: q } },
    { firstName: { contains: q } },
    { surname: { contains: q } },
  ];

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
