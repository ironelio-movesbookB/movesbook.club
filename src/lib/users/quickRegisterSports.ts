/** Sports available when User type is Club / Team / Coach / Group. */
export const CLUB_TEAM_COACH_GROUP_SPORTS = [
  'Track & fields',
  'Basket',
  'Baseball',
  'Body building\\Gym',
  'Cricket',
  'Cycling',
  'Football',
  'Gymnastic',
  'Martial arts',
  'Padel',
  'Rugby',
  'Swim',
  'Ski',
  'Tennis',
  'Volley',
] as const;

/** Sports available when User type is Single User. */
export const SINGLE_USER_SPORTS = [
  'Track & fields',
  'Basket',
  'Baseball',
  'Body building',
  'Calistenic',
  'Cricket',
  'Cycling',
  'Fitness',
  'Football',
  'Gymnastic',
  'Martial arts',
  'Padel',
  'Running',
  'Rugby',
  'Swim',
  'Ski',
  'Tennis',
  'Triathlon',
  'Volley',
  'Others',
] as const;

const ENTITY_USER_TYPES = new Set(['6', '7', '8', '9']); // Coach, Team, Club, Group

function normalizeSportLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\\/]+/g, '\\')
    .replace(/\s+/g, ' ');
}

export function sportsForUserType(userType: string): readonly string[] {
  if (ENTITY_USER_TYPES.has(String(userType))) {
    return CLUB_TEAM_COACH_GROUP_SPORTS;
  }
  return SINGLE_USER_SPORTS;
}

export function sportOptionsForUserType(
  userType: string
): Array<{ id: string; name: string }> {
  return sportsForUserType(userType).map((name) => ({
    id: name,
    name,
  }));
}

/** Keep DB sports that match the allowed list for the selected user type (fuzzy name match). */
export function filterSportsCatalogForUserType(
  userType: string,
  catalog: Array<{ id: string; name: string }>
): Array<{ id: string; name: string }> {
  if (!userType) return catalog;
  const allowed = new Set(sportsForUserType(userType).map(normalizeSportLabel));
  const matched = catalog.filter((s) => allowed.has(normalizeSportLabel(s.name)));
  return matched.length > 0 ? matched : [...sportOptionsForUserType(userType)];
}
