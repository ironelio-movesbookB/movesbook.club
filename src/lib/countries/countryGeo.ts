import { COUNTRIES_DASHBOARD_ROWS } from '@/constants/countriesDashboard.constants';

/** Continent label for users without a country (or a country missing from the Countries list). */
export const UNKNOWN_CONTINENT = 'Unknown';

const BY_NAME = new Map(COUNTRIES_DASHBOARD_ROWS.map((r) => [r.name.toLowerCase(), r]));

/** Flag code and continent of a country, as matched in Super Admin → Countries. */
export function countryGeo(name: string | null | undefined): { iso2: string | null; continent: string } {
  const row = BY_NAME.get(String(name ?? '').trim().toLowerCase());
  return row ? { iso2: row.iso2 || null, continent: row.continent } : { iso2: null, continent: UNKNOWN_CONTINENT };
}
