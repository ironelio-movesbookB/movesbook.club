import type { MubCategory, MubRoleTemplate } from '@/lib/mub/types';

export const MUB_CATEGORIES: { id: MubCategory; legacyLabel: string }[] = [
  { id: 'CLUB_MANAGEMENT', legacyLabel: 'Club management' },
  { id: 'WORKOUT', legacyLabel: 'Workout section' },
  { id: 'SOCIAL', legacyLabel: 'Social section' },
];

export const MUB_STAFF_ROLE_TEMPLATES: { id: MubRoleTemplate; label: string }[] = [
  { id: 'SINGLE_USER', label: 'Single Users / Athletes' },
  { id: 'COACH', label: 'Coaches (ID6)' },
  { id: 'TEAM', label: 'Teams (ID7)' },
  { id: 'CLUB', label: 'Clubs (ID8)' },
  { id: 'GROUP', label: 'Groups' },
];

export const MUB_BACKGROUND_OPTIONS: { id: string; label: string; css: string }[] = [
  { id: 'white', label: 'White (default)', css: '#ffffff' },
  { id: 'pale_yellow', label: 'Pale yellow', css: '#fff9c4' },
  { id: 'light_blue', label: 'Light blue', css: '#bbdefb' },
  { id: 'light_grey', label: 'Light grey', css: '#eeeeee' },
  { id: 'straw_yellow', label: 'Straw yellow', css: '#f0e68c' },
  { id: 'light_violet', label: 'Light violet', css: '#e1bee7' },
  { id: 'violet', label: 'Violet', css: '#ce93d8' },
  { id: 'blue_grey', label: 'Blue grey', css: '#b0bec5' },
  { id: 'light_grey_2', label: 'Light grey', css: '#e0e0e0' },
];

export const MUB_BUTTON_COLORS: { value: string; label: string }[] = [
  { value: '#000000', label: 'Black Color Selected' },
  { value: '#808080', label: 'Grey Color Selected' },
  { value: '#ffffff', label: 'White Color Selected' },
  { value: '#1e3a8a', label: 'Blue Color Selected' },
  { value: '#166534', label: 'Green Color Selected' },
  { value: '#991b1b', label: 'Red Color Selected' },
];

export const MUB_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'en' },
  { code: 'it', label: 'it' },
  { code: 'es', label: 'es' },
  { code: 'fr', label: 'fr' },
  { code: 'de', label: 'de' },
  { code: 'pt', label: 'pt' },
  { code: 'ru', label: 'ru' },
  { code: 'zh', label: 'zh' },
  { code: 'ar', label: 'ar' },
  { code: 'hi', label: 'hi' },
];

export function mubButtonColorLabel(hex: string): string {
  return MUB_BUTTON_COLORS.find((c) => c.value.toLowerCase() === hex.toLowerCase())?.label ?? `${hex} Color Selected`;
}

export const MUB_TEXT_FONTS = ['Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman'];

export const MUB_TEXT_COLORS: { id: string; label: string; css: string }[] = [
  { id: 'yellow', label: 'Yellow', css: '#facc15' },
  { id: 'white', label: 'White', css: '#ffffff' },
  { id: 'black', label: 'Black', css: '#000000' },
  { id: 'red', label: 'Red', css: '#ef4444' },
  { id: 'lime', label: 'Lime', css: '#84cc16' },
];

/** Client answer #2 — URL open targets from PHP father app. */
export const MUB_PAGE_OPEN_OPTIONS: { id: string; label: string }[] = [
  { id: 'same_label', label: 'In the central frame of the same tab' },
  { id: 'new_tab', label: 'In a new tab' },
  { id: 'popup', label: 'In a new popup window' },
];

const BACKGROUND_CSS: Record<string, string> = Object.fromEntries(
  MUB_BACKGROUND_OPTIONS.map((o) => [o.id, o.css]),
);

const TEXT_COLOR_CSS: Record<string, string> = Object.fromEntries(
  MUB_TEXT_COLORS.map((c) => [c.id, c.css]),
);

export function mubBackgroundCss(id: string): string {
  return BACKGROUND_CSS[id] ?? '#ffffff';
}

export function mubTextColorCss(id: string): string {
  return TEXT_COLOR_CSS[id] ?? '#ffffff';
}

/**
 * Map account userType → staff MUB template (client answer #3).
 * Athletes / single users use the SINGLE_USER template.
 */
export function roleTemplateFromUserType(userType: string): MubRoleTemplate {
  const normalized = userType.toUpperCase();
  if (normalized === 'TEAM_MANAGER' || normalized === 'TEAM') return 'TEAM';
  if (normalized === 'COACH' || normalized === 'CLUB_TRAINER') return 'COACH';
  if (normalized === 'CLUB' || normalized === 'CLUB_ADMIN' || normalized === 'CLUB_MANAGER') return 'CLUB';
  if (normalized === 'GROUP' || normalized === 'GROUP_ADMIN') return 'GROUP';
  // ATHLETE, ADMIN, and any other single-user style account
  return 'SINGLE_USER';
}
