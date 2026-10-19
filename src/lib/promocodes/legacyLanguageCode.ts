/** Legacy PHP `language_values.lang_name` / `language_paragraphs` column codes. */
export const LEGACY_LANG_CODE_BY_ID: Record<number, string> = {
  1: 'en',
  2: 'fr',
  3: 'de',
  4: 'it',
  5: 'es',
  6: 'por',
  7: 'rus',
  8: 'ind',
  9: 'chin',
  10: 'arab',
  11: 'jap',
  12: 'id',
};

const LABEL_TO_LEGACY_CODE: Record<string, string> = {
  en: 'en',
  english: 'en',
  fr: 'fr',
  french: 'fr',
  de: 'de',
  german: 'de',
  deutsch: 'de',
  it: 'it',
  italian: 'it',
  italiano: 'it',
  es: 'es',
  spanish: 'es',
  por: 'por',
  pt: 'por',
  portuguese: 'por',
  rus: 'rus',
  ru: 'rus',
  russian: 'rus',
  ind: 'ind',
  hi: 'ind',
  hindi: 'ind',
  chin: 'chin',
  zh: 'chin',
  chinese: 'chin',
  arab: 'arab',
  ar: 'arab',
  arabic: 'arab',
  ja: 'jap',
  japanese: 'jap',
  id: 'id',
  indonesian: 'id',
};

/** Map a legacy/modern language token to `language_paragraphs` column name. */
export function normalizeLegacyLanguageCode(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return 'en';
  const key = trimmed.toLowerCase();
  return LABEL_TO_LEGACY_CODE[key] ?? trimmed;
}

export function legacyLanguageIdFromCode(code: string | null | undefined): string {
  const normalized = normalizeLegacyLanguageCode(code);
  const found = Object.entries(LEGACY_LANG_CODE_BY_ID).find(([, value]) => value === normalized);
  return found ? found[0] : '1';
}

export function legacyLanguageCodeFromId(languageId: string | number): string {
  const id = Number(languageId);
  if (Number.isFinite(id) && LEGACY_LANG_CODE_BY_ID[id]) {
    return LEGACY_LANG_CODE_BY_ID[id];
  }
  return 'en';
}

/** Flag filenames in legacy PHP `img/flags/` (language_values.lang_name + `.png`). */
export function legacyFlagFilename(langCode: string): string {
  const code = normalizeLegacyLanguageCode(langCode);
  const filenameByCode: Record<string, string> = {
    en: 'en.png',
    fr: 'fr.png',
    de: 'de.png',
    it: 'it.png',
    es: 'es.png',
    por: 'por.png',
    rus: 'rus.png',
    ind: 'ind.png',
    chin: 'chin.png',
    arab: 'arab.png',
    jap: 'jap.png',
    id: 'id.png',
  };
  return filenameByCode[code] ?? 'en.png';
}

export function legacyFlagImageUrl(langCode: string): string {
  return `/img/flags/${legacyFlagFilename(langCode)}`;
}
