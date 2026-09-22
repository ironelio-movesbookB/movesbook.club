/** Super Admin — Sport settings → Tools → Dropdown parameters for sport. */

/** tools_defaults.language key for the language-agnostic global catalog. */
export const SPORT_DROPDOWN_TOOLS_DEFAULTS_LANG = '_sport_dropdown_parameters';

/**
 * Language-country locales for sport dropdown catalogs.
 * Second IND in the brief = Indonesia → code `idn` (display IDN).
 */
export const SPORT_DROPDOWN_LOCALES = [
  {
    code: 'eng',
    displayCode: 'ENG',
    country: 'Great Britain',
    flagFile: 'en.png',
    aliases: ['en'],
  },
  {
    code: 'fra',
    displayCode: 'FRA',
    country: 'France',
    flagFile: 'fr.png',
    aliases: ['fr'],
  },
  {
    code: 'ita',
    displayCode: 'ITA',
    country: 'Italia',
    flagFile: 'it.png',
    aliases: ['it'],
  },
  {
    code: 'deu',
    displayCode: 'DEU',
    country: 'Germany',
    flagFile: 'de.png',
    aliases: ['de'],
  },
  {
    code: 'esp',
    displayCode: 'ESP',
    country: 'Spain',
    flagFile: 'es.png',
    aliases: ['es'],
  },
  {
    code: 'por',
    displayCode: 'POR',
    country: 'Portugal',
    flagFile: 'por.png',
    aliases: ['pt'],
  },
  {
    code: 'rus',
    displayCode: 'RUS',
    country: 'Russia',
    flagFile: 'rus.png',
    aliases: ['ru'],
  },
  {
    code: 'ind',
    displayCode: 'IND',
    country: 'India',
    flagFile: 'ind.png',
    aliases: ['hi'],
  },
  {
    code: 'chi',
    displayCode: 'CHI',
    country: 'China',
    flagFile: 'chin.png',
    aliases: ['zh'],
  },
  {
    code: 'ara',
    displayCode: 'ARA',
    country: 'Arab Emirates',
    flagFile: 'arab.png',
    aliases: ['ar'],
  },
  {
    code: 'jap',
    displayCode: 'JAP',
    country: 'Japan',
    flagFile: 'jap.png',
    aliases: ['ja'],
  },
  {
    code: 'idn',
    displayCode: 'IDN',
    country: 'Indonesia',
    flagFile: 'id.png',
    aliases: ['id'],
  },
] as const;

export type SportDropdownLocaleCode = (typeof SPORT_DROPDOWN_LOCALES)[number]['code'];

export type SportDropdownItem = {
  id: string;
  /** Item label per locale code (eng, fra, …) and legacy short codes (en, fr, …). */
  nameByLanguage: Record<string, string>;
  sortOrder: number;
  color?: string;
};

export type SportDropdownParameter = {
  id: string;
  /** Stable key used by TEAM / Team profile ** dropdowns. */
  key: string;
  /** Parameter title (e.g. Federations) per locale. */
  labelByLanguage: Record<string, string>;
  items: SportDropdownItem[];
};

export type SportDropdownCatalog = {
  version: 1;
  /** Keyed by entity sport name (e.g. Football, Swim, Rugby). */
  bySport: Record<string, { parameters: SportDropdownParameter[] }>;
};

/** Default parameters seeded per sport (Teams parameter settings). */
export const DEFAULT_SPORT_DROPDOWN_PARAM_KEYS = [
  { key: 'company_types', enLabel: 'Company types' },
  { key: 'federations', enLabel: 'Federations' },
  { key: 'sports_organization', enLabel: 'Sports organization' },
  { key: 'registration_authority', enLabel: 'Registration authority' },
  { key: 'registered_at', enLabel: 'Registered at' },
  { key: 'field_type', enLabel: 'Field type' },
  { key: 'main_category', enLabel: 'Main category' },
  { key: 'other_categories', enLabel: 'Other categories' },
  { key: 'category', enLabel: 'Category' },
  { key: 'position', enLabel: 'Position' },
  { key: 'specialty', enLabel: 'Specialty' },
] as const;

const ITEM_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4'];

export function emptySportDropdownCatalog(): SportDropdownCatalog {
  return { version: 1, bySport: {} };
}

export function sportDropdownLocaleLabel(code: string): string {
  const loc = SPORT_DROPDOWN_LOCALES.find((l) => l.code === code);
  if (!loc) return code.toUpperCase();
  return `${loc.displayCode} - ${loc.country}`;
}

export function sportDropdownFlagSrc(code: string): string {
  const loc = SPORT_DROPDOWN_LOCALES.find((l) => l.code === code);
  return `/flags/${loc?.flagFile ?? 'en.png'}`;
}

/** Resolve UI / profile language to catalog lookup keys (primary first). */
export function resolveSportDropdownLocaleKeys(language: string): string[] {
  const raw = (language || 'eng').toLowerCase().trim();
  const two = raw.split('-')[0] || raw;
  const keys: string[] = [];
  const push = (k: string) => {
    if (k && !keys.includes(k)) keys.push(k);
  };
  push(raw);
  push(two);
  for (const loc of SPORT_DROPDOWN_LOCALES) {
    if (loc.code === raw || loc.code === two || (loc.aliases as readonly string[]).includes(two)) {
      push(loc.code);
      for (const a of loc.aliases) push(a);
    }
  }
  push('eng');
  push('en');
  return keys;
}

export function pickLocalizedName(
  byLanguage: Record<string, string> | undefined,
  language: string,
  fallback = '',
): string {
  if (!byLanguage) return fallback;
  for (const key of resolveSportDropdownLocaleKeys(language)) {
    const v = byLanguage[key]?.trim();
    if (v) return v;
  }
  return fallback;
}

function defaultParameter(sport: string, key: string, enLabel: string): SportDropdownParameter {
  return {
    id: `${sport}-${key}`,
    key,
    labelByLanguage: { eng: enLabel, en: enLabel },
    items: [],
  };
}

/** Seed missing default parameters for a sport; keep existing items/params. */
export function ensureSportParameters(
  catalog: SportDropdownCatalog,
  sport: string,
): SportDropdownCatalog {
  const existing = catalog.bySport[sport]?.parameters ?? [];
  const byKey = new Map(existing.map((p) => [p.key, p]));
  const merged: SportDropdownParameter[] = [];

  for (const def of DEFAULT_SPORT_DROPDOWN_PARAM_KEYS) {
    const found = byKey.get(def.key);
    if (found) {
      merged.push(found);
      byKey.delete(def.key);
    } else {
      merged.push(defaultParameter(sport, def.key, def.enLabel));
    }
  }
  // Keep any custom parameters after the defaults
  for (const p of existing) {
    if (byKey.has(p.key)) merged.push(p);
  }

  return {
    ...catalog,
    bySport: {
      ...catalog.bySport,
      [sport]: { parameters: merged },
    },
  };
}

export function normalizeSportDropdownCatalog(raw: unknown): SportDropdownCatalog {
  if (!raw || typeof raw !== 'object') return emptySportDropdownCatalog();
  const obj = raw as Partial<SportDropdownCatalog> & {
    sportDropdownParameters?: unknown;
  };
  const source =
    obj.sportDropdownParameters && typeof obj.sportDropdownParameters === 'object'
      ? (obj.sportDropdownParameters as Partial<SportDropdownCatalog>)
      : obj;
  const bySport =
    source.bySport && typeof source.bySport === 'object'
      ? (source.bySport as SportDropdownCatalog['bySport'])
      : {};
  return { version: 1, bySport };
}

/** Option labels for a sport + parameter key in a display locale (ENG fallback). */
export function optionsForSportParameter(
  catalog: SportDropdownCatalog,
  sport: string,
  paramKey: string,
  language: string,
): { id: string; label: string }[] {
  const params = catalog.bySport[sport]?.parameters ?? [];
  const param = params.find((p) => p.key === paramKey);
  if (!param) return [];
  return [...param.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((it) => ({
      id: it.id,
      label: pickLocalizedName(it.nameByLanguage, language),
    }))
    .filter((o) => o.label);
}

export function parameterLabelForLanguage(
  catalog: SportDropdownCatalog,
  sport: string,
  paramKey: string,
  language: string,
  fallback: string,
): string {
  const param = catalog.bySport[sport]?.parameters?.find((p) => p.key === paramKey);
  if (!param) return fallback;
  return pickLocalizedName(param.labelByLanguage, language, fallback);
}

export function nextItemColor(existingCount: number): string {
  return ITEM_COLORS[existingCount % ITEM_COLORS.length];
}

/** Map Team profile field labels to catalog parameter keys. */
export const TEAM_PROFILE_PARAM_KEY_BY_FIELD = {
  companyType: 'company_types',
  federationName: 'federations',
  registeredAt: 'registered_at',
  fieldType: 'field_type',
  mainCategory: 'main_category',
  otherCategories: 'other_categories',
} as const;
