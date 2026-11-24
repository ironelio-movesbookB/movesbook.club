import { SportType } from '@prisma/client';

export const PROFILE_SPORT_OPTIONS = Object.values(SportType);

export function formatSportLabel(sport: string): string {
  return sport
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function isValidSportType(value: string): value is SportType {
  return (PROFILE_SPORT_OPTIONS as string[]).includes(value);
}

export function normalizeTelegramAccount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const handle = trimmed.replace(/^@+/, '').trim().toLowerCase();
  if (!handle) return null;
  return `@${handle}`;
}
