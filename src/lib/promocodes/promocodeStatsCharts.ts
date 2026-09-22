import { COUNTRIES_WITH_CODES } from '@/lib/news/countries';

export const PROMOCODE_MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Pie/bar colors by calendar month (1–12), per product spec. */
export const PROMOCODE_MONTH_COLORS: Record<number, string> = {
  1: '#1e3a8a', // Dark blue — January
  2: '#93c5fd', // Light blue — February
  3: '#06b6d4', // Cyan — March
  4: '#ca8a04', // Dark yellow — April
  5: '#86efac', // Light green — May
  6: '#16a34a', // Green — June
  7: '#ec4899', // Pink — July
  8: '#ef4444', // Red — August
  9: '#991b1b', // Dark red — September
  10: '#92400e', // Brown — October
  11: '#9ca3af', // Grey — November
  12: '#4b5563', // Dark grey — December
};

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  COUNTRIES_WITH_CODES.map(({ name, id }) => [id.toUpperCase(), name]),
);

export function countryDisplayName(code: string, countryId?: number): string {
  const trimmed = String(code ?? '').trim();
  if (!trimmed && (countryId == null || countryId === 0)) return 'Unknown / ID 0';
  if (!trimmed) return countryId != null ? `ID ${countryId}` : 'Unknown';
  return CODE_TO_NAME[trimmed.toUpperCase()] ?? trimmed;
}

export type MonthMetricKey = 'invitesSent' | 'registrations' | 'successRate';

export type MonthSlice = {
  key: string;
  label: string;
  month: number;
  value: number;
  color: string;
};

export function monthMetricSlices(
  months: Array<{
    month: number;
    invitesSent: number;
    registrations: number;
    successRate: number;
  }>,
  metric: MonthMetricKey,
): MonthSlice[] {
  return months.map((m) => {
    const value =
      metric === 'invitesSent'
        ? m.invitesSent
        : metric === 'registrations'
          ? m.registrations
          : m.successRate;
    return {
      key: `m-${m.month}`,
      label: PROMOCODE_MONTH_LABELS[m.month - 1] ?? String(m.month),
      month: m.month,
      value: Number(value) || 0,
      color: PROMOCODE_MONTH_COLORS[m.month] ?? '#64748b',
    };
  });
}

export type CountryMonthCell = { invitesSent: number; registrations: number };

export type CountryMatrixRow = {
  countryId: number;
  countryCode: string;
  months: Record<number, CountryMonthCell>;
};

/** Rank countries by total registrations (excluding ID 0); keep top 15 + Rest of the world. */
export function topCountriesForMonth(
  rows: CountryMatrixRow[],
  month: number,
  metric: 'registrations' | 'invitesSent' = 'registrations',
  topN = 15,
): Array<{ key: string; label: string; value: number; color: string }> {
  const scored = rows
    .filter((r) => Number(r.countryId) !== 0)
    .map((r) => {
      const cell = r.months[month];
      const value = cell ? Number(cell[metric] ?? 0) : 0;
      return {
        key: `${r.countryId}:${r.countryCode}`,
        label: countryDisplayName(r.countryCode, r.countryId),
        value,
      };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const top = scored.slice(0, topN);
  const restValue = scored.slice(topN).reduce((s, r) => s + r.value, 0);
  const palette = [
    '#2563eb',
    '#7c3aed',
    '#db2777',
    '#ea580c',
    '#ca8a04',
    '#16a34a',
    '#0891b2',
    '#4f46e5',
    '#be123c',
    '#0f766e',
    '#9333ea',
    '#c2410c',
    '#1d4ed8',
    '#a16207',
    '#15803d',
  ];

  const result = top.map((r, i) => ({
    ...r,
    color: palette[i % palette.length],
  }));

  if (restValue > 0 || scored.length > topN) {
    result.push({
      key: '__rest_of_world__',
      label: 'Rest of the world',
      value: restValue,
      color: '#6b7280',
    });
  }

  return result;
}

export function countryMonthlySlices(
  row: CountryMatrixRow,
  metric: 'registrations' | 'invitesSent' = 'registrations',
): MonthSlice[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const cell = row.months[month];
    const value = cell ? Number(cell[metric] ?? 0) : 0;
    return {
      key: `m-${month}`,
      label: PROMOCODE_MONTH_LABELS[i],
      month,
      value,
      color: PROMOCODE_MONTH_COLORS[month] ?? '#64748b',
    };
  });
}
