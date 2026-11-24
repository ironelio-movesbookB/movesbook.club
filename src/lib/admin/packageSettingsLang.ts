import { SUPPORTED_LANGUAGES } from '@/constants/tools.constants';

export function emptyLangMap(fallback = ''): Record<string, string> {
  return Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, fallback]));
}

export function getPackageDisplayTitle(
  titlesByLang: Record<string, string>,
  lang: string,
): string {
  return (
    titlesByLang[lang] ||
    titlesByLang.en ||
    Object.values(titlesByLang).find(Boolean) ||
    'Untitled package'
  );
}

export function getPackageFullOverviewHtml(
  htmlByLang: Record<string, string>,
  lang: string,
): string {
  return (
    htmlByLang[lang]?.trim() ||
    htmlByLang.en?.trim() ||
    Object.values(htmlByLang).find((value) => value?.trim())?.trim() ||
    ''
  );
}

export function getPackageDisplayDescription(
  descriptionsByLang: Record<string, string>,
  lang: string,
): string {
  return (
    descriptionsByLang[lang]?.trim() ||
    descriptionsByLang.en?.trim() ||
    Object.values(descriptionsByLang).find((value) => value?.trim())?.trim() ||
    ''
  );
}

/** First line of the localized Description field (Product Review subtitle). */
export function getPackageDescriptionFirstLine(
  descriptionsByLang: Record<string, string>,
  lang: string,
): string {
  const full = getPackageDisplayDescription(descriptionsByLang, lang);
  if (!full) return '';
  return full.split(/\r?\n/)[0]?.trim() ?? '';
}

export function hasPackageFullOverview(
  htmlByLang: Record<string, string>,
  lang: string,
): boolean {
  const html = getPackageFullOverviewHtml(htmlByLang, lang);
  if (!html) return false;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return text.length > 0;
}
