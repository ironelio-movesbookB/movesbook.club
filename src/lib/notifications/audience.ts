import type { UserType } from '@prisma/client';
import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';

/** Staff compose checkboxes — mapped from legacy PHP role ids without storing raw "5"/"8". */
export const STAFF_AUDIENCE_OPTIONS = [
  { value: 'ATHLETE' as const, label: 'Athletes / Members', legacyRoleId: 5 },
  { value: 'COACH' as const, label: 'Coaches', legacyRoleId: 6 },
  { value: 'TEAM' as const, label: 'Teams', legacyRoleId: 7 },
  { value: 'CLUB' as const, label: 'Clubs', legacyRoleId: 8 },
  { value: 'GROUP' as const, label: 'Groups', legacyRoleId: 9 },
] as const;

export type StaffAudienceRole = (typeof STAFF_AUDIENCE_OPTIONS)[number]['value'];

export const NOTIFICATION_SOURCES = [
  'movesbook_staff',
  'club_admin',
  'coach',
  'team_admin',
  'group_admin',
] as const;
export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

export const CLUB_AUDIENCE_KINDS = ['members', 'staff'] as const;
export type ClubAudienceKind = (typeof CLUB_AUDIENCE_KINDS)[number];

export const NOTIFICATION_LANGUAGES = SUPPORTED_LANGUAGES.map((l) => ({
  code: l.code,
  label: l.name,
}));

/** UserTypes that count as a selected staff audience role. */
export function userTypesForStaffAudienceRole(role: StaffAudienceRole): UserType[] {
  switch (role) {
    case 'ATHLETE':
      return ['ATHLETE'];
    case 'CLUB':
      return ['CLUB', 'CLUB_TRAINER'];
    case 'COACH':
      return ['COACH'];
    case 'TEAM':
      return ['TEAM', 'TEAM_MANAGER'];
    case 'GROUP':
      return ['GROUP', 'GROUP_ADMIN'];
    default:
      return [];
  }
}

export function expandStaffAudienceRoles(roles: string[]): UserType[] {
  const out = new Set<UserType>();
  for (const role of roles) {
    if (!isStaffAudienceRole(role)) continue;
    for (const ut of userTypesForStaffAudienceRole(role)) out.add(ut);
  }
  return Array.from(out);
}

export function isStaffAudienceRole(value: unknown): value is StaffAudienceRole {
  return STAFF_AUDIENCE_OPTIONS.some((o) => o.value === value);
}

export function isNotificationSource(value: unknown): value is NotificationSource {
  return NOTIFICATION_SOURCES.includes(value as NotificationSource);
}

export function isClubAudienceKind(value: unknown): value is ClubAudienceKind {
  return value === 'members' || value === 'staff';
}

export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v ?? '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function toJsonStringArray(values: string[]): string {
  return JSON.stringify(Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))));
}

export function parseJsonStringRecord(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      out[String(k)] = typeof v === 'string' ? v : String(v ?? '');
    }
    return out;
  } catch {
    return {};
  }
}

export function toJsonStringRecord(map: Record<string, string>): string {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    const key = k.trim();
    if (!key) continue;
    cleaned[key] = typeof v === 'string' ? v : '';
  }
  return JSON.stringify(cleaned);
}

/** Normalize profile language to supported ISO code. */
export function normalizeProfileLanguage(raw: string | null | undefined): string {
  const code = String(raw ?? 'en').trim().toLowerCase();
  if (!code) return 'en';
  if (NOTIFICATION_LANGUAGES.some((l) => l.code === code)) return code;
  // common aliases
  if (code === 'por' || code === 'pt-br') return 'pt';
  if (code === 'cn' || code === 'zh-cn' || code === 'zh-tw') return 'zh';
  if (code.startsWith('en')) return 'en';
  return code.length >= 2 ? code.slice(0, 2) : 'en';
}

/**
 * Resolve HTML body for a recipient language.
 * Prefer exact language; else English (even if blank); else first non-empty; else fallbackDescription.
 */
export function resolveNotificationHtmlForLanguage(
  contentsByLang: Record<string, string>,
  profileLang: string,
  fallbackDescription = '',
): string {
  const lang = normalizeProfileLanguage(profileLang);
  if (Object.prototype.hasOwnProperty.call(contentsByLang, lang)) {
    return contentsByLang[lang] ?? '';
  }
  if (Object.prototype.hasOwnProperty.call(contentsByLang, 'en')) {
    return contentsByLang.en ?? '';
  }
  const first = Object.values(contentsByLang).find((v) => String(v ?? '').trim());
  if (first) return first;
  return fallbackDescription;
}

/** Staff language targeting: empty / * / all = every language. */
export function staffLanguagesMatchUser(
  audienceLanguages: string[],
  profileLang: string,
): boolean {
  if (audienceLanguages.length === 0) return true;
  if (audienceLanguages.includes('*') || audienceLanguages.includes('0') || audienceLanguages.includes('all')) {
    return true;
  }
  const lang = normalizeProfileLanguage(profileLang);
  return audienceLanguages.map((l) => normalizeProfileLanguage(l)).includes(lang);
}

/** Split username field: commas, spaces, newlines. */
export function parseUsernameInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function isOrgNotificationSource(source: string): boolean {
  return source === 'club_admin' || source === 'coach' || source === 'team_admin' || source === 'group_admin';
}
