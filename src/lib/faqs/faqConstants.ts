/**
 * FAQ system (port of PHP movesbook.net FaqPage / admins/faq_pages_manage).
 * Shared by client and server — no server-only imports here.
 */

/** The 10 languages of the PHP FAQ editor. `code` = site Language.code, `label` = PHP short name. */
export const FAQ_LANGUAGES = [
  { code: 'en', label: 'en', name: 'English', flag: '/flags/en.png' },
  { code: 'fr', label: 'fr', name: 'Français', flag: '/flags/fr.png' },
  { code: 'de', label: 'de', name: 'Deutsch', flag: '/flags/de.png' },
  { code: 'it', label: 'it', name: 'Italiano', flag: '/flags/it.png' },
  { code: 'es', label: 'es', name: 'Español', flag: '/flags/es.png' },
  { code: 'pt', label: 'por', name: 'Português', flag: '/flags/por.png' },
  { code: 'ru', label: 'rus', name: 'Русский', flag: '/flags/rus.png' },
  { code: 'hi', label: 'ind', name: 'हिन्दी', flag: '/flags/ind.png' },
  { code: 'zh', label: 'chin', name: '中文', flag: '/flags/chin.png' },
  { code: 'ar', label: 'arab', name: 'العربية', flag: '/flags/arab.png' },
] as const;

export type FaqLanguageCode = (typeof FAQ_LANGUAGES)[number]['code'];

export const FAQ_LANGUAGE_CODES: FaqLanguageCode[] = FAQ_LANGUAGES.map((l) => l.code);

export function isFaqLanguage(value: unknown): value is FaqLanguageCode {
  return typeof value === 'string' && (FAQ_LANGUAGE_CODES as string[]).includes(value);
}

export const FAQ_SECTIONS = [
  { key: 'athletes', label: 'Athletes' },
  { key: 'coaches', label: 'Coaches' },
  { key: 'teams', label: 'Teams' },
  { key: 'clubs', label: 'Clubs' },
  { key: 'groups', label: 'Groups' },
  { key: 'mainpage', label: 'Mainpage' },
] as const;

export const FAQ_SUBSECTIONS = [
  { key: 'social', label: 'Social' },
  { key: 'workouts', label: 'WorkOuts' },
  { key: 'management', label: 'Management' },
] as const;

export type FaqSectionKey = (typeof FAQ_SECTIONS)[number]['key'];
export type FaqSubsectionKey = (typeof FAQ_SUBSECTIONS)[number]['key'];

/** Section-subsection pairs offered by the PHP dropdown (Management exists only for Clubs). */
export const FAQ_SECTION_PAIRS: { section: FaqSectionKey; subsection: FaqSubsectionKey }[] = [
  { section: 'athletes', subsection: 'social' },
  { section: 'athletes', subsection: 'workouts' },
  { section: 'coaches', subsection: 'social' },
  { section: 'coaches', subsection: 'workouts' },
  { section: 'teams', subsection: 'social' },
  { section: 'teams', subsection: 'workouts' },
  { section: 'clubs', subsection: 'social' },
  { section: 'clubs', subsection: 'workouts' },
  { section: 'clubs', subsection: 'management' },
  { section: 'groups', subsection: 'social' },
  { section: 'groups', subsection: 'workouts' },
  { section: 'mainpage', subsection: 'social' },
  { section: 'mainpage', subsection: 'workouts' },
];

export function isFaqSection(value: unknown): value is FaqSectionKey {
  return FAQ_SECTIONS.some((s) => s.key === value);
}

export function isFaqSubsection(value: unknown): value is FaqSubsectionKey {
  return FAQ_SUBSECTIONS.some((s) => s.key === value);
}

export function isValidFaqPair(section: unknown, subsection: unknown): boolean {
  return FAQ_SECTION_PAIRS.some((p) => p.section === section && p.subsection === subsection);
}

export function faqSectionLabel(key: string): string {
  return FAQ_SECTIONS.find((s) => s.key === key)?.label ?? key;
}

export function faqSubsectionLabel(key: string): string {
  return FAQ_SUBSECTIONS.find((s) => s.key === key)?.label ?? key;
}

export function faqPairLabel(section: string, subsection: string): string {
  return `${faqSectionLabel(section)} - ${faqSubsectionLabel(subsection)}`;
}

/** Key used in the view-settings table for a pair; `current_page` = "FAQ of the current page". */
export function faqPairKey(section: string, subsection: string): string {
  return `${section}:${subsection}`;
}

export const FAQ_CURRENT_PAGE_SETTING_KEY = 'current_page';

export const FAQ_VIEW_MODES = [
  { key: 'grid3', label: '3 for row' },
  { key: 'grid4', label: '4 for row' },
  { key: 'cascade', label: 'Cascade' },
] as const;

export type FaqViewMode = (typeof FAQ_VIEW_MODES)[number]['key'];

export const FAQ_DEFAULT_VIEW_MODE: FaqViewMode = 'cascade';

export function isFaqViewMode(value: unknown): value is FaqViewMode {
  return FAQ_VIEW_MODES.some((m) => m.key === value);
}

export const FAQ_DOC_TYPES = [
  { key: 'document', label: 'Document' },
  { key: 'link', label: 'Link' },
] as const;

export type FaqDocType = (typeof FAQ_DOC_TYPES)[number]['key'];

export function isFaqDocType(value: unknown): value is FaqDocType {
  return FAQ_DOC_TYPES.some((d) => d.key === value);
}

/** Background/text pairs of the PHP "Create Chapter" palette (18 swatches). */
export const FAQ_CHAPTER_COLORS = [
  { bg: '#f0533c', fg: '#ffffff' },
  { bg: '#3df05a', fg: '#ffffff' },
  { bg: '#3d5af0', fg: '#ffffff' },
  { bg: '#f1c40f', fg: '#000000' },
  { bg: '#9b59b6', fg: '#ffffff' },
  { bg: '#e74c3c', fg: '#ffffff' },
  { bg: '#2ecc71', fg: '#ffffff' },
  { bg: '#3498db', fg: '#ffffff' },
  { bg: '#1abc9c', fg: '#ffffff' },
  { bg: '#f39c12', fg: '#000000' },
  { bg: '#d35400', fg: '#ffffff' },
  { bg: '#8e44ad', fg: '#ffffff' },
  { bg: '#2c3e50', fg: '#ffffff' },
  { bg: '#95a5a6', fg: '#ffffff' },
  { bg: '#ecf0f1', fg: '#000000' },
  { bg: '#34495e', fg: '#ffffff' },
  { bg: '#ffffff', fg: '#000000' },
  { bg: '#8e7c93', fg: '#ffffff' },
] as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/**
 * Normalize a page reference to the pathname used for matching linked pages.
 * `https://movesbook.net/users/club_user_faccess?x=1#a` → `/users/club_user_faccess`
 */
export function normalizeFaqPagePath(input: string): string {
  let s = (input || '').trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) {
      s = new URL(s).pathname;
    }
  } catch {
    /* keep raw */
  }
  s = s.split('#')[0].split('?')[0].trim();
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s.toLowerCase().slice(0, 500);
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type FaqTranslationDto = {
  lang: FaqLanguageCode;
  title: string;
  subtitle: string;
  content: string;
};

export type FaqPairDto = { section: FaqSectionKey; subsection: FaqSubsectionKey };

export type FaqAdminRowDto = {
  id: string;
  code: string;
  iconPath: string | null;
  docType: FaqDocType;
  url: string;
  createdAt: string;
  /** "Variable Title" / "Variable Subtitle" from the Create/Edit FAQ form. */
  title: string;
  subtitle: string;
  pairs: FaqPairDto[];
  /** Languages with at least a title or content saved. */
  filledLangs: FaqLanguageCode[];
  /** Titles keyed by language (for the list "Select Language" switch). */
  titles: Partial<Record<FaqLanguageCode, { title: string; subtitle: string }>>;
};

export type FaqChapterDto = {
  id: string;
  title: string;
  bg: string;
  fg: string;
};

/** One row of the operator's manual order ("set"): an FAQ or a chapter/separator. */
export type FaqListEntryDto =
  | { kind: 'faq'; itemId: string; faq: FaqAdminRowDto }
  | { kind: 'chapter'; itemId: string; chapter: FaqChapterDto };

export type FaqPublicItemDto = {
  id: string;
  iconPath: string | null;
  docType: FaqDocType;
  url: string;
  title: string;
  subtitle: string;
  content: string;
};
